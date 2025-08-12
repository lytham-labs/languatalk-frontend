import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, ViewStyle, Pressable } from 'react-native';
import { getIconSize, GlobalFontStyleSheet } from '@/constants/Font';
import SlidingModal from '../shared/SlidingModal';
import { InteractiveText } from '../shared/InteractiveText';
import RubyInteractiveText from '../shared/RubyInteractiveText';
import { ProcessedMessage, ProcessedMessageData } from '@/types/chat';
import { useColorScheme } from '@/hooks/useColorScheme';
import cx from 'classnames';
import AudioPlayerService from '@/services/AudioPlayerService';
import { useAuth } from '@/contexts/AuthContext';
import { faPlay, faPause, faLanguage, faCheck, faPlus } from '@fortawesome/free-solid-svg-icons';
import PulsingButton from '../PulsingButton';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import * as Haptics from 'expo-haptics';
import { API_URL } from '@/constants/api';
import * as FileSystem from 'expo-file-system';
import SuggestedReplyRecordButton from '@/components/SuggestedReplyRecordButton';
import FlashcardService from '@/services/FlashcardService';
import useDevice from "@/hooks/useDevice"

interface AlternativeResponseModalProps {
  isVisible: boolean;
  onClose: () => void;
  onOpen?: () => void;
  alternativeResponse: string | Partial<ProcessedMessageData> | undefined;
  isLoading?: boolean;
  languageCode?: string;
  targetLanguage?: string;
  voice?: string;
  voice_provider?: string;
  onWordTranslated?: (word: string, translation: string) => void;
  onWordSaved?: (word: string, translation: string) => void;
  chatContextFlag?: boolean;
  japaneseReadingAidFlag?: boolean;
}

const triggerHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export default function AlternativeResponseModal({
  isVisible,
  onClose,
  onOpen,
  alternativeResponse,
  isLoading = false,
  languageCode,
  targetLanguage,
  voice,
  voice_provider,
  onWordTranslated,
  onWordSaved,
  chatContextFlag = false,
  japaneseReadingAidFlag = false
}: AlternativeResponseModalProps) {
  const colorScheme = useColorScheme();
  const { token: authToken } = useAuth();

  const alternativeResponseText = typeof alternativeResponse === 'string' ? alternativeResponse : alternativeResponse?.lines?.map(line => line.text).join(' ') || '';
  
  // Create a ref for the audio player service to maintain instance across renders
  const audioPlayerRef = useRef<AudioPlayerService>(new AudioPlayerService());
  
  const [alternativeStates, setAlternativeStates] = useState<{
    [key: string]: {
      translation?: string,
      audioUrl?: string,
      isPlaying?: boolean,
      isTranslating?: boolean,
      isLoadingAudio?: boolean,
      isRecording?: boolean,
      isCompleted?: boolean,
      isAdding?: boolean,
      added?: boolean;
    }
  }>({});

  // Add a new state to track if translation should be shown
  const [showTranslation, setShowTranslation] = useState<{[key: string]: boolean}>({});

  // Define the style for the action button
  const { isTablet } = useDevice();
  const actionButtonStyle: ViewStyle = {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 12,
    backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minWidth: 48,
    borderWidth: 1,
    borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  };

  const handleAlternativePlayAudio = async (alternativeText: string) => {
    if (!alternativeText) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const alternativeState = alternativeStates[alternativeText] || {};

    try {
      if (alternativeState.isPlaying) {
        await audioPlayerRef.current.pauseSound();
        setAlternativeStates(prevStates => ({
          ...prevStates,
          [alternativeText]: {
            ...prevStates[alternativeText],
            isPlaying: false,
          },
        }));
        return;
      }

      if (alternativeState.audioUrl) {
        const newSound = await audioPlayerRef.current.playSound(
          alternativeState.audioUrl,
          null,
          alternativeText,
          false,
          'off',
          alternativeText,
          (status) => {
            if (status.isLoaded) {
              if (status.didJustFinish || !status.isPlaying) {
                setAlternativeStates(prevStates => ({
                  ...prevStates,
                  [alternativeText]: {
                    ...prevStates[alternativeText],
                    isPlaying: false,
                  },
                }));
              } else if (status.isPlaying) {
                setAlternativeStates(prevStates => ({
                  ...prevStates,
                  [alternativeText]: {
                    ...prevStates[alternativeText],
                    isPlaying: true,
                  },
                }));
              }
            }
          }
        );
      } else {
        await fetchAndPlayAudio(alternativeText);
      }
    } catch (error) {
      console.error("Error handling audio:", error);
      setAlternativeStates(prevStates => ({
        ...prevStates,
        [alternativeText]: {
          ...prevStates[alternativeText],
          isPlaying: false,
        },
      }));
    }
  };

  const fetchAndPlayAudio = async (alternativeText: string) => {
    setAlternativeStates(prevStates => ({
      ...prevStates,
      [alternativeText]: {
        ...prevStates[alternativeText],
        isLoadingAudio: true,
      },
    }));

    try {
      const response = await fetch(
        `${API_URL}/api/v1/stream_text_to_speech`,
        {
          method: "POST",
          headers: {
            Authorization: `${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: alternativeText,
            language: languageCode,
            voice: voice,
            voice_provider: voice_provider
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to fetch audio");

      // Get the text from the blob
      const blob = response._bodyBlob;
      const text = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blob);
      });

      // Process the text stream
      const lines = text.split('\n');
      let audioBytes = "";
      let alignmentData = {
        chars: [],
        charStartTimesMs: [],
        charEndTimesMs: [],
        charDurationsMs: []
      };

      // Process each line
      for (const line of lines) {
        if (line.trim()) {
          try {
            const responseDict = JSON.parse(line);
            if (responseDict.audio_base64) {
              const audioBytesChunk = atob(responseDict.audio_base64);
              audioBytes += audioBytesChunk;
            }

            if (responseDict.alignment) {
              alignmentData.chars.push(...responseDict.alignment.characters);
              alignmentData.charStartTimesMs.push(
                ...responseDict.alignment.character_start_times_seconds.map(
                  (time: number) => time * 1000
                )
              );
              alignmentData.charEndTimesMs.push(
                ...responseDict.alignment.character_end_times_seconds.map(
                  (time: number) => time * 1000
                )
              );
              alignmentData.charDurationsMs = alignmentData.charEndTimesMs.map(
                (endTime, i) => endTime - alignmentData.charStartTimesMs[i]
              );
            }
          } catch (e) {
            console.error('Error parsing JSON line:', e);
          }
        }
      }

      // Convert accumulated audioBytes to Uint8Array
      const byteArray = new Uint8Array(audioBytes.length);
      for (let i = 0; i < audioBytes.length; i++) {
        byteArray[i] = audioBytes.charCodeAt(i);
      }

      // Save the audio file
      const fileName = `alternative_${Date.now()}.mp3`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // Process the byteArray directly without using String.fromCharCode(...byteArray)
      await FileSystem.writeAsStringAsync(
        fileUri,
        FileSystem.EncodingType.Base64 === 'base64'
          ? arrayBufferToBase64(byteArray.buffer)
          : btoa(chunkToBase64(byteArray)),
        { encoding: FileSystem.EncodingType.Base64 }
      );

      if (!response.ok) throw new Error("Failed to fetch audio");

      setAlternativeStates(prevStates => ({
        ...prevStates,
        [alternativeText]: {
          ...prevStates[alternativeText],
          audioUrl: fileUri,
          isLoadingAudio: false,
        }
      }));

      playAudio(alternativeText, fileUri);
    } catch (error) {
      console.error("Error fetching audio:", error);
      setAlternativeStates(prevStates => ({
        ...prevStates,
        [alternativeText]: {
          ...prevStates[alternativeText],
          isLoadingAudio: false,
        },
      }));
    }
  };

  const playAudio = async (alternativeText: string, audioUrl: string) => {
    try {
      await audioPlayerRef.current.playSound(
        audioUrl,
        null,
        alternativeText,
        false,
        'off',
        alternativeText,
        (status) => {
          if (status.isLoaded) {
            if (status.didJustFinish || !status.isPlaying) {
              setAlternativeStates(prevStates => ({
                ...prevStates,
                [alternativeText]: {
                  ...prevStates[alternativeText],
                  isPlaying: false,
                },
              }));
            } else if (status.isPlaying) {
              setAlternativeStates(prevStates => ({
                ...prevStates,
                [alternativeText]: {
                  ...prevStates[alternativeText],
                  isPlaying: true,
                },
              }));
            }
          }
        }
      );
    } catch (error) {
      console.error("Error playing audio:", error);
      setAlternativeStates(prevStates => ({
        ...prevStates,
        [alternativeText]: {
          ...prevStates[alternativeText],
          isPlaying: false,
        },
      }));
    }
  };

  const handleAlternativeTranslate = async (alternativeText: string) => {
    triggerHaptic();
    const alternativeState = alternativeStates[alternativeText] || {};

    if (!alternativeState.translation) {
      setAlternativeStates(prevStates => ({
        ...prevStates,
        [alternativeText]: {
          ...prevStates[alternativeText],
          isTranslating: true,
        },
      }));
      try {
        const response = await fetch('https://translation-worker.lythamlabs.workers.dev', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sentence: alternativeText,
            language: languageCode,
            target_language: targetLanguage,
            translation_type: 'sentence'
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to translate alternative');
        }

        const data = await response.json();
        const translation = data.translation;

        setAlternativeStates(prevStates => ({
          ...prevStates,
          [alternativeText]: {
            ...prevStates[alternativeText],
            translation,
            isTranslating: false,
          },
        }));
        // Set showTranslation to true when translate button is clicked
        setShowTranslation(prev => ({
          ...prev,
          [alternativeText]: true
        }));
      } catch (error) {
        console.error('Error translating alternative:', error);
        setAlternativeStates(prevStates => ({
          ...prevStates,
          [alternativeText]: {
            ...prevStates[alternativeText],
            isTranslating: false,
          },
        }));
      }
    } else {
      // If translation exists, just show it
      setShowTranslation(prev => ({
        ...prev,
        [alternativeText]: true
      }));
    }
  };

  const handleSayItStart = (alternativeText: string) => {
    triggerHaptic();
    setAlternativeStates(prevStates => ({
      ...prevStates,
      [alternativeText]: {
        ...prevStates[alternativeText],
        isRecording: true,
      },
    }));
  };

  const handleSayItStop = (alternativeText: string) => {
    triggerHaptic();
    setAlternativeStates(prevStates => ({
      ...prevStates,
      [alternativeText]: {
        ...prevStates[alternativeText],
        isRecording: false,
        isCompleted: true,
      },
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Add delay before closing modal
    setTimeout(() => {
      onClose();
    }, 750); // 1 second delay
  };

  const handleAddAlternativeToVocab = async () => {
    if (!authToken || !alternativeResponse) return;
    // Create a flashcard service instance using the auth token
    const flashcardService = new FlashcardService(authToken);
    let translation = alternativeStates[alternativeResponseText]?.translation;
    
    // If no translation is available, fetch one silently
    if (!translation) {
      try {
        setAlternativeStates(prev => ({
          ...prev,
          [alternativeResponseText]: {
            ...prev[alternativeResponseText],
            isAdding: true, // Only show the loading state on the add button
          }
        }));
        const response = await fetch('https://translation-worker.lythamlabs.workers.dev', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sentence: alternativeResponseText,
            language: languageCode,
            target_language: targetLanguage,
            translation_type: 'sentence'
          }),
        });
        if (!response.ok) {
          throw new Error('Failed to translate alternative response');
        }
        const data = await response.json();
        translation = data.translation;
        setAlternativeStates(prev => ({
          ...prev,
          [alternativeResponseText]: {
            ...prev[alternativeResponseText],
            translation,
            isAdding: true,
          }
        }));
      } catch (error) {
        console.error('Error translating alternative response:', error);
        setAlternativeStates(prev => ({
          ...prev,
          [alternativeResponseText]: {
            ...prev[alternativeResponseText],
            isAdding: false,
          }
        }));
        return;
      }
    }
    
    // Add the sentence as a flashcard
    try {
      await flashcardService.addFlashcard({
        front: alternativeResponseText,
        back: translation!,
        language: languageCode!,
        flashcard_type: 'sentence',
        tags: ['sentence'],
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAlternativeStates(prev => ({
        ...prev,
        [alternativeResponseText]: {
          ...prev[alternativeResponseText],
          isAdding: false,
          added: true,
        }
      }));
    } catch (err) {
      console.error('Error adding alternative sentence to vocab:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setAlternativeStates(prev => ({
        ...prev,
        [alternativeResponseText]: {
          ...prev[alternativeResponseText],
          isAdding: false,
        }
      }));
    }
  };

  useEffect(() => {
    if (isVisible && onOpen) {
      onOpen();
    }
  }, [isVisible, onOpen]);

  useEffect(() => {
    if (!isVisible) {
      audioPlayerRef.current.stopSound();
      setAlternativeStates(prevStates => ({
        ...prevStates,
        [alternativeResponseText]: {
          ...prevStates[alternativeResponseText],
          isPlaying: false,
        }
      }));
    }
  }, [isVisible, alternativeResponse]);

  return (
    <SlidingModal 
      visible={isVisible} 
      onClose={onClose}
    >
      <View className={cx(
        "p-2 rounded-t-3xl",
        colorScheme === 'dark' ? 'bg-gray-800' : 'bg-white'
      )}>
        <Text className=" font-semibold text-gray-400 pb-5" style={GlobalFontStyleSheet.textBase}>
          Alternative phrasing
        </Text>
        {isLoading ? (
          <View className="items-center justify-center py-8">
            <ActivityIndicator size="large" color="#00448f" />
            <Text 
              style={GlobalFontStyleSheet.textMd} 
              className={cx(
                "mt-4",
                colorScheme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              )}
            >
              Getting alternative response...
            </Text>
          </View>
        ) : (
          <View className={cx(
            "mb-6 p-4 rounded-xl",
            colorScheme === 'dark' ? 'bg-gray-700/50 ' : 'bg-blue-50/40'
          )}>

              { (!chatContextFlag || typeof alternativeResponse === 'string') &&
                  <InteractiveText
                    text={typeof alternativeResponse === 'string' ? alternativeResponse : ''}
                    languageCode={languageCode}
                    targetLanguage={targetLanguage}
                    colorScheme={colorScheme || 'light'}
                    onWordTranslated={onWordTranslated}
                    onWordSaved={onWordSaved}
                  />
              }
              { chatContextFlag && typeof alternativeResponse !== 'string' && alternativeResponse &&
                  <RubyInteractiveText 
                    text={alternativeResponse}
                    languageCode={languageCode}
                    targetLanguage={targetLanguage}
                    colorScheme={colorScheme || 'light'}
                    onWordTranslated={onWordTranslated}
                    onWordSaved={onWordSaved}
                  />
                }
            

            {/* Only show translation if showTranslation is true for this response */}
            {showTranslation[alternativeResponseText] && alternativeStates[alternativeResponseText]?.translation && (
              <InteractiveText
                text={alternativeStates[alternativeResponseText]?.translation || ''}
                languageCode={targetLanguage}
                targetLanguage={languageCode}
                colorScheme={colorScheme || 'light'}
                onWordTranslated={onWordTranslated}
                onWordSaved={onWordSaved}
                textSize="base"
                lineHeight={26}
                tailwindClassName={cx(
                  "mt-4",
                  colorScheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}
              />
            )}
                
        </View>
        )}
        </View>
            <View className={`flex-row space-x-2  ${isTablet ? 'justify-center' : 'justify-between'}`}>
                {/* Play button */}
                <View className="flex-row w-1/3">
                    <PulsingButton
                        onPress={() => {
                        triggerHaptic();
                        handleAlternativePlayAudio(alternativeResponseText);
                        }}
                        icon={
                        <View className={`flex-row items-center rounded-2xl 
                            
                        }`}>
                            <FontAwesomeIcon 
                            icon={alternativeStates[alternativeResponseText]?.isPlaying ? faPause : faPlay} 
                            size={getIconSize(20)} 
                            color={colorScheme === 'dark' ? "#fff" : "#1a2b3c"} 
                            />
                        </View>
                        }
                        isPulsing={alternativeStates[alternativeResponseText]?.isLoadingAudio || false }
                        style={actionButtonStyle}
                    />

                    {/* Translate button */}
                    {!showTranslation[alternativeResponseText] && (
                        <PulsingButton
                        onPress={() => {
                            triggerHaptic();
                            handleAlternativeTranslate(alternativeResponseText);
                        }}
                        icon={
                            <View className="flex-row items-center">
                            <FontAwesomeIcon 
                                icon={faLanguage} 
                                size={getIconSize(22)} 
                                color={colorScheme === 'dark' ? "#fff" : "#00448f"}
                            />
                            </View>
                        }
                        isPulsing={alternativeStates[alternativeResponseText]?.isTranslating || false}
                        style={actionButtonStyle}
                        />
                    )}
                </View>
                {/* NEW: Add to Vocab button */}
                <View className="flex-row justify-end items-center px-3">
                    {alternativeStates[alternativeResponseText]?.added ? (
                        <View className="bg-green-500/80 p-5 rounded-2xl ">
                            <FontAwesomeIcon icon={faCheck} size={16} color="#fff" />
                    </View>
                ) : (
                    <Pressable 
                        onPress={handleAddAlternativeToVocab}
                        className={`${alternativeStates[alternativeResponseText]?.isAdding ? 'bg-gray-400' : 'bg-[#FC5D5D]/80'} p-4 rounded-2xl`}
                        disabled={alternativeStates[alternativeResponseText]?.isAdding}
                    >
                        {alternativeStates[alternativeResponseText]?.isAdding ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <FontAwesomeIcon icon={faPlus} size={24} color="#fff" />
                        )}
                    </Pressable>
                )}
                </View>
                
                {/* Say It button using SuggestedReplyRecordButton */}
                <View className="flex-row justify-end ">
                    <SuggestedReplyRecordButton
                    onStartRecording={() => handleSayItStart(alternativeResponseText)}
                    onStopRecording={() => handleSayItStop(alternativeResponseText)}
                    isRecording={alternativeStates[alternativeResponseText]?.isRecording || false}
                    isCompleted={alternativeStates[alternativeResponseText]?.isCompleted || false}
                    variant="alternate"
                    />
                </View>
                
            </View>
    </SlidingModal>
  );
}

// Add these helper functions at the end of your component or in a utility file
const chunkToBase64 = (byteArray: Uint8Array): string => {
  const CHUNK_SIZE = 1024; // Process 1KB at a time
  let result = '';

  for (let i = 0; i < byteArray.length; i += CHUNK_SIZE) {
    const chunk = byteArray.slice(i, i + CHUNK_SIZE);
    result += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }

  return result;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;

  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
};
