import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Dimensions, ActivityIndicator, FlatList, StyleSheet, Alert, Pressable, ScrollView, Animated } from 'react-native';
import cx from 'classnames';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { getIconSize, GlobalFontStyleSheet } from '@/constants/Font';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faEye, faEyeSlash, faBookmark as faBookmarkSolid, faPlus, faCheck, faVolumeUp, faLanguage, faCircle } from '@fortawesome/free-solid-svg-icons';
import { getDeviceType } from '@/constants/Font';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/contexts/ActionCableWebSocketContext';
import FlashcardService from '@/services/FlashcardService';
import { faGameConsoleHandheld, faChevronDown, faChevronUp } from '@fortawesome/pro-solid-svg-icons';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

interface PhraseItem {
  phrase: string;
  translation?: string;
  saved?: boolean;
}

// New interface for user vocab items
interface UserVocabItem {
  front: string;
  back: string;
  id: string;
}

export interface PracticeVocabBeforeChatScreenProps {
  onStartChat: () => void;
  onBack: () => void;
  topicLabel: string;
  subtopicLabel: string;
  prompt: string;
  language?: string;
  level?: string;
  promptItems?: string[];
  voice?: string;
}

// Maximum number of vocabulary items to display
const MAX_VOCAB_ITEMS = 20;

/**
 * Screen shown before a chat begins when practice_vocab_before_chat is enabled
 */
