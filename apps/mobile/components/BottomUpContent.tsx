import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import FlashcardButton from './FlashcardButton';
import SkeletonLoader from '@/components/SkeletonLoader';
import FlashcardService from '@/services/FlashcardService';
import AudioPlayerService from '@/services/AudioPlayerService';
import { Colors } from '@/constants/Colors';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import { useColorScheme } from '@/hooks/useColorScheme';

interface BottomUpContentProps {
  selectedWord: string | null;
  translation: any;
  allMeanings: any;
  sentenceTranslation: string | null;
  usageExamples: any[] | null;
  similarWords: any[] | null;
  fetchAllMeanings: (word: string) => Promise<void>;
  fetchSentenceTranslation: (sentence: string) => Promise<void>;
  fetchUsageExamples: (word: string) => Promise<void>;
  fetchSimilarWords: (word: string) => Promise<void>;
  contextSentence: string | null;
  onPlayAudio: (word: string) => void;
  onFlagWord: (word: string) => void;
  language: string;
  contentId: string;
  contentType: string;
  token: string;
  audioPlayerService: AudioPlayerService;
}

const BottomUpContent: React.FC<BottomUpContentProps> = ({
  selectedWord,
  translation,
  allMeanings,
  sentenceTranslation,
  usageExamples,
  similarWords,
  fetchAllMeanings,
  fetchSentenceTranslation,
  fetchUsageExamples,
  fetchSimilarWords,
  contextSentence,
  onPlayAudio,
  onFlagWord,
  language,
  contentId,
  contentType,
  token,
  audioPlayerService,
}) => {
  const [showAllMeanings, setShowAllMeanings] = useState(false);
  const [showSentenceTranslation, setShowSentenceTranslation] = useState(false);
  const [showUsageExamples, setShowUsageExamples] = useState(false);
  const [showSimilarWords, setShowSimilarWords] = useState(false);
  const [loadingAllMeanings, setLoadingAllMeanings] = useState(false);
  const [loadingSentenceTranslation, setLoadingSentenceTranslation] = useState(false);
  const [loadingUsageExamples, setLoadingUsageExamples] = useState(false);
  const [loadingSimilarWords, setLoadingSimilarWords] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isFlagging, setIsFlagging] = useState(false);
  const [isFlagged, setIsFlagged] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isFlashcardAdded, setIsFlashcardAdded] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [addedFlashcards, setAddedFlashcards] = useState<{[key: string]: boolean}>({});
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  const flashcardService = new FlashcardService(token);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAddToFlashcards = async (front: string, back: string, type: string = 'word') => {
    triggerHaptic();

    const flashcardKey = `${front}-${back}`;
    
    const flashcardData = {
      front,
      back,
      language: language,
      context_sentence: type === 'word' ? contextSentence || '' : '',
      translated_sentence: type === 'word' ? sentenceTranslation || '' : '',
      flashcardable_id: contentId,
      flashcardable_type: contentType,
      flashcard_type: type,
    };

    try {
      await flashcardService.addFlashcard(flashcardData);
      
      setAddedFlashcards(prev => ({
        ...prev,
        [flashcardKey]: true
      }));
      
      if (type === 'word' && front === selectedWord) {
        setIsFlashcardAdded(true);
      }
    } catch (error) {
      console.error('Failed to add flashcard:', error);
    }
  };

  const handlePlayAudio = async () => {
    if (!selectedWord) return;

    triggerHaptic();

    if (isPlayingAudio) {
      await audioPlayerService.pauseSound();
      setIsPlayingAudio(false);
    } else {
      if (audioUrl) {
        playAudio(audioUrl);
      } else {
        setIsLoadingAudio(true);
        try {
          const audioBlob = await flashcardService.getAudioStream(selectedWord, language);
          const fileUri = `${FileSystem.documentDirectory}temp_audio.mp3`;
          
          // Convert Blob to Base64 string
          const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              // Remove the data URL prefix (e.g., 'data:audio/mp3;base64,')
              const base64 = reader.result?.toString().split(',')[1] || '';
              resolve(base64);
            };
            reader.readAsDataURL(audioBlob);
          });

          // Write the Base64 data to file
          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });

          setAudioUrl(fileUri);
          playAudio(fileUri);
        } catch (error) {
          console.error('Error fetching audio:', error);
        } finally {
          setIsLoadingAudio(false);
        }
      }
    }
  };

  const playAudio = async (audioUrl: string) => {
    try {
      // First try to stop any currently playing audio
      await audioPlayerService.stopSound();
      
      // Add a small delay to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          const newSound = await audioPlayerService.playSound(
            audioUrl,
            null,
            '',
            false,
            false,
            selectedWord,
            (status) => {
              if (status.isLoaded && status.didJustFinish) {
                setIsPlayingAudio(false);
              }
            }
          );

          if (newSound) {
            setSound(newSound);
            break; // Success - exit the retry loop
          }
        } catch (error) {
          console.log(`Retry attempt ${retryCount + 1} failed:`, error);
          retryCount++;
          
          // If we've exhausted all retries, throw the error
          if (retryCount === maxRetries) {
            throw error;
          }
          
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Try to unload the sound before retrying
          if (sound) {
            try {
              await sound.unloadAsync();
            } catch (unloadError) {
              console.log('Error unloading sound:', unloadError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error playing suggestion audio:', error);
      setIsPlayingAudio(false);
    }
  };

  const handleFlagWord = async () => {
    if (isFlagging || isFlagged || !selectedWord) return;

    triggerHaptic();
    setIsFlagging(true);

    try {
      await flashcardService.flagWord(selectedWord);
      setIsFlagged(true);
    } catch (error) {
      console.error('Error flagging word:', error);
    } finally {
      setIsFlagging(false);
    }
  };

  // Helper function to convert ArrayBuffer to Base64
  function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
      const fileUri = FileSystem.documentDirectory + 'temp_audio.mp3';
      FileSystem.deleteAsync(fileUri, { idempotent: true });
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        FileSystem.deleteAsync(audioUrl, { idempotent: true });
      }
    };
  }, [audioUrl]);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <ScrollView>
      <Text style={[styles.bottomUpTitle, isDark && styles.textLight]}>
        {selectedWord}
      </Text>
      {translation === null ? (
        <SkeletonLoader
          styleType="default"
          sections={[
            { rows: 2, showTitle: true },
            { rows: 2, showTitle: true }
          ]}
        />
      ) : translation.error ? (
        <Text style={styles.bottomUpError}>{translation.error}</Text>
      ) : (
        <View>
          <Text style={[styles.bottomUpTranslation, isDark && styles.textLight]}>
            {translation.translation}
          </Text>
          {translation.word_info && (
            <Text style={[styles.bottomUpWordInfo, isDark && styles.textLight]}>
              {translation.word_info}
            </Text>
          )}

          <Pressable
            onPress={() => {
              triggerHaptic();
              if (allMeanings) {
                setShowAllMeanings(!showAllMeanings);
              } else {
                setLoadingAllMeanings(true);
                fetchAllMeanings(selectedWord!).finally(() =>
                  setLoadingAllMeanings(false)
                );
                setShowAllMeanings(true);
              }
            }}
            style={styles.bottomUpLink}
          >
            <Text style={[styles.bottomUpLinkText, isDark && styles.textLight]}>All meanings</Text>
          </Pressable>
          {showAllMeanings &&
            (loadingAllMeanings ? (
              <SkeletonLoader styleType="simple" />
            ) : allMeanings ? (
              allMeanings.error ? (
                <Text style={styles.bottomUpError}>{allMeanings.error}</Text>
              ) : (
                allMeanings.translations.map((meaning: any, index: number) => {
                  const flashcardKey = `${selectedWord}-${meaning.translation}`;
                  return (
                    <View key={index} style={styles.meaningContainer}>
                      <View style={styles.meaningTextContainer}>
                        <Text style={[styles.bottomUpAllMeanings, isDark && styles.textLight]}>
                          {meaning.translation}
                        </Text>
                      </View>
                      <FlashcardButton
                        style={[styles.inlineButton]}
                        onPress={() => handleAddToFlashcards(selectedWord!, meaning.translation)}
                        type="add"
                        isActive={addedFlashcards[flashcardKey]}
                      />
                    </View>
                  );
                })
              )
            ) : null)}

          <Pressable
            onPress={() => {
              triggerHaptic();
              if (sentenceTranslation) {
                setShowSentenceTranslation(!showSentenceTranslation);
              } else {
                setLoadingSentenceTranslation(true);
                fetchSentenceTranslation(contextSentence!).finally(() =>
                  setLoadingSentenceTranslation(false)
                );
                setShowSentenceTranslation(true);
              }
            }}
            style={styles.bottomUpLink}
          >
            <Text style={[styles.bottomUpLinkText, isDark && styles.textLight]}>Translate sentence</Text>
          </Pressable>
          {showSentenceTranslation &&
            (loadingSentenceTranslation ? (
              <SkeletonLoader styleType="simple" />
            ) : sentenceTranslation ? (
              <View style={styles.meaningContainer}>
                <View style={styles.meaningTextContainer}>
                  <Text style={[styles.bottomUpSentenceTranslation, isDark && styles.textLight]}>
                    {sentenceTranslation}
                  </Text>
                </View>
                <FlashcardButton
                  style={[styles.inlineButton]}
                  onPress={() => handleAddToFlashcards(contextSentence!, sentenceTranslation, 'sentence')}
                  type="add"
                  isActive={addedFlashcards[`${contextSentence}-${sentenceTranslation}`]}
                />
              </View>
            ) : null)}

          <Pressable
            onPress={() => {
              triggerHaptic();
              if (usageExamples) {
                setShowUsageExamples(!showUsageExamples);
              } else {
                setLoadingUsageExamples(true);
                fetchUsageExamples(selectedWord!).finally(() =>
                  setLoadingUsageExamples(false)
                );
                setShowUsageExamples(true);
              }
            }}
            style={styles.bottomUpLink}
          >
            <Text style={[styles.bottomUpLinkText, isDark && styles.textLight]}>Usage examples</Text>
          </Pressable>
          {showUsageExamples &&
            (loadingUsageExamples ? (
              <SkeletonLoader styleType="simple" />
            ) : usageExamples ? (
              usageExamples.map((example, index) => {
                const flashcardKey = `${example.source}-${example.translation}`;
                return (
                  <View key={index} style={styles.meaningContainer}>
                    <View style={styles.meaningTextContainer}>
                      <Text style={[styles.bottomUpUsageExample, isDark && styles.textLight]}>
                        {example.source} = {example.translation}
                      </Text>
                    </View>
                    <FlashcardButton
                      style={[styles.inlineButton]}
                      onPress={() => handleAddToFlashcards(example.source, example.translation, 'sentence')}
                      type="add"
                      isActive={addedFlashcards[flashcardKey]}
                    />
                  </View>
                );
              })
            ) : null)}

          <Pressable
            onPress={() => {
              triggerHaptic();
              if (similarWords) {
                setShowSimilarWords(!showSimilarWords);
              } else {
                setLoadingSimilarWords(true);
                fetchSimilarWords(selectedWord!).finally(() =>
                  setLoadingSimilarWords(false)
                );
                setShowSimilarWords(true);
              }
            }}
            style={styles.bottomUpLink}
          >
            <Text style={[styles.bottomUpLinkText, isDark && styles.textLight]}>Similar words</Text>
          </Pressable>
          {showSimilarWords &&
            (loadingSimilarWords ? (
              <SkeletonLoader styleType="simple" />
            ) : similarWords ? (
              similarWords.map((word, index) => {
                const flashcardKey = `${word.source}-${word.translation}`;
                return (
                  <View key={index} style={styles.meaningContainer}>
                    <View style={styles.meaningTextContainer}>
                      <Text style={[styles.bottomUpSimilarWord, isDark && styles.textLight]}>
                        {word.source} = {word.translation}
                      </Text>
                    </View>
                    <FlashcardButton
                      style={[styles.inlineButton]}
                      onPress={() => handleAddToFlashcards(word.source, word.translation)}
                      type="add"
                      isActive={addedFlashcards[flashcardKey]}
                    />
                  </View>
                );
              })
            ) : null)}

          <View style={styles.buttonGroup}>
            <FlashcardButton
              style={[styles.button, styles.addButton]}
              onPress={() => handleAddToFlashcards(selectedWord!, translation.translation)}
              type="add"
              isActive={addedFlashcards[`${selectedWord}-${translation.translation}`]}
            />
            <FlashcardButton
              style={[styles.button, styles.playButton]}
              onPress={handlePlayAudio}
              type={isPlayingAudio ? "pause" : "play"}
              isPulsing={isPlayingAudio || isLoadingAudio}
              isLoading={false}
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  bottomUpTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  bottomUpTranslation: {
    fontSize: 16,
    marginBottom: 20,
  },
  bottomUpError: {
    color: 'red',
    fontSize: 16,
    marginBottom: 10,
  },
  bottomUpWordInfo: {
    fontSize: 14,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  bottomUpLink: {
    marginTop: 10,
    marginBottom: 10,
  },
  bottomUpLinkText: {
    color: '#047bf8',
    fontSize: 16,
  },
  bottomUpAllMeanings: {
    marginTop: 10,
    fontSize: 14,
    flexWrap: 'wrap',
  },
  bottomUpSentenceTranslation: {
    marginTop: 10,
    fontSize: 14,
    fontStyle: 'italic',
    flexWrap: 'wrap',
  },
  bottomUpUsageExample: {
    marginTop: 5,
    fontSize: 14,
    flexWrap: 'wrap',
  },
  bottomUpSimilarWord: {
    marginTop: 5,
    fontSize: 14,
    flexWrap: 'wrap',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  addButton: {
    backgroundColor: '#fc5d5d',
    flex: 2,
  },
  playButton: {
    backgroundColor: '#6c757d', // Secondary color
  },
  flagButton: {
    backgroundColor: '#6c757d', // Secondary color
  },
  flagIcon: {
    fontSize: 20,
  },
  meaningContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginVertical: 5,
    width: '100%',
  },
  meaningTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  inlineButton: {
    width: 40,
    height: 40,
    flexShrink: 0,
    backgroundColor: '#fc5d5d',
  },
  textLight: {
    color: '#fff',
  },
});

export default BottomUpContent;
