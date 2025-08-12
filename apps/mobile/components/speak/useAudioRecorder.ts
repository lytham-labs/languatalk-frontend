import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Buffer } from 'buffer';
import LiveAudioStream from 'react-native-live-audio-stream';

import { DeepgramService } from '@/services/DeepgramService';
import AudioPlayerService from '@/services/AudioPlayerService';
import { getTranscriptionModel } from '@/constants/TranscriptionOptions';
import { TRANSCRIPTION_CLOUDFLARE_WORKER_URL } from '@/constants/api';

// Constants for VAD - adjust as needed if moving logic completely
const POSITIVE_SPEECH_THRESHOLD = -45;
const NEGATIVE_SPEECH_THRESHOLD = -50;
const REDEMPTION_FRAMES_AUTO_SEND = 30; // Example, should be derived from chat settings ideally
const REDEMPTION_FRAMES_MANUAL = 200; // Example
const MIN_SPEECH_FRAMES = 10;
const MIN_MANUAL_SPEECH_FRAMES = 3;
const MONITORING_INTERVAL = 100;

const triggerHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

interface ChatData {
  chat: {
    id: number;
    language: string;
    language_code: string;
    mode: string;
    voice: string;
    voice_provider: string;
    speed: string;
    streaming_enabled: boolean;
    auto_send: boolean;
    auto_send_threshold: number;
    auto_record: boolean;
    auto_correct: boolean;
    topic: string;
    subtopic_category: string;
    topic_category: string;
    client_provider: string;
    model: string;
    transcription_mode: string;
    ai_model: string;
    dialect_code: string;
    avatar_url: string;
    created_at: string;
    updated_at: string;
    highlight_mode: string;
    name: string;
  };
  messages: Message[];
  user: {
    id: number;
    name: string;
    avatar_url: string;
  };
  message_limit_reached: boolean;
  chat_form_options: {
    mode_options: { [key: string]: string };
    voice_options: { [key: string]: string };
    ai_model_options: [string, string][];
    transcription_mode_options: [string, string][];
    speed_options: [string, string][];
    transcription_model_options: {
      [key: string]: {
        label: string;
        value: string;
        model: string;
      }
    };
  };
}

interface PendingUserAudio {
  audioUri: string;
  timestamp: number;
}

interface UseAudioRecorderProps {
  token: string | null;
  chatData: ChatData | null;
  audioPlayerService: React.RefObject<AudioPlayerService>;
  onRecordingStateChange: (isRecording: boolean) => void;
  onTranscriptionStateChange: (isTranscribing: boolean) => void;
  onMicrophoneError: (
    errorType: 'permission' | 'initialization' | 'connection' | 'generic',
    showModal: boolean
  ) => void;
  onTranscriptionResult: (text: string, sendImmediately: boolean) => void;
  useNewVADSystem: boolean;
  voiceRecognitionRef: React.RefObject<any>; // Consider defining a specific type if possible
  transcriptionMode: string;
  transcriptionModel: string;
  onPendingUserAudioChange: (audio: PendingUserAudio | null) => void;
  autoSend: boolean; // Pass relevant chat settings
  autoSendThreshold: number; // Pass relevant chat settings
}

