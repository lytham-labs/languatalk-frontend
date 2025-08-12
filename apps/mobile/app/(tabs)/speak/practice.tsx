// Practice screen
import React, { useState, useEffect, useRef } from 'react';
import { View, Alert, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { useColorScheme } from 'react-native';
import cx from 'classnames';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

// Services
import AudioPlayerService from '@/services/AudioPlayerService';
import FlashcardService, { Flashcard as FlashcardType } from '@/services/FlashcardService';

// Components
import VocabularyListView from '@/components/speak/VocabularyListView';
import FlashcardView from '@/components/speak/FlashcardView';
import VocabularyHeader from '@/components/speak/VocabularyHeader';
import VocabularyLoadingView from '@/components/speak/VocabularyLoadingView';
import { Word } from '@/types/vocabulary';

type ViewMode = 'list' | 'flashcard';

export default function PracticeScreen() {
  // Component state
  const [currentCard, setCurrentCard] = useState<Word | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasBeenFlipped, setHasBeenFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCards, setTotalCards] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [vocabularyWords, setVocabularyWords] = useState<Word[]>([]);
  const [isSavingWord, setIsSavingWord] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [savingWordId, setSavingWordId] = useState<string | null>(null);
  const [saveSuccessWordIds, setSaveSuccessWordIds] = useState<Set<string>>(new Set());
  const [userVocabulary, setUserVocabulary] = useState<FlashcardType[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [cardKey, setCardKey] = useState(0);
  const [visibleTranslations, setVisibleTranslations] = useState<{[key: string]: boolean}>({});
  const [showAllTranslations, setShowAllTranslations] = useState(false);
  
  // URL parameters
  const { saved_words, translated_words, language, voice } = useLocalSearchParams();
  
  // Hooks
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { token } = useAuth();
  
  // Refs
  const audioPlayerService = useRef(new AudioPlayerService()).current;
  const flashcardService = useRef(new FlashcardService(token || '')).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const isMounted = useRef(true);
  const allWordsRef = useRef<Word[]>([]);
  
  // Initialize text-to-speech hook
  const { playText, stopAudio, audioStates } = useTextToSpeech({
    language: language as string || '',
    voice: voice as string || '',
    voice_provider: 'elevenlabs',
  });

  // Lifecycle management
  useEffect(() => {
    return () => {
      isMounted.current = false;
      stopAudio();
    };
  }, []);

  useEffect(() => {
    fetchUserVocabulary();
  }, [token]);

  useEffect(() => {
    if (userVocabulary.length > 0) {
      parseAndLoadWords();
    }
  }, [saved_words, translated_words, language, voice, userVocabulary]);

  useEffect(() => {
    // Only update card key when necessary, and keep track of the currentCard's id
    // to avoid repositioning when just updating saved status
    if (currentCard) {
      const cardId = currentCard.id;
      setCardKey(prev => prev + 1);
    }
  }, [currentCard?.word, currentCard?.translation]); // Only depend on content, not saved status

  // Data fetching functions
  const fetchUserVocabulary = async () => {
    try {
      const response = await flashcardService.getFlashcards();
      if (isMounted.current) {
        setUserVocabulary(response.flashcards);
      }
    } catch (error) {
      console.error('Error fetching user vocabulary:', error);
    }
  };

  const isWordInUserVocabulary = (word: string): boolean => {
    return userVocabulary.some(flashcard => 
      flashcard.front.toLowerCase().trim() === word.toLowerCase().trim()
    );
  };

  const parseAndLoadWords = async () => {
    try {
      let allParsedWords: Word[] = [];

      // Parse words from parameters
      const parseWordsFromParam = (paramStr: string | string[] | undefined): Word[] => {
        if (!paramStr) return [];
        
        const str = paramStr.toString();
        if (!str.startsWith('[') && !str.includes('=>')) return [];
        
        try {
          const parsed = JSON.parse(str.replace(/=>/g, ':'));
          return parsed.map((item: any, index: number) => ({
            id: `word-${index}`,
            word: item.word || '',
            translation: item.translation || '',
            isSaved: isWordInUserVocabulary(item.word || '')
          }));
        } catch (e) {
          const matches = str.match(/\{"word"=>"[^"]+", "translation"=>"[^"]+"\}/g);
          if (!matches) return [];
          
          return matches.map((match, index) => {
            const wordMatch = match.match(/"word"=>"([^"]+)"/);
            const translationMatch = match.match(/"translation"=>"([^"]+)"/);
            const word = wordMatch ? wordMatch[1] : '';
            
            return {
              id: `word-${index}`,
              word: word,
              translation: translationMatch ? translationMatch[1] : '',
              isSaved: isWordInUserVocabulary(word)
            };
          });
        }
      };

      // Combine words from both parameters
      if (saved_words) {
        allParsedWords = [...allParsedWords, ...parseWordsFromParam(saved_words)];
      }
      
      if (translated_words) {
        allParsedWords = [...allParsedWords, ...parseWordsFromParam(translated_words)];
      }

      // Filter out any invalid words and duplicates
      const uniqueWords = new Map<string, Word>();
      allParsedWords.forEach(word => {
        if (word.word && word.translation) {
          uniqueWords.set(word.word.toLowerCase(), word);
        }
      });
      
      const finalWords = Array.from(uniqueWords.values());

      if (isMounted.current) {
        // Save to refs first before updating state
        allWordsRef.current = finalWords;
        
        // Update total cards count
        setTotalCards(finalWords.length);
        
        // Only set vocabularyWords after allWordsRef is updated
        setVocabularyWords(finalWords);
        
        // Only set initial card if we don't have one yet or we're at the first card
        if (!currentCard && finalWords.length > 0) {
          setCurrentCard(finalWords[0]);
        } else if (currentCard && currentIndex === 0 && finalWords.length > 0) {
          // If we're at the first card, make sure it's updated
          setCurrentCard(finalWords[0]);
        }
        
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error parsing vocabulary words:', error);
      setIsLoading(false);
    }
  };

  // Event Handlers
  const handleFlip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsFlipped(!isFlipped);
    if (!hasBeenFlipped) {
      setHasBeenFlipped(true);
    }
  };

  const handleSwipe = (direction: "left" | "right" | "down") => {
    if (!currentCard || currentIndex >= totalCards - 1) {
      // If we've reached the end, mark session as complete
      if (currentIndex >= totalCards - 1) {
        setIsSessionComplete(true);
        // Reset visible translations when session is complete
        setVisibleTranslations({});
        setShowAllTranslations(false);
        // Set viewMode to list to ensure translations display correctly
        setViewMode('list');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Reset state for next card
    setIsFlipped(false);
    setHasBeenFlipped(false);
    
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    
    // Ensure state updates are applied before showing the next card
    setTimeout(() => {
      if (isMounted.current) {
        setCurrentCard(allWordsRef.current[nextIndex]);
      }
    }, 50);

    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: nextIndex / (totalCards - 1),
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handlePlayAudio = async (text: string) => {
    await stopAudio();
    playText(text);
  };

  const toggleViewMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // If switching from flashcard to list view, reset translations
    if (viewMode === 'flashcard') {
      setVisibleTranslations({});
      setShowAllTranslations(false);
    }
    
    setViewMode(viewMode === 'list' ? 'flashcard' : 'list');
  };

  const handleStartFlashcards = () => {
    // Reset flashcard state to start from beginning
    setCurrentIndex(0);
    setIsFlipped(false);
    setHasBeenFlipped(false);
    setCurrentCard(allWordsRef.current[0]);
    setIsSessionComplete(false);
    progressAnim.setValue(0);
    
    // Switch to flashcard view
    setViewMode('flashcard');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleSaveWord = async (wordToSave: Word = currentCard!) => {
    if (!wordToSave || wordToSave.isSaved || isSavingWord) return;
    
    try {
      setIsSavingWord(true);
      setSavingWordId(wordToSave.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Add this word to the saveSuccessWordIds to trigger animation before the API call
      setSaveSuccessWordIds(prev => new Set(prev).add(wordToSave.id));
      
      await flashcardService.addFlashcard({
        front: wordToSave.word,
        back: wordToSave.translation,
        language: language as string,
      }, 'word');
      
      // Mark the word as saved in-place in the vocabularyWords array
      const updatedVocabularyWords = vocabularyWords.map(word => {
        if (word.id === wordToSave.id) {
          return { ...word, isSaved: true };
        }
        return word;
      });
      
      // Update vocabularyWords without affecting order
      setVocabularyWords(updatedVocabularyWords);
      
      // Also update our ref to keep it in sync
      allWordsRef.current = updatedVocabularyWords;
      
      // Only update currentCard if it's the one being saved, and do it without changing position
      if (currentCard && currentCard.id === wordToSave.id && viewMode === 'flashcard') {
        const updatedCard = { ...currentCard, isSaved: true };
        setCurrentCard(updatedCard);
        setShowSaveSuccess(true);
      }
      
      // Add to user vocabulary state
      const newFlashcard: FlashcardType = {
        id: Date.now().toString(), // temporary ID
        front: wordToSave.word,
        back: wordToSave.translation,
        language: language as string,
        tags: [],
        flashcard_type: 'word',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Use function form to ensure we have latest state
      setUserVocabulary(prev => [...prev, newFlashcard]);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error saving word:', error);
      // Remove from animation set if there's an error
      setSaveSuccessWordIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(wordToSave.id);
        return newSet;
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      if (isMounted.current) {
        setIsSavingWord(false);
        setSavingWordId(null);
      }
    }
  };

  // Function to save all words
  const handleSaveAllWords = async () => {
    if (isSavingWord) return;

    try {
      setIsSavingWord(true);
      let savedCount = 0;

      for (const word of vocabularyWords) {
        if (!word.isSaved) {
          await flashcardService.addFlashcard({
            front: word.word,
            back: word.translation,
            language: language as string,
          }, 'word');
          savedCount++;
        }
      }

      // Update all words to saved
      const updatedWords = vocabularyWords.map(word => ({ ...word, isSaved: true }));
      setVocabularyWords(updatedWords);
      allWordsRef.current = updatedWords;
      
      if (currentCard) {
        setCurrentCard({ ...currentCard, isSaved: true });
      }

      // Show success animation if any words were saved
      if (savedCount > 0) {
        setShowSaveSuccess(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error saving all words:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      if (isMounted.current) {
        setIsSavingWord(false);
      }
    }
  };

  const handleAnimationComplete = () => {
    // Reset the success state after animation completes
    setTimeout(() => {
      if (isMounted.current) {
        setShowSaveSuccess(false);
      }
    }, 1000);
  };

  const handleWordAnimationComplete = (wordId: string) => {
    // Remove the word ID from the success set after animation completes
    setTimeout(() => {
      if (isMounted.current) {
        setSaveSuccessWordIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(wordId);
          return newSet;
        });
      }
    }, 1000);
  };

  const toggleTranslation = (wordId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVisibleTranslations(prev => ({
      ...prev,
      [wordId]: !prev[wordId]
    }));
  };

  const toggleAllTranslations = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newShowAll = !showAllTranslations;
    setShowAllTranslations(newShowAll);
    
    // Create a new object with all words set to the new visibility state
    const newVisibility: {[key: string]: boolean} = {};
    vocabularyWords.forEach(word => {
      newVisibility[word.id] = newShowAll;
    });
    
    setVisibleTranslations(newVisibility);
  };

  const isTranslationVisible = (wordId: string): boolean => {
    // Only consider currentCard when in flashcard mode
    return showAllTranslations || 
           !!visibleTranslations[wordId] || 
           (viewMode === 'flashcard' && currentCard?.id === wordId);
  };

  const handleRemoveFromSaved = async (wordToDelete: Word) => {
    if (!wordToDelete) return;
    
    Alert.alert(
      "Remove from Saved Vocabulary",
      "Are you sure you want to remove this word from your saved vocabulary?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              // Find the proper flashcard ID from userVocabulary
              const flashcardToDelete = userVocabulary.find(v => 
                v.front.toLowerCase().trim() === wordToDelete.word.toLowerCase().trim()
              );
              
              if (!flashcardToDelete || !flashcardToDelete.id) {
                console.error("Could not find flashcard ID for deletion", { 
                  word: wordToDelete.word, 
                  userVocabulary: userVocabulary.map(v => ({ id: v.id, front: v.front }))
                });
                Alert.alert(
                  "Error",
                  "Could not find the flashcard to remove. Please try again."
                );
                return;
              }
              
              // Delete from the saved vocabulary
              await flashcardService.deleteFlashcard(flashcardToDelete.id);
              
              // Update userVocabulary state
              setUserVocabulary(prev => prev.filter(v => v.id !== flashcardToDelete.id));
              
              // Update the word's saved status in the vocabularyWords array
              const updatedVocabularyWords = vocabularyWords.map(word => {
                if (word.id === wordToDelete.id) {
                  return { ...word, isSaved: false };
                }
                return word;
              });
              
              // Update vocabularyWords without affecting order
              setVocabularyWords(updatedVocabularyWords);
              
              // Also update our ref to keep it in sync
              allWordsRef.current = updatedVocabularyWords;
              
              // Only update currentCard if it's the one being modified and we're in flashcard view
              if (viewMode === 'flashcard' && currentCard && currentCard.id === wordToDelete.id) {
                const updatedCard = { ...currentCard, isSaved: false };
                setCurrentCard(updatedCard);
              }
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error("Error removing flashcard from saved vocabulary:", error);
              Alert.alert(
                "Error",
                "Failed to remove flashcard from saved vocabulary. Please try again."
              );
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          }
        }
      ]
    );
  };

  // Rendering
  if (isLoading) {
    return <VocabularyLoadingView isDark={isDark} />;
  }

  return (
    <View className={cx(
      "flex-1 px-4 pt-4",
      isDark ? "bg-gray-900" : "bg-gray-50"
    )}>
      <VocabularyHeader
        title="Session Vocabulary"
        viewMode={viewMode}
        isSessionComplete={isSessionComplete}
        onToggleViewMode={toggleViewMode}
        onBack={() => {
          router.dismissAll();
          router.replace('/history');
        }}
        isDark={isDark}
      />

      {isSessionComplete || viewMode === 'list' ? (
        <VocabularyListView
          vocabularyWords={vocabularyWords}
          visibleTranslations={visibleTranslations}
          showAllTranslations={showAllTranslations}
          saveSuccessWordIds={saveSuccessWordIds}
          isSavingWord={isSavingWord}
          savingWordId={savingWordId}
          audioStates={audioStates}
          onToggleTranslation={toggleTranslation}
          onToggleAllTranslations={toggleAllTranslations}
          onPlayAudio={handlePlayAudio}
          onSaveWord={handleSaveWord}
          onRemoveFromSaved={handleRemoveFromSaved}
          onWordAnimationComplete={handleWordAnimationComplete}
          onStartFlashcards={handleStartFlashcards}
          isTranslationVisible={isTranslationVisible}
          onSaveAllWords={handleSaveAllWords}
          showSaveSuccess={showSaveSuccess}
          onAnimationComplete={handleAnimationComplete}
          isDark={isDark}
        />
      ) : (
        <FlashcardView
          currentCard={currentCard}
          totalCards={totalCards}
          currentIndex={currentIndex}
          isFlipped={isFlipped}
          hasBeenFlipped={hasBeenFlipped}
          cardKey={cardKey}
          progressAnim={progressAnim}
          saveSuccessWordIds={saveSuccessWordIds}
          isSavingWord={isSavingWord}
          flashcardService={flashcardService}
          language={language as string}
          audioStates={audioStates}
          onFlip={handleFlip}
          onPlayAudio={handlePlayAudio}
          onSwipe={handleSwipe}
          onWordAnimationComplete={handleWordAnimationComplete}
          onSaveWord={async (word) => {
            if (word) {
              setSaveSuccessWordIds(prev => new Set(prev).add(word.id));
              await handleSaveWord(word);
            }
          }}
          onRemoveFromSaved={handleRemoveFromSaved}
          isDark={isDark}
        />
      )}
    </View>
  );
}
