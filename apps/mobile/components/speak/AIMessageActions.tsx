import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faPlay, faPause, faLanguage, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { faTurtle } from '@fortawesome/pro-solid-svg-icons/faTurtle';
import PulsingButton from '../PulsingButton';
import { getIconSize } from '@/constants/Font';
import * as Haptics from 'expo-haptics';
import AudioPlayerService from '@/services/AudioPlayerService';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

interface AIMessageActionsProps {
  chatMode: string;
  isPlaying: boolean;
  isPlayingSlowAudio: boolean;
  hasTranslation: boolean;
  audioUrl: string;
  wordTimings: any;
  chatMessageId: string;
  content: string;
  slowAudioUrl: string | null;
  audioPlayerService: AudioPlayerService;
  chatId: number;
  language: string;
  voice: string;
  voice_provider: string;
  targetLanguage: string;
  highlightMode: 'word' | 'sentence' | 'off';
  onPlayingChange: (messageId: string | null) => void;
  onPlayingSlowChange: (messageId: string | null) => void;
  onTranslationChange: (messageId: string, translation: string) => void;
  onSlowAudioChange: (messageId: string, url: string) => void;
  colorScheme: 'light' | 'dark';
  isTextRevealed?: boolean;
  onToggleVisibility?: () => void;
  isListenFirst?: boolean;
  onTranslationModalOpen: (translation: string, originalText: string) => void;
  isRecording?: boolean;
  onCancelRecording?: () => void;
}

const triggerHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

