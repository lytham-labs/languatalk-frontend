import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faPencil, faWandMagicSparkles, faLanguage, faEye, faEyeSlash, faPlay, faStop, faCheckCircle, faExclamationCircle, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import PulsingButton from '../PulsingButton';
import { getIconSize } from '@/constants/Font';
import * as Haptics from 'expo-haptics';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredAudioUri, removeAudioUri } from '@/services/AsyncAudioStorageService';
import AudioPlayerService from '@/services/AudioPlayerService';
import * as FileSystem from 'expo-file-system';

interface UserMessageActionsProps {
  correctionText?: string;
  hasTranslation: boolean;
  isAudioOnly: boolean;
  isTextRevealed: boolean;
  content: string;
  chatMessageId: string;
  colorScheme: 'light' | 'dark';
  onCorrection: () => void;
  onAlternativeResponse: () => void;
  onTranslate: () => void;
  onToggleVisibility: () => void;
  onTranslationModalOpen: (translation: string, originalText: string) => void;
  language: string;
  targetLanguage: string;
  audioPlayerService: AudioPlayerService;
  onPlayingChange: (messageId: string | null) => void;
  isPlaying?: boolean;
}

// Local helper to determine if the correction text contains mistakes
const hasMistakes = (correctionText: string): boolean => {
  return correctionText.includes('→') || correctionText.includes('<del>') || correctionText.includes('<ins>') || correctionText.includes('<b>');
};

const triggerHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

