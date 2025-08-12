// components/VoiceRecognition.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';

interface VoiceRecognitionProps {
  onTextResult?: (text: string) => void;
  onError?: (error: string) => void;
  silenceThreshold?: number;
  buttonStyle?: object;
  buttonTextStyle?: object;
  onSilenceDetected?: () => void;
}

const VoiceRecognition = React.forwardRef<any, VoiceRecognitionProps>(({
  onTextResult = () => {},
  onError,
  silenceThreshold = 6000,
  buttonStyle,
  buttonTextStyle,
  onSilenceDetected,
}, ref) => {
  const [isListening, setIsListening] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [silenceTimer, setSilenceTimer] = useState<NodeJS.Timeout | null>(null);
  const lastPartialResultTime = useRef<number>(Date.now());
  const [status, setStatus] = useState<string>('');
  const [currentVolume, setCurrentVolume] = useState<number>(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const volumeThreshold = 30;
  const consecutiveSilenceCount = useRef<number>(0);
  const maxConsecutiveSilence = 3;
  const [timeSinceLastResult, setTimeSinceLastResult] = useState<number>(0);
  
  useEffect(() => {
    // Configure voice recognition
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechError = onSpeechError;
    Voice.onSpeechPartialResults = onSpeechPartialResults;
    Voice.onSpeechVolumeChanged = onSpeechVolumeChanged;

    // Initialize Voice
    const initializeVoice = async () => {
      try {
        await Voice.destroy();
        await Voice.removeAllListeners();
        // For iOS, we'll handle audio session in startListening
      } catch (e) {
        console.error('Error initializing Voice:', e);
      }
    };

    initializeVoice();

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
      if (silenceTimer) clearTimeout(silenceTimer);
    };
  }, []);

  // Check for silence based on time since last partial result
  useEffect(() => {
    if (!isListening) return;

    const checkSilence = setInterval(() => {
      const timeSinceLastResult = Date.now() - lastPartialResultTime.current;
      setTimeSinceLastResult(timeSinceLastResult);
      
      // If currently speaking, reset the silence counter immediately
      if (isSpeaking) {
        consecutiveSilenceCount.current = 0;
        return;
      }
      
      console.log('timeSinceLastResult', timeSinceLastResult, "silenceThreshold", silenceThreshold);
      if (timeSinceLastResult > silenceThreshold && results.length > 0) {
        console.log(`Silence detected (${timeSinceLastResult}ms since last result)`);
        
        // Only handle silence after consecutive detections
        consecutiveSilenceCount.current += 1;
        if (consecutiveSilenceCount.current >= maxConsecutiveSilence) {
          handleSilenceDetected();
          consecutiveSilenceCount.current = 0;
        } else {
          console.log(`Waiting for more silence confirmation: ${consecutiveSilenceCount.current}/${maxConsecutiveSilence}`);
        }
      } else {
        consecutiveSilenceCount.current = 0;
      }
    }, 500); // Check every 500ms

    return () => clearInterval(checkSilence);
  }, [isListening, results, isSpeaking, silenceThreshold]);

  const handleSilenceDetected = async () => {
    // Call the silence detected callback if provided
    if (onSilenceDetected) {
      onSilenceDetected();
    }
    
    if (results.length > 0) {
      const finalText = results.join(' ');
      console.log('Auto-sending:', finalText);
      onTextResult(finalText);
    }
    
    await stopListening();
  };

  const startListening = async () => {
    try {
      setResults([]);
      lastPartialResultTime.current = Date.now();
      
      if (Platform.OS === 'ios') {
        // Fix the iOS audio session configuration
        await Voice.start('en-US', {
          category: 'playAndRecord',
          mode: 'default',
          options: ['defaultToSpeaker', 'allowBluetooth', 'mixWithOthers']
        });
      } else {
        // For Android, simple start
        await Voice.start('en-US');
      }
      
      setIsListening(true);
      setStatus('Listening...');
      console.log('Started listening');
    } catch (e) {
      console.error('start error:', e);
      onError?.(String(e));
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
      setIsListening(false);
      setStatus('');
      console.log('Stopped listening');
    } catch (e) {
      console.error('stop error:', e);
      onError?.(String(e));
    }
  };

  const onSpeechResults = (e: SpeechResultsEvent) => {
    if (e.value) {
      console.log('Final results:', e.value);
      setResults(e.value);
      lastPartialResultTime.current = Date.now();
    }
  };

  const onSpeechPartialResults = (e: SpeechResultsEvent) => {
    if (e.value) {
      console.log('Partial results:', e.value);
      setResults(e.value);
      lastPartialResultTime.current = Date.now();
      setStatus('Receiving speech...');
    }
  };

  const onSpeechError = (e: SpeechErrorEvent) => {
    console.error('Speech recognition error:', e);
    
    // Add 'no speech detected' error code to recoverable errors
    const recoverableErrors = [
      '7', 
      '5', 
      'network',
      'recognition_fail',  // Add this error code
    ];
    
    if (e.error && (
      recoverableErrors.some(code => JSON.stringify(e.error).includes(code)) ||
      JSON.stringify(e.error).includes('1110') // Add specific error code for no speech
    )) {
      console.log('Recoverable error detected, attempting to restart listening');
      
      // Attempt to restart after a short delay
      setTimeout(async () => {
        if (isListening) {
          try {
            await Voice.stop();
            await new Promise(resolve => setTimeout(resolve, 300));
            await startListening();
          } catch (restartError) {
            console.error('Failed to restart after error:', restartError);
            setIsListening(false);
            setStatus('Error occurred');
            onError?.(`Failed to recover: ${JSON.stringify(e.error)}`);
          }
        }
      }, 500);
    } else {
      // For non-recoverable errors, stop listening
      setIsListening(false);
      setStatus('Error occurred');
      onError?.(JSON.stringify(e.error));
    }
  };

  const onSpeechVolumeChanged = (e: any) => {
    const volume = e.value;
    setCurrentVolume(volume);
    
    // Update speaking status based on volume
    const speaking = volume > volumeThreshold;
    
    // Reset silence timer when speaking is detected
    if (speaking) {
      lastPartialResultTime.current = Date.now();
      consecutiveSilenceCount.current = 0; // Reset counter immediately when speaking
    }
    
    setIsSpeaking(speaking);
  };

  // Expose methods via ref
  React.useImperativeHandle(ref, () => ({
    startListening,
    stopListening,
    isListening,
    resetSilenceCounter: () => {
      consecutiveSilenceCount.current = 0;
      lastPartialResultTime.current = Date.now();
    }
  }));

  // For hidden component usage, we don't need to render UI elements
  if (!buttonStyle) {
    return null;
  }
});

export default VoiceRecognition;