const PracticeVocabBeforeChatScreen = ({
  onStartChat,
  onBack,
  topicLabel,
  subtopicLabel,
  prompt,
  promptItems = [],
  voice,
  language,
}: PracticeVocabBeforeChatScreenProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = Dimensions.get('window');
  const isTablet = width >= 768;
  
  const [loading, setLoading] = useState(true);
  const [phrases, setPhrases] = useState<PhraseItem[]>([]);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibleTranslations, setVisibleTranslations] = useState<{[key: number]: boolean}>({});
  const [savingPhrases, setSavingPhrases] = useState<{[key: number]: boolean}>({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [allSaved, setAllSaved] = useState(false);
  // New state for user vocab
  const [userVocab, setUserVocab] = useState<UserVocabItem[]>([]);
  const [loadingUserVocab, setLoadingUserVocab] = useState(false);
  const [showUserVocab, setShowUserVocab] = useState(false);
  const [hasUserVocab, setHasUserVocab] = useState(false);
  // Add a state to track visible translations for user vocab
  const [visibleUserTranslations, setVisibleUserTranslations] = useState<{[key: string]: boolean}>({});
  
  // References for scrolling
  const scrollViewRef = useRef<ScrollView>(null);
  const userVocabSectionRef = useRef<View>(null);
  
  const { token } = useAuth();
  const { connectWebSocket, closeWebSocket, onMessage, removeMessageListener } = useWebSocket();
  const flashcardService = React.useMemo(() => token ? new FlashcardService(token) : null, [token]);
  
  // Initialize text-to-speech hook
  const { playText, stopAudio, audioStates } = useTextToSpeech({
    language: language || '',
    voice: voice?.split('_')[0] || '',
    voice_provider: 'elevenlabs',
  });

  // Animation values
  const circleAnimation = useRef(new Animated.Value(0)).current;
  const particleAnimations = useRef(Array(8).fill(0).map(() => new Animated.Value(0))).current;

  const toggleTranslation = (index: number) => {
    setVisibleTranslations(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Add function to toggle user vocab translations
  const toggleUserTranslation = (id: string) => {
    setVisibleUserTranslations(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Function to toggle user vocab and scroll to it when shown
  const toggleUserVocab = () => {
    const newShowState = !showUserVocab;
    setShowUserVocab(newShowState);
    
    // If showing user vocab, scroll to it after a short delay to ensure renders complete
    if (newShowState) {
      setTimeout(() => {
        if (scrollViewRef.current && userVocabSectionRef.current) {
          userVocabSectionRef.current.measureLayout(
            // @ts-ignore - Known issue with ref types
            scrollViewRef.current,
            (_x: number, y: number) => {
              scrollViewRef.current?.scrollTo({ y, animated: true });
            },
            () => console.log('Measurement failed')
          );
        }
      }, 100);
    }
  };

  // Add function to fetch user's recent vocab
  const fetchRecentUserVocab = useCallback(async () => {
    if (!token || !flashcardService) {
      console.log("No token or flashcard service available");
      return;
    }
    
    try {
      setLoadingUserVocab(true);
      // Note: Adding type annotation to fix linter error
      const response = await flashcardService.getFlashcards({ 
        // @ts-ignore - We know these options exist in the API but might not be typed correctly
        limit: 20, // Request 20 items
        sort_by: 'created_at',
        sort_direction: 'desc'
      });
      
      if (response.flashcards && response.flashcards.length > 0) {
        // Ensure we only take the first MAX_VOCAB_ITEMS items
        const vocabItems = response.flashcards
          .slice(0, MAX_VOCAB_ITEMS)
          .map(card => ({
            front: card.front,
            back: card.back,
            id: `${card.id}`
          }));
        setUserVocab(vocabItems);
        setHasUserVocab(vocabItems.length > 0);
      } else {
        setHasUserVocab(false);
      }
    } catch (error) {
      console.error("Error fetching user vocabulary:", error);
      setHasUserVocab(false);
    } finally {
      setLoadingUserVocab(false);
    }
  }, [token, flashcardService]);

  // Call fetchRecentUserVocab when component mounts
  useEffect(() => {
    fetchRecentUserVocab();
  }, [fetchRecentUserVocab]);

  const saveAllPhrasesToVocab = async () => {
    if (isSavingAll) {
      console.log("Save operation already in progress");
      return;
    }
    
    try {
      setIsSavingAll(true);
      console.log("Saving all phrases to vocabulary");
      if (phrases.length === 0) {
        console.log("No phrases to save");
        return;
      }
      
      if (!token || !flashcardService) {
        console.error("No authentication token or flashcard service available");
        return;
      }

      const processedItems = new Set<string>();

      for (let index = 0; index < phrases.length; index++) {
        const item = phrases[index];
        
        if (item.saved || savingPhrases[index]) continue;
        
        const itemKey = `${item.phrase}:${item.translation || ''}`;
        if (processedItems.has(itemKey)) continue;
        processedItems.add(itemKey);
        
        setSavingPhrases(prev => ({ ...prev, [index]: true }));
        
        try {
          const response = await flashcardService.addFlashcard({
            front: item.phrase,
            back: item.translation || '',
            language: language || '',
            tags: ['phrase']
          });
          
          setPhrases(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], saved: true };
            return updated;
          });
          
          console.log("Phrase saved:", item.phrase);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const isDuplicateError = errorMessage.includes('already exists') || 
                                  errorMessage.includes('duplicate key') || 
                                  errorMessage.includes('unique constraint');
          
          if (isDuplicateError) {
            console.log(`Phrase "${item.phrase}" already exists in your flashcards`);
            setPhrases(prev => {
              const updated = [...prev];
              updated[index] = { ...updated[index], saved: true };
              return updated;
            });
          } else {
            console.error(`Error saving phrase "${item.phrase}":`, err);
          }
        } finally {
          setSavingPhrases(prev => ({ ...prev, [index]: false }));
        }
      }

      // Refresh user vocab after saving all
      fetchRecentUserVocab();

      // Play success animation
      setAllSaved(true);
      playSuccessAnimation();

    } catch (error) {
      console.error("Error in saveAllPhrasesToVocab:", error);
      // TODO: Add error UI feedback
    } finally {
      setIsSavingAll(false);
    }
  };

  // Function to play the success animation
  const playSuccessAnimation = () => {
    // Reset animations to start state
    circleAnimation.setValue(0);
    particleAnimations.forEach(anim => anim.setValue(0));
    
    // Animate circle to checkmark
    Animated.timing(circleAnimation, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true
    }).start();
    
    // Animate particles with slight delay
    particleAnimations.forEach((anim, index) => {
      Animated.sequence([
        Animated.delay(100 + (index * 30)), // Stagger the particles
        Animated.timing(anim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true
        })
      ]).start();
    });
  };
  
  // Render particles for success animation
  const renderParticles = () => {
    return particleAnimations.map((anim, index) => {
      const angle = (index / particleAnimations.length) * Math.PI * 2;
      
      // Calculate end point for particle
      const translateX = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, Math.cos(angle) * 30]
      });
      
      const translateY = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, Math.sin(angle) * 30]
      });
      
      const opacity = anim.interpolate({
        inputRange: [0, 0.7, 1],
        outputRange: [0, 1, 0]
      });
      
      const scale = anim.interpolate({
        inputRange: [0, 0.3, 1],
        outputRange: [0, 1, 0.5]
      });
      
      return (
        <Animated.View
          key={`particle-${index}`}
          style={[
            styles.particle,
            {
              transform: [
                { translateX },
                { translateY },
                { scale }
              ],
              opacity
            }
          ]}
        />
      );
    });
  };

  // Function to request vocab phrases
  const requestPhrases = useCallback(async () => {
    try {
      if (phrases.length > 0) {
        console.log("Phrases already loaded, skipping request");
        return;
      }
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_URL}/api/v1/pre_chat_practice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `${token}`,
        },
        body: JSON.stringify({
          promptItems,
          topic: promptItems[promptItems.length - 1],
          topic_category: promptItems[0],
          subtopic_category: promptItems.length > 1 ? promptItems[1] : null,
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.request_id) {
          setRequestId(data.request_id);
          // WebSocket will handle the response
        } else {
          setError('No request ID returned');
          setLoading(false);
        }
      } else {
        const errorData = await response.json();
        console.error("API error:", errorData);
        setError(errorData?.error || 'Error requesting practice phrases');
        setLoading(false);
      }
    } catch (err) {
      console.error("Request error:", err);
      setError('Error requesting practice phrases');
      setLoading(false);
    }
  }, [prompt, token, promptItems]);
  
  // Set up WebSocket connection
  useEffect(() => {
    if (token && phrases.length === 0) {
      // Connect to ActionCable channel for pre-chat practice
      connectWebSocket(-1, {
        name: 'PreChatPracticeChannel',
        params: {}
      });

      const handleWebSocketMessage = (event: MessageEvent) => {
        const data = event.data?.data || event.data;
        
        if (data.phrases) {
          // Initialize phrases with saved: false
          setPhrases(data.phrases.map((p: PhraseItem) => ({ ...p, saved: false })));
          setLoading(false);
        }
      };

      onMessage(-1, handleWebSocketMessage);

      return () => {
        removeMessageListener(-1, handleWebSocketMessage);
        closeWebSocket(-1, 'PreChatPracticeChannel');
      };
    }
  }, [token, connectWebSocket, onMessage, removeMessageListener, closeWebSocket]);
  
  // Start the request when component mounts
  useEffect(() => {
    requestPhrases();
  }, [requestPhrases]);

  // Play audio for a phrase
  const handlePlayAudio = async (text: string) => {
    // Stop any currently playing audio
    await stopAudio();
    // Play the new text
    playText(text);
  };

  // Render individual phrase item
  const renderPhraseItem = ({ item, index }: { item: PhraseItem; index: number }) => {
    const isTranslationVisible = visibleTranslations[index];
    const isSaving = savingPhrases[index];
    const isAudioLoading = audioStates[item.phrase]?.isLoading;
    const isAudioPlaying = audioStates[item.phrase]?.isPlaying;
    
    // Add a function to save individual phrase
    const savePhrase = async () => {
      if (item.saved || isSaving || !flashcardService) return;
      
      try {
        setSavingPhrases(prev => ({ ...prev, [index]: true }));
        await flashcardService.addFlashcard({
          front: item.phrase,
          back: item.translation || '',
          language: language || '',
          tags: ['phrase']
        });
        
        setPhrases(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], saved: true };
          return updated;
        });
        
        // Refresh user vocab after saving a phrase
        fetchRecentUserVocab();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const isDuplicateError = errorMessage.includes('already exists') || 
                                 errorMessage.includes('duplicate key') || 
                                 errorMessage.includes('unique constraint');
        
        if (isDuplicateError) {
          // Still mark as saved since it exists in the database
          setPhrases(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], saved: true };
            return updated;
          });
        } else {
          console.error(`Error saving phrase "${item.phrase}":`, err);
        }
      } finally {
        setSavingPhrases(prev => ({ ...prev, [index]: false }));
      }
    };
    
    return (
      <View style={[
        styles.vocabCard
      ]}
        className={cx(
          'bg-white dark:bg-gray-500 text-gray-500 dark:text-white items-center shadow-sm',
          isTablet ? 'rounded-3xl my-3 ' : 'rounded-lg my-2'
        )}
      >
        <View style={styles.vocabContent}>
          <Text 
            style={[
              GlobalFontStyleSheet.textBase, 
              isTablet && GlobalFontStyleSheet.textLg,
              { color: isDark ? '#FFFFFF' : '#1F2937' }
            ]}
          >
            {item.phrase}
          </Text>
          
          {item.translation && isTranslationVisible && (
            <Text 
              style={[
                GlobalFontStyleSheet.textMd, 
                isTablet && GlobalFontStyleSheet.textSm,
                { color: isDark ? '#E5E7EB' : '#374151', marginTop: 8, fontWeight: '300' }
              ]}
            >
              {item.translation}
            </Text>
          )}
        </View>
        
        <View style={styles.vocabActions}>
          <TouchableOpacity 
            onPress={() => handlePlayAudio(item.phrase)}
            style={[
              styles.vocabIcon,
            ]}
            disabled={isAudioLoading}
          >
            {isAudioLoading ? (
              <ActivityIndicator size="small" color={isDark ? '#D1D5DB' : '#4B5563'} />
            ) : (
              <FontAwesomeIcon 
                icon={faVolumeUp} 
                size={14} 
                color={isAudioPlaying ? '#FC5D5D' : isDark ? '#D1D5DB' : '#4B5563'} 
              />
            )}
          </TouchableOpacity>
          {item.translation && (
            <TouchableOpacity 
              onPress={() => toggleTranslation(index)}
              style={[
                styles.vocabIcon,
              ]}
            >
              <FontAwesomeIcon 
                icon={faLanguage} 
                size={14} 
                color={isTranslationVisible ? '#FC5D5D' : isDark ? '#D1D5DB' : '#4B5563'} 
              />
            </TouchableOpacity>
          )}

        </View>
      </View>
    );
  };
  
  // Render user vocab item
  const renderUserVocabItem = ({ item }: { item: UserVocabItem }) => {
    const isTranslationVisible = visibleUserTranslations[item.id];
    const isAudioLoading = audioStates[item.front]?.isLoading;
    const isAudioPlaying = audioStates[item.front]?.isPlaying;
    
    return (
      <View 
        style={[styles.vocabCard]}
        className={cx(
          'bg-white dark:bg-gray-500 text-gray-500 dark:text-white items-center shadow-sm',
          isTablet ? 'rounded-3xl my-3 ' : 'rounded-lg my-2'
        )}
      >
        <View style={styles.vocabContent}>
          <Text 
            style={[
              GlobalFontStyleSheet.textBase, 
              isTablet && GlobalFontStyleSheet.textLg,
              { color: isDark ? '#FFFFFF' : '#1F2937' }
            ]}
          >
            {item.front}
          </Text>
          
          {isTranslationVisible && (
            <Text 
              style={[
                GlobalFontStyleSheet.textBase, 
                isTablet && GlobalFontStyleSheet.textLg,
                { color: isDark ? '#E5E7EB' : '#374151', marginTop: 8, fontWeight: '500' }
              ]}
            >
              {item.back}
            </Text>
          )}
        </View>
        
        <View style={styles.vocabActions}>
          <TouchableOpacity 
            onPress={() => handlePlayAudio(item.front)}
            style={[
              styles.vocabIcon,
            ]}
            disabled={isAudioLoading}
          >
            {isAudioLoading ? (
              <ActivityIndicator size="small" color={isDark ? '#D1D5DB' : '#4B5563'} />
            ) : (
              <FontAwesomeIcon 
                icon={faVolumeUp} 
                size={14} 
                color={isAudioPlaying ? '#FC5D5D' : isDark ? '#D1D5DB' : '#4B5563'} 
              />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => toggleUserTranslation(item.id)}
            style={[
              styles.vocabIcon,
            ]}
          >
            <FontAwesomeIcon 
              icon={faLanguage} 
              size={14}
              color={isTranslationVisible ? '#FC5D5D' : isDark ? '#D1D5DB' : '#4B5563'} 
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  // Clean up any audio playback when component unmounts
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);
  
  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: isDark ? Colors.dark.background : Colors.light.background 
    }}>
      <View style={{ 
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: getDeviceType() === 'tablet' ? 128 : 20,
        paddingBottom: 10,
        position: 'relative'
      }}>
        <TouchableOpacity 
          style={{ 
            padding: 8,
            position: 'absolute',
            left: 16,
            zIndex: 1
          }}
          onPress={onBack}
        >
          <FontAwesome6 
            name="arrow-left" 
            size={isTablet ? 20 : 24} 
            color={isDark ? Colors.dark.tint : Colors.light.tint} 
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text 
            style={[
              GlobalFontStyleSheet.textLg,
              isTablet && GlobalFontStyleSheet.text2Xl,
              { textAlign: 'center', paddingHorizontal: '15%' }
            ]} 
            className="text-gray-900 dark:text-white font-bold mb-4"
          >
            {topicLabel}
          </Text>
        </View>
      </View>

      <View className={cx('flex-1 px-6', { 'px-20': isTablet })}>
        {/* Content section with ScrollView for all content */}
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={{ paddingBottom: 110 }}
          showsVerticalScrollIndicator={true}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Text 
              style={[GlobalFontStyleSheet.textBase, isTablet && GlobalFontStyleSheet.textLg]} 
              className="text-gray-700 dark:text-gray-100"
            >
              Phrase ideas
            </Text>
            <TouchableOpacity
              onPress={saveAllPhrasesToVocab}
              className={`${isSavingAll ? 'opacity-60' : ''} ${allSaved ? 'bg-green-500' : 'bg-[#FC5D5D]/80'}  px-4 rounded-2xl items-center justify-center shadow-sm`}
              disabled={isSavingAll || allSaved}
              style={styles.saveAllButton}
            >
              {isSavingAll ? (
                <Text style={[GlobalFontStyleSheet.textSm, isTablet && GlobalFontStyleSheet.textBase]} className="text-white font-bold">
                  Saving...
                </Text>
              ) : allSaved ? (
                <View style={styles.successContainer}>
                  <Animated.View
                    style={[
                      styles.successIconContainer,
                      {
                        transform: [
                          {
                            scale: circleAnimation.interpolate({
                              inputRange: [0, 0.5, 1],
                              outputRange: [0, 1.2, 1]
                            })
                          }
                        ]
                      }
                    ]}
                  >
                    {/* Circle transforming to checkmark */}
                    <Animated.View
                      style={[
                        {
                          opacity: circleAnimation.interpolate({
                            inputRange: [0, 0.5],
                            outputRange: [1, 0]
                          })
                        }
                      ]}
                    >
                      <FontAwesomeIcon icon={faCircle} size={14} color="white" />
                    </Animated.View>
                    
                    <Animated.View
                      style={[
                        styles.checkmarkContainer,
                        {
                          opacity: circleAnimation.interpolate({
                            inputRange: [0.5, 1],
                            outputRange: [0, 1]
                          })
                        }
                      ]}
                    >
                      <FontAwesomeIcon icon={faCheck} size={14} color="white" />
                    </Animated.View>
                    
                    {/* Render particles */}
                    {renderParticles()}
                  </Animated.View>
                  
                  <Text style={[GlobalFontStyleSheet.textSm, isTablet && GlobalFontStyleSheet.textBase]} className="text-white font-bold ml-2">
                    Saved!
                  </Text>
                </View>
              ) : (
                <Text style={[GlobalFontStyleSheet.textSm, isTablet && GlobalFontStyleSheet.textBase]} className="text-white font-bold">
                  Save All
                </Text>
              )}
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <View className="items-center justify-center py-8">
              <ActivityIndicator size="large" color={isDark ? Colors.dark.tint : Colors.light.tint} />
              <Text 
                style={[GlobalFontStyleSheet.textBase, isTablet && GlobalFontStyleSheet.textLg]} 
                className="text-gray-700 dark:text-gray-300 text-center mt-4"
              >
                Generating useful phrases for your chat...
              </Text>
            </View>
          ) : error ? (
            <View className="items-center justify-center py-8">
              <FontAwesome6 
                name="exclamation-circle" 
                size={isTablet ? 60 : 48} 
                color={isDark ? '#EF4444' : '#DC2626'} 
                style={{ marginBottom: 16 }}
              />
              <Text 
                style={[GlobalFontStyleSheet.textBase, isTablet && GlobalFontStyleSheet.textLg]} 
                className="text-red-500 text-center mb-4"
              >
                {error}
              </Text>
              <TouchableOpacity
                className={cx(
                  'bg-blue-500 py-2 px-4 rounded-xl items-center justify-center shadow-sm',
                  { 'py-3 px-6': isTablet }
                )}
                onPress={requestPhrases}
              >
                <Text 
                  style={[GlobalFontStyleSheet.textSm, isTablet && GlobalFontStyleSheet.textBase]} 
                  className="text-white font-bold"
                >
                  Try Again
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* First FlatList for phrases */}
              {phrases.length > 0 && (
                <FlatList
                  data={phrases}
                  renderItem={renderPhraseItem}
                  keyExtractor={(item, index) => `phrase-${index}`}
                  scrollEnabled={false} // Disable scroll for nested FlatList
                />
              )}
              
              {/* User vocab section */}
              {showUserVocab && hasUserVocab && (
                <View ref={userVocabSectionRef} className="mt-6">
                  <Text 
                    style={[GlobalFontStyleSheet.textBase, isTablet && GlobalFontStyleSheet.textLg]} 
                    className="text-gray-700 dark:text-gray-100 mb-3 font-medium"
                  >
                    Your Recent Vocabulary
                  </Text>
                  
                  {loadingUserVocab ? (
                    <ActivityIndicator size="small" color={isDark ? Colors.dark.tint : Colors.light.tint} style={{marginVertical: 10}} />
                  ) : (
                    <FlatList
                      data={userVocab.slice(0, MAX_VOCAB_ITEMS)}
                      renderItem={renderUserVocabItem}
                      keyExtractor={(item) => `user-vocab-${item.id}`}
                      scrollEnabled={false} // Disable scroll for nested FlatList
                      style={{marginBottom: 10}}
                    />
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
        
        <View className="absolute bottom-5 left-0 right-0">
          <TouchableOpacity
            className={cx(
              'bg-[#FC5D5D]/80 py-3 px-6 rounded-xl items-center justify-center shadow-sm mx-auto',
              { 'py-4 px-8': isTablet }
            )}
            onPress={onStartChat}
          >
            <Text 
              style={[GlobalFontStyleSheet.textBase, isTablet && GlobalFontStyleSheet.textLg]} 
              className="text-white font-bold"
            >
              {loading ? 'Skip & Start Chat' : 'Start Chat'}
            </Text>
          </TouchableOpacity>
          
          {/* User vocab toggle button - only show if user has vocab */}
          {hasUserVocab && (
            <TouchableOpacity
              className={cx(
                'flex-row items-center justify-center mt-3',
              )}
              onPress={toggleUserVocab}
            >
              <Text 
                style={[GlobalFontStyleSheet.textSm, isTablet && GlobalFontStyleSheet.textBase]} 
                className="text-blue-500 dark:text-blue-400 font-medium mr-1"
              >
                {showUserVocab ? 'Hide' : 'Show'} my recent vocabulary
              </Text>
              <FontAwesomeIcon 
                icon={showUserVocab ? faChevronUp : faChevronDown} 
                size={12} 
                color={isDark ? '#60A5FA' : '#3B82F6'} 
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  vocabCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  vocabContent: {
    flex: 1,
    marginRight: 12,
  },
  vocabActions: {
    gap: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  vocabIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveAllButton: {
    height: 30,
    minWidth: 90,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  successIconContainer: {
    position: 'relative',
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkContainer: {
    position: 'absolute',
  },
  particle: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'white',
  }
});

export default PracticeVocabBeforeChatScreen;