const UserMessageActions: React.FC<UserMessageActionsProps> = ({
  correctionText,
  isAudioOnly,
  isTextRevealed,
  content,
  chatMessageId,
  colorScheme,
  onCorrection,
  onAlternativeResponse,
  onToggleVisibility,
  onTranslationModalOpen,
  language,
  targetLanguage,
  audioPlayerService,
  onPlayingChange,
  isPlaying = false,
}) => {
  const { token } = useAuth();
  const [hasStoredAudio, setHasStoredAudio] = useState(false);

  // Check for stored audio on mount and when chatMessageId changes
  useEffect(() => {
    checkStoredAudio();
  }, [chatMessageId]);

  const checkStoredAudio = async () => {
    const uri = await getStoredAudioUri(chatMessageId);

    setHasStoredAudio(!!uri);
  };

  const handleCorrection = () => {
    triggerHaptic();
    onCorrection();
  };

  const handleAlternativeResponse = () => {
    triggerHaptic();
    onAlternativeResponse();
  };

  const handlePlayback = async () => {
    triggerHaptic();
    
    if (isPlaying) {
      await audioPlayerService.stopSound();
      onPlayingChange(null);
      return;
    }

    try {
      const audioUri = await getStoredAudioUri(chatMessageId);

      if (!audioUri) {
        handleAudioError();
        return;
      }

      const fileInfo = await FileSystem.getInfoAsync(audioUri);

      if (!fileInfo.exists) {
        handleAudioError();
        return;
      }

      if (audioPlayerService.isPlaying) {
        await audioPlayerService.stopSound();
      }

      const sound = await audioPlayerService.playSound(
        audioUri,
        null,
        chatMessageId,
        false,
        'off',
        '',
        (status) => {
          if (status.isLoaded) {
            if (status.isPlaying) {
              onPlayingChange(chatMessageId);
            } else {
              onPlayingChange(null);
            }
          } else if (!status.isLoaded && status.error) {
            handleAudioError();
          }
        }
      );
    } catch (error) {
      console.log('Error in handlePlayback:', error);
      onPlayingChange(null);
      handleAudioError();
    }
  };

  const handleAudioError = async () => {
    await removeAudioUri(chatMessageId);
    setHasStoredAudio(false);
   
    Alert.alert(
      'Audio Unavailable',
      'Your recording is no longer available. For privacy, we don’t save your recordings, which get stored locally based on your device settings.',
      [{ text: 'OK' }]
    );

    console.log(`Audio error for message ${chatMessageId}`);
  };

  const handleTranslate = async () => {
    triggerHaptic();
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
      onTranslationModalOpen(data.translation, content);
    } catch (error) {
      console.error('Error translating message:', error);
    }
  };

  const handleToggleVisibility = () => {
    triggerHaptic();
    onToggleVisibility();
  };

  return (
    <View style={styles.userMessageActions}>
      <View style={styles.correctionButtonContainer}>
        <PulsingButton
          onPress={handleCorrection}
          icon={<FontAwesomeIcon 
            icon={faPencil} 
            size={getIconSize(16)} 
            color={colorScheme === 'dark' ? '#fff' : '#00448f'}
          />}
          style={[
            styles.actionButton,
            colorScheme === 'dark' ? styles.darkModeButton : styles.lightModeButton,
          ]}
          isPulsing={false}
        />
        {correctionText ? (
          <View style={styles.correctionBadge}>
            {hasMistakes(correctionText) ? (
              <FontAwesomeIcon icon={faExclamationCircle} size={12} color="orange" />
            ) : (
              correctionText.length > 100 ? (
                correctionText.toLowerCase().includes("no major errors") ? (
                  <FontAwesomeIcon icon={faCheckCircle} size={12} color="green" />
                ) : (
                  <FontAwesomeIcon icon={faQuestionCircle} size={12} color="orange" />
                )
              ) : (
                <FontAwesomeIcon icon={faCheckCircle} size={12} color="green" />
              )
            )}
          </View>
        ) : null}
      </View>

      <PulsingButton
        onPress={handleAlternativeResponse}
        icon={<FontAwesomeIcon 
          icon={faWandMagicSparkles} 
          size={getIconSize(16)} 
          color={colorScheme === 'dark' ? '#fff' : '#00448f'}
        />}
        style={[
          styles.actionButton,
          colorScheme === 'dark' ? styles.darkModeButton : styles.lightModeButton,
        ]}
        isPulsing={false}
      />

      <PulsingButton
        onPress={handleTranslate}
        icon={<FontAwesomeIcon 
          icon={faLanguage} 
          size={getIconSize(16)} 
          color={colorScheme === 'dark' ? '#fff' : '#00448f'}
        />}
        style={[
          styles.actionButton,
          colorScheme === 'dark' ? styles.darkModeButton : styles.lightModeButton,
        ]}
        isPulsing={false}
      />

      {isAudioOnly && (
        <PulsingButton
          onPress={handleToggleVisibility}
          icon={<FontAwesomeIcon 
            icon={isTextRevealed ? faEyeSlash : faEye} 
            size={getIconSize(16)} 
            color={colorScheme === 'dark' ? '#4B96FF' : '#00448f'}
          />}
          style={[
            styles.actionButton,
            colorScheme === 'dark' ? styles.darkModeButton : styles.lightModeButton,
          ]}
          isPulsing={false}
        />
      )}

      {hasStoredAudio && (
        <PulsingButton
          onPress={handlePlayback}
          icon={<FontAwesomeIcon 
            icon={isPlaying ? faStop : faPlay}
            size={getIconSize(16)} 
            color={colorScheme === 'dark' ? '#fff' : '#00448f'}
          />}
          style={[
            styles.actionButton,
            colorScheme === 'dark' ? styles.darkModeButton : styles.lightModeButton,
          ]}
          isPulsing={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  userMessageActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    marginRight: 8,
    gap: 8,
  },
  correctionButtonContainer: {
    position: 'relative',
  },
  correctionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 1,
  },
  actionButton: {
    paddingVertical: 8,
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
  lightModeButton: {
    backgroundColor: '#ffffff',
    borderColor: '#E2E8F0',
  },
  darkModeButton: {
    backgroundColor: '#1a365d',
    borderColor: '#2d4ed8',
  },
});

export default UserMessageActions;