const AIMessageActions: React.FC<AIMessageActionsProps> = ({
  chatMode,
  isPlaying,
  isPlayingSlowAudio,
  hasTranslation,
  audioUrl,
  wordTimings,
  chatMessageId,
  content,
  slowAudioUrl,
  audioPlayerService,
  chatId,
  language,
  voice,
  voice_provider,
  targetLanguage,
  highlightMode,
  onPlayingChange,
  onPlayingSlowChange,
  onTranslationChange,
  onSlowAudioChange,
  colorScheme,
  isTextRevealed = true,
  onToggleVisibility,
  isListenFirst = false,
  onTranslationModalOpen,
  isRecording,
  onCancelRecording
}) => {
  const { token } = useAuth();

  const { playText, stopAudio, pauseAudio, cleanup, audioStates } = useTextToSpeech({
    language,
    voice,
    voice_provider,
    audioPlayerService
  });

  const isTTSPlaying = !!audioStates[content]?.isPlaying;
  const isTTSPaused = !!audioStates[content]?.isPaused;

  const handlePlayAudio = async () => {
    triggerHaptic();
    if (isRecording && onCancelRecording) {
      onCancelRecording();
    }

    try {
      if (audioUrl !== null) {
        if (isPlaying) {
          await audioPlayerService.pauseSound();
          onPlayingChange(null);
        } else {
          console.log('audioUrl', audioUrl);
          if (audioUrl !== null) {
            const newSound = await audioPlayerService.playSound(
              audioUrl,
              wordTimings,
              chatMessageId,
              false,
              highlightMode,
              content,
              (status) => {
                if (status.isLoaded) {
                  if (status.didJustFinish || !status.isPlaying) {
                    onPlayingChange(null);
                  } else if (status.isPlaying) {
                    onPlayingChange(chatMessageId);
                  }
                } else {
                  onPlayingChange(null);
                }
              }
            );
          } else {
            playText(content);
          }
        }
      } else {
        if (isTTSPlaying) {
          await pauseAudio(content);
          onPlayingChange(null);
        } else if (isTTSPaused) {
          await playText(content);
          onPlayingChange(chatMessageId);
        } else {
          await playText(content);
          onPlayingChange(chatMessageId);
        }
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      onPlayingChange(null);
    }
  };

  const handlePlaySlowAudio = async () => {
    triggerHaptic();
    if (isRecording && onCancelRecording) {
        onCancelRecording();
      }
    try {
      if (slowAudioUrl) {
        if (isPlayingSlowAudio) {
          await audioPlayerService.pauseSound();
          onPlayingSlowChange(null);
        } else {
          const newSound = await audioPlayerService.playSound(
            slowAudioUrl,
            wordTimings,
            chatMessageId,
            true,
            highlightMode,
            content,
            (status) => {
              if (status.isLoaded) {
                if (status.didJustFinish || !status.isPlaying) {
                  onPlayingSlowChange(null);
                } else if (status.isPlaying) {
                  onPlayingSlowChange(chatMessageId);
                }
              }
            }
          );
        }
      } else {
        const response = await fetch(`${API_URL}/api/v1/slow_audio`, {
          method: 'POST',
          headers: {
            'Authorization': token || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content_type: 'Chat',
            audio_url: audioUrl?.startsWith('file://') ? null : audioUrl,
            content_id: chatId,
            chat_message_id: chatMessageId,
            speed: 0.75
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to request slow audio');
        }

        const data = await response.json();
        onSlowAudioChange(chatMessageId, data.audio_url);
      }
    } catch (error) {
      console.error('Error with slow audio:', error);
      onPlayingSlowChange(null);
    }
  };

  const handleTranslate = async () => {
    triggerHaptic();
    if (isRecording && onCancelRecording) {
        onCancelRecording();
      }
    try {
      const response = await fetch('https://translation-worker.lythamlabs.workers.dev', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sentence: content,
          language: language,
          target_language: targetLanguage,
          translation_type: 'chat_message'
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      onTranslationChange(chatMessageId, data.translation);
      onTranslationModalOpen(data.translation, content);
    } catch (error) {
      console.error('Error translating message:', error);
    }
  };

  // Helper to merge styles for PulsingButton
  const getButtonStyle = () => {
    return colorScheme === 'dark'
      ? { ...styles.actionButton, ...styles.darkModeButton }
      : styles.actionButton;
  };

  return (
    <View style={styles.aiMessageActions}>
      {chatMode !== 'text_only' && (
        <>
          <PulsingButton
            onPress={handlePlayAudio}
            icon={<FontAwesomeIcon 
              icon={audioUrl !== null ? (isPlaying ? faPause : faPlay) : (isTTSPlaying ? faPause : faPlay)}
              size={getIconSize(16)}
              color={colorScheme === 'dark' ? '#fff' : '#00448f'}
            />}
            style={getButtonStyle()}
            isPulsing={false}
          />
          <PulsingButton
            onPress={handlePlaySlowAudio}
            icon={isPlayingSlowAudio ? (
              <FontAwesomeIcon 
                icon={faPause} 
                size={getIconSize(16)}
                color={colorScheme === 'dark' ? '#fff' : '#00448f'}
              />
            ) : (
              <FontAwesomeIcon 
                icon={faTurtle} 
                size={getIconSize(16)}
                color={colorScheme === 'dark' ? '#fff' : '#00448f'}
              />
            )}
            style={getButtonStyle()}
            isPulsing={false}
          />
        </>
      )}
      <PulsingButton
        onPress={handleTranslate}
        icon={<FontAwesomeIcon 
          icon={faLanguage} 
          size={getIconSize(16)}
          color={colorScheme === 'dark' ? '#fff' : '#00448f'}
        />}
        style={getButtonStyle()}
        isPulsing={false}
      />
      {isListenFirst && (
            <PulsingButton
              onPress={onToggleVisibility ? onToggleVisibility : () => {}}
              icon={<FontAwesomeIcon 
                icon={isTextRevealed ? faEye : faEyeSlash} 
                size={getIconSize(16)}
                color={colorScheme === 'dark' ? '#fff' : '#00448f'}
              />}
              style={getButtonStyle()}
              isPulsing={false}
            />
          )}
    </View>
  );
};

const styles = StyleSheet.create({
  aiMessageActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 1,
    marginLeft: 8,
    gap: 8,
    marginBottom: 0,
  },
  actionButton: {
    paddingVertical: 1,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 42,
    minHeight: 36,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    ...(Platform.OS === 'web' ? {
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer',
      ':hover': {
        transform: [{ translateY: -2 }],
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      ':active': {
        transform: [{ translateY: 1 }],
        shadowOpacity: 0.05,
      }
    } : {}),
  },
  darkModeButton: {
    backgroundColor: '#1a365d',
    borderColor: '#2d4ed8',
  },
});

export default AIMessageActions;
