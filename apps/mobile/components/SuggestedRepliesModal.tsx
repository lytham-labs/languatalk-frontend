import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Modal, Dimensions, ScrollView, Animated, PanResponder, Platform, TouchableWithoutFeedback, ViewStyle } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faPlay, faPause, faLanguage, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/useColorScheme';
import PulsingButton from '@/components/PulsingButton';
import { API_URL } from '@/constants/api';
import * as FileSystem from 'expo-file-system';
import AudioPlayerService from '@/services/AudioPlayerService';
import SkeletonLoader from '@/components/SkeletonLoader';
import BottomUpWindow from '@/components/BottomUpWindow';
import { GlobalFontStyleSheet, getIconSize } from '@/constants/Font';
import SuggestedReplyRecordButton from '@/components/SuggestedReplyRecordButton';
import { InteractiveText } from '@/components/shared/InteractiveText';
import { RubyInteractiveText } from '@/components/shared/RubyInteractiveText';
import SlidingModal from '@/components/shared/SlidingModal';
import useDevice from '@/hooks/useDevice';
import { ProcessedMessageData } from '@/types/chat';

interface SuggestedRepliesModalProps {
  isVisible: boolean;
  onClose: () => void;
  suggestions: string[];
  processedSuggestions?: Partial<ProcessedMessageData>[];
  onSuggestionSelect: (suggestion: string) => void;
  language: string;
  targetLanguage: string;
  voice: string;
  voice_provider: string;
  token: string;
  audioPlayerService: AudioPlayerService;
  isLoading: boolean;
  isChatFlagged?: boolean;
  isUsingJapanesePronunciation?: boolean;
  onWordTranslated?: (word: string, translation: string) => void;
  onWordSaved?: (word: string, translation: string) => void;
}

const { height } = Dimensions.get('window');
const MAX_MODAL_HEIGHT = height * 0.9;
const DRAG_THRESHOLD = 50;

