import React, { useRef } from 'react';
import { useAudioRecorder } from './useAudioRecorder';
import AudioPlayerService from '@/services/AudioPlayerService';
import { ChatData } from '@/types/chat';

interface AudioRecorderProps {
  token: string | null;
  chatData: ChatData | null;
  onRecordingStateChange: (isRecording: boolean) => void;
  onTranscriptionStateChange: (isTranscribing: boolean) => void;
  onMicrophoneError: (
    errorType: 'permission' | 'initialization' | 'connection' | 'generic',
    showModal: boolean
  ) => void;
  onTranscriptionResult: (text: string, sendImmediately: boolean) => void;
  useNewVADSystem: boolean;
  voiceRecognitionRef: React.RefObject<any>;
  transcriptionMode: string;
  transcriptionModel: string;
  onPendingUserAudioChange: (audio: { audioUri: string; timestamp: number; } | null) => void;
  autoSend: boolean;
  autoSendThreshold: number;
  audioPlayerService: AudioPlayerService;
}

export interface AudioRecorderHandle {
  startRecording: () => Promise<void>;
  stopRecording: (send?: boolean) => Promise<void>;
  cancelRecording: () => Promise<void>;
  isRecording: boolean;
  isTranscribing: boolean;
}

const AudioRecorder = React.forwardRef<AudioRecorderHandle, AudioRecorderProps>(
  (
    {
      token,
      chatData,
      onRecordingStateChange,
      onTranscriptionStateChange,
      onMicrophoneError,
      onTranscriptionResult,
      useNewVADSystem,
      voiceRecognitionRef,
      transcriptionMode,
      transcriptionModel,
      onPendingUserAudioChange,
      autoSend,
      autoSendThreshold,
      audioPlayerService,
    },
    ref
  ) => {
    const audioPlayerServiceRef = useRef(audioPlayerService);

    const {
      startRecording,
      stopRecording,
      cancelRecording,
      isRecording,
      isTranscribing,
    } = useAudioRecorder({
      token,
      chatData,
      audioPlayerService: audioPlayerServiceRef,
      onRecordingStateChange,
      onTranscriptionStateChange,
      onMicrophoneError,
      onTranscriptionResult,
      useNewVADSystem,
      voiceRecognitionRef,
      transcriptionMode,
      transcriptionModel,
      onPendingUserAudioChange,
      autoSend,
      autoSendThreshold,
    });

    // Expose methods via ref
    React.useImperativeHandle(ref, () => ({
      startRecording,
      stopRecording,
      cancelRecording,
      isRecording,
      isTranscribing,
    }));

    // This component doesn't render anything, it just provides functionality
    return null;
  }
);

export default AudioRecorder; 
