import React, { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  Dimensions,
  Text,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ThemedText } from "@/components/shared/ThemedText";
import { ThemedView } from "@/components/shared/ThemedView";
import { GlobalFontStyleSheet } from "@/constants/Font";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faQuestion } from "@fortawesome/pro-solid-svg-icons";
import { colorScheme } from "nativewind";
import Flashcard from "@/components/cards/Flashcard";
import CardActionButtons from "@/components/cards/CardActionButtons";
import SlidingModal from "@/components/shared/SlidingModal";
import { Flashcard as FlashcardType } from "@/services/FlashcardService";
import FlashcardService from "@/services/FlashcardService";
import * as Haptics from "expo-haptics";
import { FilterOptions } from "./FilterModal";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";
import MicrophoneTranscription from "@/components/cards/MicrophoneTranscription";
import { FlashcardEvaluationService, EvaluationResult } from '@/services/FlashcardEvaluationService';
import { useAuth } from '@/contexts/AuthContext';
import KeyboardInput from '@/components/cards/KeyboardInput';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import MicrophonePermissionRequest from '@/components/speak/MicrophonePermissionRequest';
import { useWebSocket } from '@/contexts/ActionCableWebSocketContext';
import CompletionMessage from "@/components/cards/CompletionMessage";
import { UserSettingsContext } from '@/contexts/UserSettingsContext';
import { Audio } from 'expo-av';

const IS_MEDIUM_DEVICE = Dimensions.get("window").width >= 375;

interface ExerciseBaseProps {
  mode: 'recall' | 'listen' | 'produce' | 'cloze';
  title: string;
  flashcardService: FlashcardService;
  onPlayAudio: (text: string, language: string, tags?: string[]) => Promise<void>;
  isLoadingAudio: boolean;
  howItWorksSteps: string[];
  hideWord?: boolean;
  onRevealWord?: () => void;
  onNewCard?: () => void;
}