const SuggestedRepliesModal: React.FC<SuggestedRepliesModalProps> = ({
  isVisible,
  onClose,
  suggestions,
  processedSuggestions,
  onSuggestionSelect,
  language,
  targetLanguage,
  voice,
  voice_provider,
  token,
  audioPlayerService,
  isLoading,
  isChatFlagged = false,
  isUsingJapanesePronunciation = false,
  onWordTranslated,
  onWordSaved
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isAndroid = Platform.OS === 'android';
  const [suggestionStates, setSuggestionStates] = useState<{
    [key: string]: {
      translation?: string,
      audioUrl?: string,
      isPlaying?: boolean,
      isTranslating?: boolean,
      isLoadingAudio?: boolean,
      isRecording?: boolean
    }
  }>({});
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const { isTablet } = useDevice();

  const panY = useRef(new Animated.Value(0)).current;
  const translateY = panY.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0, 0, 1],
  });

  const resetPositionAnim = Animated.timing(panY, {
    toValue: 0,
    duration: 300,
    useNativeDriver: true,
  });

  const closeAnim = Animated.timing(panY, {
    toValue: DRAG_THRESHOLD,
    duration: 300,
    useNativeDriver: true,
  });

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dy > 0) {
        panY.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > DRAG_THRESHOLD) {
        closeAnim.start(onClose);
      } else {
        resetPositionAnim.start();
      }
    },
  })).current;

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSuggestionPlayAudio = async (suggestionText: string) => {
    if (!suggestionText) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const suggestionState = suggestionStates[suggestionText] || {};

    try {
      if (suggestionState.isPlaying) {
        await audioPlayerService.pauseSound();
        setSuggestionStates(prevStates => ({
          ...prevStates,
          [suggestionText]: {
            ...prevStates[suggestionText],
            isPlaying: false,
          },
        }));
        return;
      }

      if (suggestionState.audioUrl) {
        const newSound = await audioPlayerService.playSound(
          suggestionState.audioUrl,
          null,
          suggestionText,
          false,
          'off',
          suggestionText,
          (status: any) => {
            if (status.isLoaded) {
              if (status.didJustFinish || !status.isPlaying) {
                setSuggestionStates(prevStates => ({
                  ...prevStates,
                  [suggestionText]: {
                    ...prevStates[suggestionText],
                    isPlaying: false,
                  },
                }));
              } else if (status.isPlaying) {
                setSuggestionStates(prevStates => ({
                  ...prevStates,
                  [suggestionText]: {
                    ...prevStates[suggestionText],
                    isPlaying: true,
                  },
                }));
              }
            }
          }
        );
      } else {
        await fetchAndPlayAudio(suggestionText);
      }
    } catch (error) {
      console.error("Error handling audio:", error);
      setSuggestionStates(prevStates => ({
        ...prevStates,
        [suggestionText]: {
          ...prevStates[suggestionText],
          isPlaying: false,
        },
      }));
    }
  };

  const fetchAndPlayAudio = async (suggestionText: string) => {
    setSuggestionStates(prevStates => ({
      ...prevStates,
      [suggestionText]: {
        ...prevStates[suggestionText],
        isLoadingAudio: true,
      },
    }));

    try {
      const response = await fetch(
        `${API_URL}/api/v1/stream_text_to_speech`,
        {
          method: "POST",
          headers: {
            Authorization: `${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: suggestionText,
            language: language,
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
      const fileName = `suggestion_${Date.now()}.mp3`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // Process the byteArray directly without using String.fromCharCode(...byteArray)
      await FileSystem.writeAsStringAsync(
        fileUri,
        FileSystem.EncodingType.Base64 === 'base64'
          ? arrayBufferToBase64(byteArray.buffer)
          : btoa(chunkToBase64(byteArray)),
        { encoding: FileSystem.EncodingType.Base64 }
      );

      setSuggestionStates((prevStates) => ({
        ...prevStates,
        [suggestionText]: {
          ...prevStates[suggestionText],
          fileUri,
          alignmentData,
          isLoadingAudio: false,
        },
      }));

      playAudio(suggestionText, fileUri);
    } catch (error) {
      console.error("Error fetching audio:", error);
      setSuggestionStates(prevStates => ({
        ...prevStates,
        [suggestionText]: {
          ...prevStates[suggestionText],
          isLoadingAudio: false,
        },
      }));
    }
  };

  const playAudio = async (suggestionText: string, audioUrl: string) => {
    try {
      await audioPlayerService.playSound(
        audioUrl,
        null,
        suggestionText,
        false,
        'off',
        suggestionText,
        (status: any) => {
          if (status.isLoaded) {
            if (status.didJustFinish || !status.isPlaying) {
              setSuggestionStates(prevStates => ({
                ...prevStates,
                [suggestionText]: {
                  ...prevStates[suggestionText],
                  isPlaying: false,
                },
              }));
            } else if (status.isPlaying) {
              setSuggestionStates(prevStates => ({
                ...prevStates,
                [suggestionText]: {
                  ...prevStates[suggestionText],
                  isPlaying: true,
                },
              }));
            }
          }
        }
      );
    } catch (error) {
      console.error("Error playing audio:", error);
      setSuggestionStates(prevStates => ({
        ...prevStates,
        [suggestionText]: {
          ...prevStates[suggestionText],
          isPlaying: false,
        },
      }));
    }
  };

  const handleSuggestionTranslate = async (suggestionText: string) => {
    const suggestionState = suggestionStates[suggestionText] || {};

    if (!suggestionState.translation) {
      setSuggestionStates(prevStates => ({
        ...prevStates,
        [suggestionText]: {
          ...prevStates[suggestionText],
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
            sentence: suggestionText,
            language: language,
            target_language: targetLanguage,
            translation_type: 'sentence'
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to translate suggestion');
        }

        const data = await response.json();
        const translation = data.translation;

        setSuggestionStates(prevStates => ({
          ...prevStates,
          [suggestionText]: {
            ...prevStates[suggestionText],
            translation,
            isTranslating: false,
          },
        }));
      } catch (error) {
        console.error('Error translating suggestion:', error);
        setSuggestionStates(prevStates => ({
          ...prevStates,
          [suggestionText]: {
            ...prevStates[suggestionText],
            isTranslating: false,
          },
        }));
      }
    }
  };

  const [isRecording, setIsRecording] = useState(false);

  // Reset active suggestion when modal closes
  useEffect(() => {
    if (!isVisible) {
      setActiveSuggestionId(null);
    }
  }, [isVisible]);

  const handleWordLongPress = (suggestionText: string) => {
    setActiveSuggestionId(suggestionText);
  };

  const renderProcessedSuggestion = ({ item, originalText }: { item: Partial<ProcessedMessageData>, originalText: string }) => {
    const suggestionState = suggestionStates[originalText] || {};
    const isPlaying = suggestionState.isPlaying || false;
    const isTranslating = suggestionState.isTranslating || false;
    const isLoadingAudio = suggestionState.isLoadingAudio || false;
    const isDark = colorScheme === "dark";

    // Floating action button with glass effect
    const actionButtonStyle: ViewStyle = {
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginRight: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
      borderRadius: 16,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      minWidth: 48,
      backdropFilter: 'blur(10px)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    };

    return (
      <View className={`${isTablet ? 'mb-12' : 'mb-6'}`}>
        {/* Game-like card without level indicator */}
        <View 
        style={{
          shadowColor: isDark ? '#000' : '#2563eb',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 8,
        }}>
          {/* Main text with highlight effect - Interactive with Ruby text for Japanese when both flags are enabled */}
          <View className={`px-4 py-3 rounded-xl ${ 
            isDark ? 'bg-gray-700/50' : 'bg-blue-50/50'
          }`}>
            {isChatFlagged && typeof item === 'object' ? (
              <RubyInteractiveText 
                text={item}
                languageCode={language}
                targetLanguage={targetLanguage}
                colorScheme={isDark ? 'dark' : 'light'}
                onWordTranslated={onWordTranslated}
                onWordSaved={onWordSaved}
                suggestionId={originalText}
                activeSuggestionId={activeSuggestionId}
                onWordLongPress={() => handleWordLongPress(originalText)}
              />
            ) : (
              <InteractiveText 
                text={originalText || ''}
                languageCode={language || 'english'}
                targetLanguage={targetLanguage || 'english'}
                colorScheme={isDark ? 'dark' : 'light'}
                onWordTranslated={onWordTranslated}
                onWordSaved={onWordSaved}
                suggestionId={originalText || ''}
                activeSuggestionId={activeSuggestionId}
                onWordLongPress={() => handleWordLongPress(originalText)}
              />
            )}
          </View>

          {/* Translation with slide animation - Non-interactive */}
          {suggestionState.translation && (
            <View className="mt-3 px-4">
              <Text 
                style={[
                  GlobalFontStyleSheet.textBase,
                  { lineHeight: 28 }
                ]}
                className={`${isDark ? 'text-gray-200' : 'text-gray-600'}`}
              >
                {suggestionState.translation}
              </Text>
            </View>
          )}

          {/* Interactive buttons */}
          <View className="flex-row mt-4 items-center justify-between">
            <View className="flex-row space-x-2">
              {/* Play button */}
              <PulsingButton
                onPress={() => {
                  triggerHaptic();
                  handleSuggestionPlayAudio(originalText);
                }}
                icon={
                  <View className={`flex-row items-center rounded-2xl ${
                    isPlaying ? 'bg-blue-500/20' : ''
                  }`}>
                    <FontAwesomeIcon 
                      icon={isPlaying ? faPause : faPlay} 
                      size={isTablet ? getIconSize(16) : getIconSize(20)} 
                      color={isDark ? "#fff" : "#1a2b3c"} 
                    />
                  </View>
                }
                isPulsing={isLoadingAudio}
                style={actionButtonStyle}
              />

              {/* Translate button */}
              {!suggestionState.translation && (
                <PulsingButton
                  onPress={() => {
                    triggerHaptic();
                    handleSuggestionTranslate(originalText);
                  }}
                  icon={
                    <View className="flex-row items-center">
                      <FontAwesomeIcon 
                        icon={faLanguage} 
                        size={getIconSize(22)} 
                        color={isDark ? "#fff" : "#00448f"}
                      />
                    </View>
                  }
                  isPulsing={isTranslating}
                  style={actionButtonStyle}
                />
              )}
            </View>

            {/* Record button */}
            <SuggestedReplyRecordButton
              onStartRecording={() => {
                triggerHaptic();
                setSuggestionStates(prevStates => ({
                  ...prevStates,
                  [originalText]: { ...prevStates[originalText], isRecording: true }
                }));
              }}
              onStopRecording={() => {
                triggerHaptic();
                setSuggestionStates(prevStates => ({
                  ...prevStates,
                  [originalText]: { ...prevStates[originalText], isRecording: false, isCompleted: true }
                }));
                onSuggestionSelect(originalText);
              }}
              isRecording={suggestionState.isRecording || false}
              isCompleted={suggestionState.isCompleted || false}
              variant="suggestion"
            />
          </View>
        </View>
      </View>
    );
  };

  const renderSuggestion = ({ item }: { item: string }) => {
    const suggestionState = suggestionStates[item] || {};
    const isPlaying = suggestionState.isPlaying || false;
    const isTranslating = suggestionState.isTranslating || false;
    const isLoadingAudio = suggestionState.isLoadingAudio || false;
    const isDark = colorScheme === "dark";

    // Floating action button with glass effect
    const actionButtonStyle: ViewStyle = {
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginRight: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
      borderRadius: 16,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      minWidth: 48,
      backdropFilter: 'blur(10px)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    };

    return (
      <View className={`${isTablet ? 'mb-12' : 'mb-6'}`}>
        {/* Game-like card without level indicator */}
        <View 
        style={{
          shadowColor: isDark ? '#000' : '#2563eb',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 8,
        }}>
          {/* Main text with highlight effect - Interactive */}
          <View className={`px-4 py-3 rounded-xl ${
            isDark ? 'bg-gray-700/50' : 'bg-blue-50/50'
          }`}>
            <InteractiveText 
              text={item || ''}
              languageCode={language || 'english'}
              targetLanguage={targetLanguage || 'english'}
              colorScheme={isDark ? 'dark' : 'light'}
              onWordTranslated={onWordTranslated}
              onWordSaved={onWordSaved}
              suggestionId={item || ''}
              activeSuggestionId={activeSuggestionId}
              onWordLongPress={() => handleWordLongPress(item)}
            />
          </View>

          {/* Translation with slide animation - Non-interactive */}
          {suggestionState.translation && (
            <View className="mt-3 px-4">
              <Text 
                style={[
                  GlobalFontStyleSheet.textBase,
                  { lineHeight: 28 }
                ]}
                className={`${isDark ? 'text-gray-200' : 'text-gray-600'}`}
              >
                {suggestionState.translation}
              </Text>
            </View>
          )}

          {/* Interactive buttons */}
          <View className="flex-row mt-4 items-center justify-between">
            <View className="flex-row space-x-2">
              {/* Play button */}
              <PulsingButton
                onPress={() => {
                  triggerHaptic();
                  handleSuggestionPlayAudio(item);
                }}
                icon={
                  <View className={`flex-row items-center rounded-2xl ${
                    isPlaying ? 'bg-blue-500/20' : ''
                  }`}>
                    <FontAwesomeIcon 
                      icon={isPlaying ? faPause : faPlay} 
                      size={isTablet ? getIconSize(16) : getIconSize(20)} 
                      color={isDark ? "#fff" : "#1a2b3c"} 
                    />
                  </View>
                }
                isPulsing={isLoadingAudio}
                style={actionButtonStyle}
              />

              {/* Translate button */}
              {!suggestionState.translation && (
                <PulsingButton
                  onPress={() => {
                    triggerHaptic();
                    handleSuggestionTranslate(item);
                  }}
                  icon={
                    <View className="flex-row items-center">
                      <FontAwesomeIcon 
                        icon={faLanguage} 
                        size={getIconSize(22)} 
                        color={isDark ? "#fff" : "#00448f"}
                      />
                    </View>
                  }
                  isPulsing={isTranslating}
                  style={actionButtonStyle}
                />
              )}
            </View>

            {/* Record button */}
            <SuggestedReplyRecordButton
              onStartRecording={() => {
                triggerHaptic();
                setSuggestionStates(prevStates => ({
                  ...prevStates,
                  [item]: { ...prevStates[item], isRecording: true }
                }));
              }}
              onStopRecording={() => {
                triggerHaptic();
                setSuggestionStates(prevStates => ({
                  ...prevStates,
                  [item]: { ...prevStates[item], isRecording: false, isCompleted: true }
                }));
                onSuggestionSelect(item);
              }}
              isRecording={suggestionState.isRecording || false}
              isCompleted={suggestionState.isCompleted || false}
              variant="suggestion"
            />
          </View>
        </View>
      </View>
    );
  };

  const [isDataReady, setIsDataReady] = useState(false);

  useEffect(() => {
    if (isVisible && !isLoading && suggestions.length > 0) {
      // Add a small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setIsDataReady(true);
      }, 500);

      return () => clearTimeout(timer);
    } else {
      setIsDataReady(false);
    }
  }, [isVisible, isLoading, suggestions]);

  const renderContent = () => {
    if (isLoading || !isDataReady) {
      return (
        <View className="mb-2 mx-4">
          <SkeletonLoader
            styleType="default"
            sections={[
              { rows: 2, showTitle: false, showButton: true },
              { rows: 2, showTitle: false, showButton: true },
            ]}
          />
        </View>
      );
    }

    // Always iterate over suggestions array for consistency
    const hasValidProcessedSuggestions = isChatFlagged && processedSuggestions && processedSuggestions.length > 0;
    
    // Debug logging
    console.log('SuggestedRepliesModal renderContent:', {
      isChatFlagged,
      suggestionsLength: suggestions.length,
      processedSuggestionsLength: processedSuggestions?.length || 0,
      hasValidProcessedSuggestions,
      language
    });

    return suggestions.map((suggestion, index) => {
      // Safety check: ensure we have valid suggestion data
      if (!suggestion || typeof suggestion !== 'string') {
        console.warn('Invalid suggestion at index', index, ':', suggestion);
        return null;
      }

      return (
        <View 
          key={index}
          className={index === suggestions.length - 1 ? "mb-5" : "mb-3 mt-3"}
        >
          {hasValidProcessedSuggestions && processedSuggestions[index]
            ? renderProcessedSuggestion({ 
                item: processedSuggestions[index], 
                originalText: suggestion 
              })
            : renderSuggestion({ item: suggestion })
          }
        </View>
      );
    }).filter(Boolean);
  };

  useEffect(() => {
    if (isVisible && scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [isVisible, contentHeight]);

  // Add cleanup effect when modal closes
  useEffect(() => {
    if (!isVisible) {
      const cleanup = async () => {
        await audioPlayerService.stopSound();
        setSuggestionStates(prevStates => {
          const newStates = { ...prevStates };
          Object.keys(newStates).forEach(key => {
            newStates[key] = {
              ...prevStates[key],
              isPlaying: false,
              isRecording: false,
              isCompleted: false
            };
          });
          return newStates;
        });
      };
      
      cleanup();
    }
  }, [isVisible]);

  if (isAndroid) {
    return (
      <BottomUpWindow
        isVisible={isVisible}
        onClose={onClose}
        content={
          <View className="flex-1">
            <View className="w-10 h-1 bg-gray-300 rounded self-center my-2" />
            <ScrollView
              ref={scrollViewRef}
              onContentSizeChange={(width, height) => {
                setContentHeight(height);
              }}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {renderContent()}
            </ScrollView>
          </View>
        }
      />
    );
  }

  return (
    <SlidingModal
      visible={isVisible}
      onClose={onClose}
    >
      <ScrollView
        ref={scrollViewRef}
        onContentSizeChange={(width, height) => {
          setContentHeight(height);
        }}
        contentContainerStyle={{ paddingBottom: 20 }}
        style={{ zIndex: 1002 }}
        className='pt-6'
      >
        {renderContent()}
      </ScrollView>
    </SlidingModal>
  );
};

// Add these helper functions at the end of your component or in a utility file
const chunkToBase64 = (byteArray: Uint8Array): string => {
  const CHUNK_SIZE = 1024; // Process 1KB at a time
  let result = "";

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

export default SuggestedRepliesModal;