export function useAudioRecorder({
  token,
  chatData,
  audioPlayerService,
  onRecordingStateChange,
  onTranscriptionStateChange,
  onMicrophoneError,
  onTranscriptionResult,
  useNewVADSystem,
  voiceRecognitionRef,
  transcriptionMode,
  transcriptionModel,
  useTranscriptionCloudflareWorker,
  onPendingUserAudioChange,
  autoSend,
  autoSendThreshold,
}: UseAudioRecorderProps) {
  const isStartingRecordingRef = useRef(false);
  const recordingInstanceRef = useRef<Audio.Recording | null>(null);
  const deepgramServiceRef = useRef<DeepgramService | null>(null);
  const isDeepgramConnectedRef = useRef(false);
  const pendingUserAudioRef = useRef<PendingUserAudio | null>(null); // Local ref for hook
  const autoSendRef = useRef(autoSend);

  useEffect(() => {
    autoSendRef.current = autoSend;
  }, [autoSend]);

  // Old VAD state refs
  const isSpeakingRef = useRef(false);
  const silentFrameCountRef = useRef(0);
  const speechFrameCountRef = useRef(0);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

   // Effect to call the callback when isRecording changes
  useEffect(() => {
    onRecordingStateChange(isRecording);
  }, [isRecording, onRecordingStateChange]);

  // Effect to call the callback when isTranscribing changes
  useEffect(() => {
    onTranscriptionStateChange(isTranscribing);
  }, [isTranscribing, onTranscriptionStateChange]);

  // Effect for deepgram cleanup
  useEffect(() => {
    return () => {
      deepgramServiceRef.current?.disconnect();
    };
  }, []);

  // Effect for recorder cleanup
  useEffect(() => {
    return () => {
      if (recordingInstanceRef.current) {
        recordingInstanceRef.current.stopAndUnloadAsync().catch(error => {
          console.error('Error stopping recording on unmount:', error);
        });
        recordingInstanceRef.current = null;
      }
       if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
        monitoringIntervalRef.current = null;
      }
    };
  }, []);


  const determineModel = useCallback((mode: string) => {
    if (chatData?.chat_form_options?.transcription_model_options?.[mode]) {
      return chatData.chat_form_options.transcription_model_options[mode].model;
    }
    return getTranscriptionModel(mode);
  }, [chatData?.chat_form_options?.transcription_model_options]);


 const setupDeepgram = useCallback(async () => {
    if (!chatData || !token) {
      throw new Error("Missing chat data or token for Deepgram setup.");
    }

    // Disconnect existing service if any
    deepgramServiceRef.current?.disconnect();

    return new Promise<void>((resolve, reject) => {
        const service = new DeepgramService(
            token,
            chatData.chat.id,
            chatData.chat.language_code,
            (text, isFinal) => {
                onTranscriptionResult(text, isFinal); // Let ChatScreen handle message state
            },
            (status) => {
                isDeepgramConnectedRef.current = (status === 'connected');
                 if (status === 'connected') {
                    console.log('Deepgram connected');
                    resolve(); // Resolve promise on successful connection
                } else if (status === 'error' || status === 'closed') {
                     console.error('Deepgram connection failed or closed');
                     isDeepgramConnectedRef.current = false;
                     reject(new Error(`Deepgram connection status: ${status}`));
                 }
            },
            (errorMessage) => {
                console.error("Deepgram Error:", errorMessage);
                // Maybe call onMicrophoneError here?
                // onMicrophoneError('connection', true);
                reject(new Error(errorMessage)); // Reject promise on error
            }
        );

        deepgramServiceRef.current = service;
        console.log('Connecting to Deepgram');
        service.connect().catch(err => {
            console.error("Error initiating Deepgram connection:", err);
            reject(err); // Reject if the initial connect call fails
        });
    });
}, [token, chatData, onTranscriptionResult]);


  const sendAudioToSpeechToText = useCallback(async (audioUri: string, send: boolean = false) => {
    if (!chatData || !token) {
      console.error("Missing chatData or token for STT");
      return;
    }
    setIsTranscribing(true);

    try {
      const newPendingAudio = { audioUri, timestamp: Date.now() };
      pendingUserAudioRef.current = newPendingAudio;
      onPendingUserAudioChange(newPendingAudio);

      const base64Audio = await FileSystem.readAsStringAsync(audioUri, { encoding: FileSystem.EncodingType.Base64 });
      const formData = new FormData();
      formData.append('audio', base64Audio);
      formData.append('file_extension', Platform.OS === 'ios' ? '.wav' : '.m4a');
      formData.append('language', chatData.chat.language || '');
      formData.append('model', determineModel(transcriptionMode));
      formData.append('dialect', chatData.chat.dialect_code || '');

      const response = await fetch(TRANSCRIPTION_CLOUDFLARE_WORKER_URL, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('STT Error response body:', errorText);
        throw new Error(`Speech to text request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (data.text) {
        onTranscriptionResult(data.text, send);
      } else {
         console.warn("STT returned no text for URI:", audioUri);
      }
    } catch (error) {
      console.error('Error in speech to text:', error);
      pendingUserAudioRef.current = null;
      onPendingUserAudioChange(null);
    } finally {
      setIsTranscribing(false);
    }
  }, [
      chatData,
      token,
      determineModel,
      transcriptionMode,
      onTranscriptionResult,
      onPendingUserAudioChange
    ]);

  const monitorRecording = useCallback(async () => {
    const recordingInstance = recordingInstanceRef.current;
    if (!recordingInstance || typeof recordingInstance.getStatusAsync !== 'function') {
      console.log('Monitor: Recording not initialized or invalid.');
       if (monitoringIntervalRef.current) {
           clearInterval(monitoringIntervalRef.current);
           monitoringIntervalRef.current = null;
        }
      return;
    }

    try {
      const status = await recordingInstance.getStatusAsync();
      if (!status.isRecording) {
        console.log('Monitor: Recording not in progress.');
        // Stop monitoring if recording stopped unexpectedly
        if (monitoringIntervalRef.current) {
           clearInterval(monitoringIntervalRef.current);
           monitoringIntervalRef.current = null;
        }
        // Optionally update state if needed: setIsRecording(false);
        return;
      }

      if (status.metering !== undefined) {
        const level = status.metering;
        // VAD Threshold logic based on passed props
        const redemptionFrames = autoSendRef.current ? (autoSendThreshold * 10) : REDEMPTION_FRAMES_MANUAL;

        if (!isSpeakingRef.current) {
          if (level > POSITIVE_SPEECH_THRESHOLD) {
            console.log('Monitor: Speech started');
            isSpeakingRef.current = true;
            speechFrameCountRef.current = 1;
            silentFrameCountRef.current = 0;
          }
        } else {
          if (level > POSITIVE_SPEECH_THRESHOLD) {
            speechFrameCountRef.current++;
            silentFrameCountRef.current = 0;
          } else if (level < NEGATIVE_SPEECH_THRESHOLD) {
            silentFrameCountRef.current++;
            if (silentFrameCountRef.current >= redemptionFrames) {
              console.log(`Monitor: Speech ended - ${speechFrameCountRef.current} frames`);
              if (speechFrameCountRef.current >= MIN_SPEECH_FRAMES) {
                console.log('Monitor: Valid speech, stopping recording.');
                 if (monitoringIntervalRef.current) { // Stop monitor before calling stopRecording
                    clearInterval(monitoringIntervalRef.current);
                    monitoringIntervalRef.current = null;
                 }
                stopRecording(autoSendRef.current); // Pass autoSend status
              } else {
                console.log('Monitor: Speech too short, continuing.');
                isSpeakingRef.current = false;
                speechFrameCountRef.current = 0;
                silentFrameCountRef.current = 0;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error monitoring recording:', error);
       if (monitoringIntervalRef.current) {
         clearInterval(monitoringIntervalRef.current);
         monitoringIntervalRef.current = null;
       }
        // Potentially call onMicrophoneError('generic', true);
    }
  }, [autoSendThreshold, stopRecording]); // Remove autoSend from dependencies

  const startRecording = useCallback(async () => {
    if (isStartingRecordingRef.current) {
      console.log('Start recording already in progress.');
      return;
    }
    isStartingRecordingRef.current = true;
    triggerHaptic();

    if (!useNewVADSystem) {
      isSpeakingRef.current = false;
      silentFrameCountRef.current = 0;
      speechFrameCountRef.current = 0;
    }

    try {
       // Stop existing instance if any (safety check)
      if (recordingInstanceRef.current) {
        console.warn('startRecording: Found existing recording instance, stopping it first.');
        try {
          await recordingInstanceRef.current.stopAndUnloadAsync();
        } catch (err: any) {
          console.warn('Error stopping existing recording:', err);
          // Handle specific errors that indicate the recorder is in an invalid state
          if (err.message?.includes('Cannot unload a Recording that has not been prepared') ||
              err.message?.includes('Cannot unload a Recording that has already been unloaded')) {
            await recordingInstanceRef.current._cleanupForUnloadedRecorder({
              canRecord: false,
              durationMillis: 0,
              isRecording: false,
              isDoneRecording: false,
            });
          }
        } finally {
          recordingInstanceRef.current = null;
        }
      }

      // Pause any audio that is playing
      if (audioPlayerService.current?.isPlaying) {
        await audioPlayerService.current?.pauseSound();
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        onMicrophoneError('permission', true);
        throw new Error("Permission not granted");
      }

      if (transcriptionModel === 'deepgram') { // Check passed model prop
          if (!deepgramServiceRef.current || !isDeepgramConnectedRef.current) {
              console.log('Setting up Deepgram for recording');
              await setupDeepgram(); // Ensure setupDeepgram returns a promise resolving on connection
          }

        const options = {
          sampleRate: 16000, channels: 1, bitsPerSample: 16, audioSource: 6,
        };
        await LiveAudioStream.init(options);
        LiveAudioStream.on('data', data => {
          const audioBuffer = Buffer.from(data, 'base64');
          if (deepgramServiceRef.current && deepgramServiceRef.current.socket) {
            deepgramServiceRef.current.send(audioBuffer);
          } else {
             console.warn('Deepgram service or socket not available for sending audio');
             // Maybe stop stream here?
          }
        });
        await LiveAudioStream.start();
        setIsRecording(true);
      } else {
         const recordingOptions: Audio.RecordingOptions = {
            android: { extension: '.m4a', outputFormat: Audio.AndroidOutputFormat.MPEG_4, audioEncoder: Audio.AndroidAudioEncoder.AAC, sampleRate: 44100, numberOfChannels: 2, bitRate: 128000, },
            ios: { extension: '.wav', outputFormat: Audio.IOSOutputFormat.LINEARPCM, audioQuality: Audio.IOSAudioQuality.MAX, sampleRate: 16000, numberOfChannels: 1, bitRate: 256000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false, },
            isMeteringEnabled: true,
            web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
         };
        
        // Check for existing recording instances in the Audio module
        await Audio.getPermissionsAsync(); // Refresh permissions status

        const newRecording = new Audio.Recording();
        recordingInstanceRef.current = newRecording; // Assign to ref
        
        try {
          await newRecording.prepareToRecordAsync(recordingOptions);
          await newRecording.startAsync();
          setIsRecording(true);

          if (useNewVADSystem) {
            voiceRecognitionRef.current?.startListening();
          } else {
            if (monitoringIntervalRef.current) clearInterval(monitoringIntervalRef.current);
            monitoringIntervalRef.current = setInterval(monitorRecording, MONITORING_INTERVAL);
          }
        } catch (prepErr: any) {
          console.error('Failed to prepare or start recording:', prepErr);
          
          // Handle the "Only one Recording object can be prepared" error
          if (prepErr.message?.includes('Only one Recording object can be prepared')) {
            // Need to call unloadAudioRecorder on the native module to reset state
            try {
              // Access the ExponentAV native module and reset the recording state
              const ExponentAV = require('expo-av/build/ExponentAV').default;
              await ExponentAV.unloadAudioRecorder();
            } catch (unloadErr) {
              console.error('Failed to unload audio recorder:', unloadErr);
            }
            
            try {
              // Clean up the current recording instance
              if (recordingInstanceRef.current) {
                await recordingInstanceRef.current._cleanupForUnloadedRecorder({
                  canRecord: false,
                  durationMillis: 0,
                  isRecording: false,
                  isDoneRecording: false,
                });
              }
            } catch (cleanupErr) {
              console.error('Failed to cleanup recorder:', cleanupErr);
            }
          }
          
          // Re-throw to be caught by the outer catch block
          throw prepErr;
        }
      }
    } catch (err: any) {
      console.error('Failed to start recording', err);
      setIsRecording(false);
      
      // Ensure clean state
      if (recordingInstanceRef.current) {
        try {
          await recordingInstanceRef.current._cleanupForUnloadedRecorder({
            canRecord: false,
            durationMillis: 0,
            isRecording: false,
            isDoneRecording: false,
          });
        } catch (cleanupErr) {
          console.error('Error during cleanup:', cleanupErr);
        }
      }
      
      recordingInstanceRef.current = null; // Clear ref on error

      // Skip showing error modal for specific errors we can recover from silently
      const isRecoverable =
        err.message?.includes('Only one Recording object can be prepared') ||
        err.message?.includes('Cannot unload a Recording that has not been prepared') ||
        err.message?.includes('Cannot unload a Recording that has already been unloaded') ||
        err.message?.includes('Stop encountered an error: recording not stopped');

      if (!isRecoverable && !err.message?.includes('Permission')) {
        const errorType = err.message?.includes('initialization') || err.message?.includes('prepared')
            ? 'initialization'
            : err.message?.includes('connection')
            ? 'connection'
            : 'generic';
        onMicrophoneError(errorType, true);
      }
    } finally {
      isStartingRecordingRef.current = false;
    }
  }, [
      useNewVADSystem,
      audioPlayerService,
      onMicrophoneError,
      transcriptionModel,
      setupDeepgram,
      voiceRecognitionRef,
      monitorRecording, // Added dependency
    ]);

  const stopRecording = useCallback(async (send: boolean = false) => {
    triggerHaptic();
    isStartingRecordingRef.current = false; // Ensure start lock is released

     if (monitoringIntervalRef.current) { // Stop monitoring first
       clearInterval(monitoringIntervalRef.current);
       monitoringIntervalRef.current = null;
     }
     if (useNewVADSystem && voiceRecognitionRef.current) {
        voiceRecognitionRef.current.stopListening();
     }

    if (transcriptionModel === 'deepgram') {
      LiveAudioStream.stop();
      deepgramServiceRef.current?.finalize();
      // Deepgram sends results via callback in setupDeepgram, handled by onTranscriptionResult prop
      setIsRecording(false);
    } else {
      const instanceToStop = recordingInstanceRef.current;
      recordingInstanceRef.current = null; // Clear ref immediately

      if (!instanceToStop) {
        console.warn("stopRecording called but no recording instance found.");
        setIsRecording(false); // Ensure state is correct
        return;
      }

      setIsRecording(false); // Update state early for UI feedback

      try {
        console.log('Stopping and unloading Expo AV recording.');
        await instanceToStop.stopAndUnloadAsync();
        const uri = instanceToStop.getURI();

        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

        if (uri) {
           if (!useNewVADSystem) {
             if (speechFrameCountRef.current >= MIN_MANUAL_SPEECH_FRAMES) {
               await sendAudioToSpeechToText(uri, send);
             } else { console.log('No speech detected (manual stop).'); }
             isSpeakingRef.current = false; // Reset VAD state
             silentFrameCountRef.current = 0;
             speechFrameCountRef.current = 0;
           } else {
              await sendAudioToSpeechToText(uri, send);
           }
        } else {
           console.warn('Recording URI was null after stopping.');
        }
      } catch (err: any) {
        console.error('Failed to stop recording cleanly', err);

        // Handle specific "Stop encountered an error" case from the GitHub issue
        if (err.message?.includes('Stop encountered an error: recording not stopped')) {
          try {
            // Access the ExponentAV native module to reset recording state
            const ExponentAV = require('expo-av/build/ExponentAV').default;
            await ExponentAV.unloadAudioRecorder();
          } catch (unloadErr) {
            console.error('Failed to unload audio recorder:', unloadErr);
          }

          try {
            // Cleanup the unloaded recorder
            await instanceToStop._cleanupForUnloadedRecorder({
              canRecord: false,
              durationMillis: 0,
              isRecording: false,
              isDoneRecording: false,
            });
          } catch (cleanupErr) {
            console.error('Failed to cleanup unloaded recorder:', cleanupErr);
          }
        } else if (
          err.message?.includes('Cannot unload a Recording that has already been unloaded') ||
          err.message?.includes('Cannot unload a Recording that has not been prepared')
        ) {
          try {
            await instanceToStop._cleanupForUnloadedRecorder({
              canRecord: false,
              durationMillis: 0,
              isRecording: false,
              isDoneRecording: false,
            });
          } catch (cleanupErr) {
            console.error('Failed to cleanup unloaded recorder:', cleanupErr);
          }
        }
      }
    }
  }, [
      useNewVADSystem,
      transcriptionModel,
      sendAudioToSpeechToText,
      voiceRecognitionRef,
    ]);

  const cancelRecording = useCallback(async () => {
    triggerHaptic();
    isStartingRecordingRef.current = false; // Ensure start lock is released

    if (monitoringIntervalRef.current) { // Stop monitoring first
        clearInterval(monitoringIntervalRef.current);
        monitoringIntervalRef.current = null;
    }
    if (useNewVADSystem && voiceRecognitionRef.current) {
        voiceRecognitionRef.current.stopListening();
    }

    if (transcriptionModel === 'deepgram') {
      LiveAudioStream.stop();
      deepgramServiceRef.current?.finalize(); // Finalize to stop sending potentially?
      deepgramServiceRef.current?.disconnect(); // Disconnect cleanly
      deepgramServiceRef.current = null;
      isDeepgramConnectedRef.current = false;
      setIsRecording(false);
    } else {
      const instanceToCancel = recordingInstanceRef.current;
      recordingInstanceRef.current = null; // Clear ref immediately

      if (!instanceToCancel) {
         console.warn("cancelRecording called but no recording instance found.");
         setIsRecording(false); // Ensure state is correct
         return;
      }

      setIsRecording(false); // Update state early for UI feedback

      try {
        console.log('Cancelling and unloading Expo AV recording.');
        await instanceToCancel.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch (err: any) {
        console.error('Failed to cancel recording cleanly', err);

        // Handle the same errors as in stopRecording
        if (
          err.message?.includes('Stop encountered an error: recording not stopped') ||
          err.message?.includes('Cannot unload a Recording that has already been unloaded') ||
          err.message?.includes('Cannot unload a Recording that has not been prepared')
        ) {
          try {
            // Access the ExponentAV native module to reset recording state if needed
            const ExponentAV = require('expo-av/build/ExponentAV').default;
            await ExponentAV.unloadAudioRecorder();
          } catch (unloadErr) {
            console.error('Failed to unload audio recorder:', unloadErr);
          }

          try {
            // Cleanup the unloaded recorder
            await instanceToCancel._cleanupForUnloadedRecorder({
              canRecord: false,
              durationMillis: 0,
              isRecording: false,
              isDoneRecording: false,
            });
          } catch (cleanupErr) {
            console.error('Failed to cleanup unloaded recorder:', cleanupErr);
          }
        }
      }
    }
  }, [useNewVADSystem, transcriptionModel, voiceRecognitionRef]);


  return {
    startRecording,
    stopRecording,
    cancelRecording,
    isRecording, // Directly return state managed by the hook
    isTranscribing, // Directly return state managed by the hook
  };
} 