export default function ExerciseBase({
  mode,
  title,
  flashcardService,
  onPlayAudio,
  isLoadingAudio = false,
  howItWorksSteps,
  hideWord,
  onRevealWord,
  onNewCard,
}: ExerciseBaseProps) {
  const { filters: filterParam } = useLocalSearchParams();
  const [activeFilters, setActiveFilters] = useState<FilterOptions>({});
  const [showAnswer, setShowAnswer] = useState(false);
  const [showFinishedModal, setShowFinishedModal] = useState(false);
  const [cards, setCards] = useState<FlashcardType[]>([]);
  const [isFlipComplete, setIsFlipComplete] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [points, setPoints] = useState(0);
  const [isFirstCardLoaded, setIsFirstCardLoaded] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(mode === 'listen');
  const [hasBeenFlipped, setHasBeenFlipped] = useState(false);
  const [noCardsAvailable, setNoCardsAvailable] = useState(false);
  const [hasNoCards, setHasNoCards] = useState(false);
  const [hasNoFlashcardsAtAll, setHasNoFlashcardsAtAll] = useState(false);
  const [isLoadingNextCard, setIsLoadingNextCard] = useState(false);
  const [userGuess, setUserGuess] = useState<string>('');
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  // Hint-related state
  const [hintExample, setHintExample] = useState<{ source: string; translation: string } | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);
  
  // Cloze-related state
  const [clozeData, setClozeData] = useState<{
    clozeSentence: string;
    fullSentence: string;
    translation: string;
  } | null>(null);
  
  const router = useRouter();
  const { token } = useAuth();
  const webSocket = useWebSocket();
  const scale = useSharedValue(1);
  const marginTop = useSharedValue(0);
  const [showPermissionRequest, setShowPermissionRequest] = useState(false);
  const [permissionErrorType, setPermissionErrorType] = useState<'permission' | 'initialization' | 'connection' | 'generic'>('permission');
  const [hasAttemptedUnknownVocab, setHasAttemptedUnknownVocab] = useState(false);
  const { userSettings } = React.useContext(UserSettingsContext) || {};

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      marginTop: marginTop.value,
    };
  });

  useEffect(() => {
    console.log('ExerciseBase - Received filter param:', filterParam);
    if (filterParam) {
      try {
        const parsedFilters = JSON.parse(decodeURIComponent(filterParam as string));
        console.log('ExerciseBase - Parsed filters:', parsedFilters);
        setActiveFilters(parsedFilters);
        
        // First check if there are any cards available with these filters
        flashcardService.getNextRecallCard({
          practice_mode: mode,
          filters: parsedFilters,
          isCloze: mode === 'cloze'
        }).then(response => {
          if (!response.flashcard) {
            // If no cards available with these filters, show the no cards message
            setHasNoCards(true);
            setShowFinishedModal(false);
            setIsInitialLoading(false);
          } else {
            // If cards are available, proceed with normal loading
            loadNextFlashcard(parsedFilters);
          }
        });
      } catch (error) {
        console.error('Error parsing filters:', error);
        loadNextFlashcard({});
      }
    } else {
      console.log('ExerciseBase - No filters provided');
      loadNextFlashcard({});
    }
  }, [filterParam]);

  const loadNextFlashcard = async (
    filters: FilterOptions = activeFilters,
    options: { reset_not_known?: boolean } = {}
  ) => {
    console.log('ExerciseBase - Loading next flashcard with filters:', filters);
    setIsLoadingNextCard(true);
    setShowAnswer(false);
    setClozeData(null); // Reset cloze data at the start
    
    try {
      // First check if user has any flashcards at all
      const flashcardsResponse = await flashcardService.getFlashcards();
      const hasNoCards = flashcardsResponse.flashcards.length === 0;
      setHasNoFlashcardsAtAll(hasNoCards);

      if (hasNoCards) {
        setCards([]);
        setNoCardsAvailable(true);
        setHasNoCards(true);
        setShowFinishedModal(false);
        return { flashcard: null };
      }

      const response = await flashcardService.getNextRecallCard({
        practice_mode: mode,
        filters: filters,
        isCloze: mode === 'cloze',
        ...options
      });

      if (response.flashcard) {
        setNoCardsAvailable(false);
        setHasNoCards(false);
        setShowFinishedModal(false);
        
        // Store cloze data if available
        if (mode === 'cloze' && response.cloze) {
          console.log('Setting cloze data:', response.cloze);
          setClozeData(response.cloze);
        }
        
        // Only auto-play audio in listen mode
        if (mode === 'listen' && !isFirstCardLoaded) {
          if (onPlayAudio) {
            await onPlayAudio(
              response.flashcard.front,
              response.flashcard.language,
              response.flashcard.tags
            );
          }
          setIsFirstCardLoaded(true);
        }
        
        setCards([response.flashcard]);
        
        // Also preload audio for subsequent cards in listen mode
        if (mode === 'listen' && isFirstCardLoaded && onPlayAudio) {
          onPlayAudio(
            response.flashcard.front,
            response.flashcard.language,
            response.flashcard.tags
          );
        }
      } else {
        // No cards available with current filters
        setCards([]);
        setNoCardsAvailable(true);
        if (Object.keys(filters).length > 0) {
          setHasNoCards(true);
          setShowFinishedModal(false);
        } else {
          setShowFinishedModal(true);
        }
      }
      return response;
    } catch (error) {
      console.error("Error loading next flashcard:", error);
      return { flashcard: null };
    } finally {
      setIsLoadingNextCard(false);
      setIsInitialLoading(false);
    }
  };

  const handleSwipe = async (direction: "left" | "right" | "down") => {
    if (!cards[0] || isLoadingNextCard) {
      console.log('Swipe ignored - no card or loading');
      return;
    }

    setIsLoadingNextCard(true);
    const quality = direction === "right" ? 5 : direction === "left" ? 1 : 3;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setHasResponded(true);
    setPoints(prev => prev + 1);
    setHasBeenFlipped(false);
    setClozeData(null); // Reset cloze data when swiping

    try {
      await flashcardService.processResponse(cards[0].id, quality);
      const nextCardResponse = await flashcardService.getNextRecallCard({
        practice_mode: mode,
        filters: activeFilters,
        isCloze: mode === 'cloze'
      });

      if (nextCardResponse.flashcard) {
        console.log('Next card received:', nextCardResponse.flashcard.id);
        
        // Store cloze data for the next card if available
        if (mode === 'cloze' && nextCardResponse.cloze) {
          console.log('Setting next card cloze data:', nextCardResponse.cloze);
          setClozeData(nextCardResponse.cloze);
        }
        
        if (mode === 'listen' && onPlayAudio) {
          onPlayAudio(
            nextCardResponse.flashcard.front,
            nextCardResponse.flashcard.language,
            nextCardResponse.flashcard.tags
          );
        }

        setCards([nextCardResponse.flashcard]);
        setShowAnswer(false);
        setIsFlipComplete(false);
        setHasResponded(false);
        setNoCardsAvailable(false);
        setHasNoCards(false);
        onNewCard?.();
      } else {
        setCards([]);
        setNoCardsAvailable(true);
        if (Object.keys(activeFilters).length > 0) {
          setHasNoCards(true);
          setShowFinishedModal(false);
        } else {
          setShowFinishedModal(true);
        }
      }
    } catch (error) {
      console.error("Error processing response:", error);
    } finally {
      setIsLoadingNextCard(false);
    }
  };

  const handleFlipComplete = () => {
    setIsFlipComplete(true);
  };

  const handleCloseFinishedModal = () => {
    setShowFinishedModal(false);
    onNewCard?.();
    loadNextFlashcard();
  };

  const handleFlip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowAnswer(prev => !prev);
    if (!showAnswer) {
      setIsFlipComplete(false);
      setHasBeenFlipped(true);
    }
    console.log('hasBeenFlipped', hasBeenFlipped);
  };

  const handleDelete = async () => {
    if (!cards[0]) return;

    Alert.alert(
      "Delete Flashcard",
      "Are you sure you want to delete this flashcard? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await flashcardService.deleteFlashcard(cards[0].id);
              // Load next card after deletion
              loadNextFlashcard(activeFilters);
            } catch (error) {
              console.error("Error deleting flashcard:", error);
              Alert.alert(
                "Error",
                "Failed to delete flashcard. Please try again."
              );
            }
          }
        }
      ]
    );
  };

  const handleUpdateTags = async (id: string, newTags: string) => {
    try {
      await flashcardService.updateFlashcard(id, {
        tags: newTags.split(',').map(tag => tag.trim())
      });
      // Update the current card's tags without loading a new one
      if (cards[0] && cards[0].id === id) {
        setCards([{
          ...cards[0],
          tags: newTags.split(',').map(tag => tag.trim())
        }]);
      }
    } catch (error) {
      console.error("Error updating tags:", error);
      Alert.alert(
        "Error",
        "Failed to update tags. Please try again."
      );
    }
  };

  const handleUpdateTranslation = async (id: string, newTranslation: string) => {
    try {
      await flashcardService.updateFlashcard(id, {
        back: newTranslation
      });
      // Update the current card's translation without loading a new one
      if (cards[0] && cards[0].id === id) {
        setCards([{
          ...cards[0],
          back: newTranslation
        }]);
      }
    } catch (error) {
      console.error("Error updating translation:", error);
      Alert.alert(
        "Error",
        "Failed to update translation. Please try again."
      );
    }
  };

  const handleUpdateFront = async (id: string, newFront: string) => {
    try {
      await flashcardService.updateFlashcard(id, {
        front: newFront
      });
      // Update the current card's front content without loading a new one
      if (cards[0] && cards[0].id === id) {
        setCards([{
          ...cards[0],
          front: newFront
        }]);
      }
    } catch (error) {
      console.error("Error updating front:", error);
      Alert.alert(
        "Error",
        "Failed to update front content. Please try again."
      );
    }
  };

  useEffect(() => {
    setUserGuess('');
    setEvaluation(null);
    setIsEvaluating(false);
    // Reset hint state when loading a new card
    setHintExample(null);
    setHintError(null);
  }, [isLoadingNextCard]);

  const handleTranscriptionComplete = async (text: string, isAudio: boolean = false) => {
    setUserGuess(text);
    setIsEvaluating(true);
    console.log('isAudio', isAudio);
    try {
      const evaluationService = new FlashcardEvaluationService(token ?? "");
      
      // For cloze mode, evaluate against the missing word (front of flashcard)
      const correctAnswer = mode === 'cloze' ? cards[0].front : 
                          mode === 'produce' ? cards[0].front : cards[0].back;
      
      const result = await evaluationService.evaluateAnswer(
        correctAnswer,
        text,
        isAudio,
        webSocket
      );
      setEvaluation(result);
    } catch (error) {
      console.error('Error evaluating answer:', error);
    } finally {
      setIsEvaluating(false);
      handleFlip();
    }
  };

  const handleHint = async () => {
    if (!cards[0]) return;

    setIsLoadingHint(true);
    setHintError(null);

    try {
      let hint;
      
      if (mode === 'cloze') {
        // For Cloze mode, fetch definition instead of example sentence
        hint = await flashcardService.getFlashcardDefinition(
          cards[0].front,
          cards[0].language
        );
      } else {
        // For other modes, fetch example sentence as before
        hint = await flashcardService.getFlashcardHint(
          cards[0].front,
          cards[0].language,
          cards[0].back,
          userSettings?.team?.langua_native_language || 'english'
        );
      }
      
      setHintExample(hint);
    } catch (error: any) {
      setHintError(error.message || "Failed to fetch hint.");
    } finally {
      setIsLoadingHint(false);
    }
  };

  const handleSaveHint = async () => {
    if (!hintExample || !cards[0]) return;

    try {
      await flashcardService.addFlashcard(
        {
          front: hintExample.source,
          back: hintExample.translation,
          language: cards[0].language,
        },
        'sentence'
      );
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error saving hint as flashcard:", error);
      Alert.alert(
        "Error",
        "Failed to save hint as flashcard. Please try again."
      );
    }
  };

  // Update the getCardContent function
  const getCardContent = (card: FlashcardType, isFlipped: boolean) => {
    // Check if it's a word (doesn't have sentence or phrase tags)
    const isWord = !card.tags?.some(tag => ['sentence', 'phrase'].includes(tag));
    console.log('mode', mode);
    console.log('clozeData', clozeData);
    if (mode === 'cloze') {
      // In cloze mode, show the cloze sentence first, then full sentence when flipped
      return {
        frontContent: clozeData?.clozeSentence || card.front,
        backContent: clozeData?.fullSentence || card.back,
        isWord: false, // Cloze is always sentence-based
        word_info: card.word_info,
        translation: clozeData?.translation || card.back
      };
    }
    
    if (mode === 'produce') {
      // In produce mode, show translation first (back), then foreign word (front) when flipped
      return {
        frontContent: card.back, // Always show translation on front
        backContent: card.front,  // Always show foreign word on back
        isWord,
        word_info: card.word_info
      };
    }
    // Default behavior for recall and listen modes
    return {
      frontContent: card.front,
      backContent: card.back,
      isWord,
      word_info: card.word_info
    };
  };
  const screenWidth = Dimensions.get('window').width;
  const isSmallPhone = screenWidth <= 375; // iPhone SE and similar sized devices

  const handleKeyboardShow = () => {
    setIsKeyboardVisible(true);
    scale.value = withSpring(1.1, {
      damping: 15,
      stiffness: 100,
    });
    marginTop.value = withSpring(-200, {
      damping: 15,
      stiffness: 100,
    });
  };

  const handleKeyboardHide = () => {
    setIsKeyboardVisible(false);
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 100,
    });
    marginTop.value = withSpring(0, {
      damping: 15,
      stiffness: 100,
    });
  };

  const handlePermissionError = (type: 'permission' | 'initialization' | 'connection' | 'generic') => {
    setPermissionErrorType(type);
    setShowPermissionRequest(true);
  };

  const handleRequestPermission = async () => {
    const permission = await Audio.requestPermissionsAsync();
    if (permission.status === 'granted') {
      setShowPermissionRequest(false);
    }
  };

  return (
    <ThemedView className="flex-1 bg-white dark:bg-gray-900">
      {/* Header */}
      <View className={`flex-row items-center px-4 pb-12 ${isSmallPhone ? 'pt-8' : 'pt-[50px]'}`}>
        {/* Left: Back Button in a fixed-width container */}
        <View style={{ width: 80 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            className="p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View className="flex-row items-center">
              <FontAwesomeIcon
                icon={faChevronLeft}
                size={24}
                color={colorScheme.get() === "dark" ? "#ffffff" : "#000000"}
              />
              <Text style={GlobalFontStyleSheet.textMd} className="text-gray-700 dark:text-gray-100 pt-1">
                Back
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Center: Title */}
        <View className="flex-1 items-center">
          <ThemedText
            style={[GlobalFontStyleSheet.textXl, { textAlign: 'center' }]}
            className="font-bold"
          >
            {title}
          </ThemedText>
        </View>

        {/* Right: How-It-Works Button in a fixed-width container */}
        <View style={{ width: 80, alignItems: 'flex-end' }}>
          <TouchableOpacity
            onPress={() => setShowHowItWorks(true)}
            className="p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#FC5D5D]/85 items-center justify-center">
              <FontAwesomeIcon
                icon={faQuestion}
                size={IS_MEDIUM_DEVICE ? 20 : 16}
                color="#ffffff"
              />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Cards Section - Show when we have cards and not loading */}
      {!isLoadingNextCard && !isInitialLoading && cards.length > 0 && (
        <View className="flex-1 px-6 pb-8">
          <View className="flex-1 justify-center items-center">
            <Animated.View style={[{ width: "100%" }, animatedStyle]}>
              <Flashcard
                key={cards[0].id}
                id={cards[0].id}
                {...getCardContent(cards[0], showAnswer)}
                originalFront={cards[0].front}
                originalBack={cards[0].back}
                isFlipped={showAnswer}
                onFlip={handleFlip}
                onFlipComplete={handleFlipComplete}
                onPlayAudio={() => {
                  // In cloze mode, play the full sentence when flipped
                  if (mode === 'cloze') {
                    if (showAnswer && clozeData?.fullSentence) {
                      onPlayAudio(clozeData.fullSentence, cards[0].language, cards[0].tags);
                    } else if (!showAnswer && clozeData?.clozeSentence) {
                      onPlayAudio(clozeData.clozeSentence, cards[0].language, cards[0].tags);
                    }
                  }
                  // In produce mode, only play the foreign word (front) when flipped
                  else if (mode === 'produce') {
                    if (showAnswer) {
                      onPlayAudio(cards[0].front, cards[0].language, cards[0].tags);
                    }
                  } else {
                    onPlayAudio(cards[0].front, cards[0].language, cards[0].tags);
                  }
                }}
                isLoadingAudio={isLoadingAudio}
                onSwipe={handleSwipe}
                isListenMode={mode === "listen"}
                isProduceMode={mode === "produce"}
                isClozeMode={mode === "cloze"}
                hideAudio={mode === "produce" && !showAnswer}
                hasBeenFlipped={hasBeenFlipped}
                flashcardService={flashcardService}
                language={cards[0].language}
                hideWord={hideWord}
                onRevealWord={onRevealWord}
                onDelete={handleDelete}
                onUpdateTags={handleUpdateTags}
                onUpdateTranslation={handleUpdateTranslation}
                onUpdateFront={handleUpdateFront}
                tags={cards[0].tags}
                onTranscriptionComplete={handleTranscriptionComplete}
                userGuess={userGuess}
                evaluation={evaluation}
                isEvaluating={isEvaluating}
                // Hint-related props
                onHint={handleHint}
                showHints={mode === 'recall' || mode === 'listen' || mode === 'cloze'}
                hintExample={hintExample}
                isLoadingHint={isLoadingHint}
                hintError={hintError}
                onSaveHint={handleSaveHint}
              />

              {/* Add CardActionButtons below the Flashcard */}
              <View className="mt-4 min-h-18">
                {hasBeenFlipped && 
                 !hasResponded && 
                 cards[0] && 
                 !cards[0].tags?.some(tag => ['sentence', 'phrase'].includes(tag)) &&
                 mode !== 'cloze' && (
                  <CardActionButtons
                    flashcardService={flashcardService}
                    currentWord={cards[0].front}
                    language={cards[0].language}
                    targetLanguage={userSettings?.team?.langua_native_language || 'english'}
                    translation={cards[0].back}
                  />
                )}
                {/* Add MicrophoneTranscription when card is not flipped */}
                {!hasBeenFlipped && !showAnswer && (
                  <View className="flex flex-row items-center justify-center">
                    <MicrophoneTranscription 
                      onTranscriptionComplete={handleTranscriptionComplete}
                      onPermissionError={handlePermissionError}
                      language={cards[0].language}
                    />
                    <KeyboardInput 
                      onSubmit={handleTranscriptionComplete}
                      wordToGuess={mode === 'cloze' ? cards[0].front : 
                                  mode === 'produce' ? cards[0].back : cards[0].front}
                      onKeyboardShow={handleKeyboardShow}
                      onKeyboardHide={handleKeyboardHide}
                    />
                  </View>
                )}
                
              </View>
            </Animated.View>
          </View>
        </View>
      )}

      {/* No Cards Message - Only show when done loading and confirmed no cards */}
      {!isLoadingNextCard && 
       !isInitialLoading && 
       cards.length === 0 && 
       (hasNoCards || noCardsAvailable) && (
        <CompletionMessage
          flashcardService={flashcardService}
          onReset={(clearFilters) => {
            if (clearFilters) {
              setActiveFilters({});
              loadNextFlashcard({});
            } else {
              (async () => {
                const response = await loadNextFlashcard(activeFilters, { reset_not_known: true });
                // Only set hasAttemptedUnknownVocab to true if we still have no cards
                if (!response.flashcard) {
                  setHasAttemptedUnknownVocab(true);
                }
              })();
            }
          }}
          points={points}
          hasNoFlashcards={hasNoFlashcardsAtAll}
          noCardsAvailable={noCardsAvailable}
          hasNoCards={hasNoCards}
          activeFilters={activeFilters}
          hasAttemptedUnknownVocab={hasAttemptedUnknownVocab}
          onCloseModal={() => setHasAttemptedUnknownVocab(false)}
        />
      )}

      {/* How it works modal */}
      <SlidingModal
        visible={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
      >
        <View className="w-full h-full">
          <ThemedText
            style={GlobalFontStyleSheet.textLg}
            className="font-bold mb-4 text-gray-900 dark:text-white"
          >
            How it works
          </ThemedText>

          <View className="ml-4 mb-4">
            {howItWorksSteps.map((step, index) => (
              <ThemedText
                key={index}
                style={[GlobalFontStyleSheet.textMd, { lineHeight: 24 }]}
                className="text-gray-700 dark:text-gray-300 mb-2"
              >
                {`${index + 1}. ${step}`}
              </ThemedText>
            ))}
          </View>

          <ThemedText
            style={[GlobalFontStyleSheet.textMd, { lineHeight: 24 }]}
            className="text-gray-700 dark:text-gray-300 mb-4"
          >
            If you speak or write, AI will indicate whether you were correct or not.
            You can always override the feedback, e.g. if the AI didn't hear you correctly, 
            you may want to still swipe right.
          </ThemedText>

          <ThemedText
            style={[GlobalFontStyleSheet.textMd, { lineHeight: 24 }]}
            className="text-gray-700 dark:text-gray-300 mb-4"
          >
            The spaced repetition algorithm shows vocab at increasing intervals
            & adjusts based on your responses. This is powerful because our
            brains remember better when we review things just as we're starting
            to forget.
          </ThemedText>

          <ThemedText
            style={[GlobalFontStyleSheet.textMd, { lineHeight: 24 }]}
            className="text-gray-700 dark:text-gray-300"
          >
            Want to focus on specific vocab? Apply a filter before starting an
            exercise.
          </ThemedText>
        </View>
      </SlidingModal>

      {/* Permission Request Modal */}
      {showPermissionRequest && (
        <MicrophonePermissionRequest
          onRequestPermission={handleRequestPermission}
          errorType={permissionErrorType}
        />
      )}
    </ThemedView>
  );
} 
