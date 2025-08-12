import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { GlobalFontStyleSheet } from '@/constants/Font';
import cx from 'classnames';
import Flashcard from '@/components/cards/Flashcard';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faVolumeHigh, faPlus, faCheck } from '@fortawesome/pro-solid-svg-icons';
import FlashcardService from '@/services/FlashcardService';
import SaveSuccessAnimation from '@/components/shared/SaveSuccessAnimation';
import { Word, AudioState } from '@/types/vocabulary';

interface FlashcardViewProps {
  currentCard: Word | null;
  totalCards: number;
  currentIndex: number;
  isFlipped: boolean;
  hasBeenFlipped: boolean;
  cardKey: number;
  progressAnim: Animated.Value;
  saveSuccessWordIds: Set<string>;
  isSavingWord: boolean;
  flashcardService: FlashcardService;
  language: string;
  audioStates: Record<string, AudioState>;
  onFlip: () => void;
  onPlayAudio: (text: string) => Promise<void>;
  onSwipe: (direction: "left" | "right" | "down") => void;
  onWordAnimationComplete: (wordId: string) => void;
  onSaveWord: (word?: Word) => Promise<void>;
  onRemoveFromSaved: (word: Word) => void;
  isDark: boolean;
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({
  currentCard,
  totalCards,
  currentIndex,
  isFlipped,
  hasBeenFlipped,
  cardKey,
  progressAnim,
  saveSuccessWordIds,
  isSavingWord,
  flashcardService,
  language,
  audioStates,
  onFlip,
  onPlayAudio,
  onSwipe,
  onWordAnimationComplete,
  onSaveWord,
  onRemoveFromSaved,
  isDark
}) => {
  if (!currentCard) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text
          style={GlobalFontStyleSheet.textXl}
          className={cx(
            "text-center font-medium mb-4",
            isDark ? "text-gray-300" : "text-gray-700"
          )}
        >
          No vocabulary words to practice
        </Text>
        <Text
          style={GlobalFontStyleSheet.textBase}
          className={cx(
            "text-center",
            isDark ? "text-gray-400" : "text-gray-500"
          )}
        >
          Try saving or translating words during your chat to build your vocabulary list!
        </Text>
      </View>
    );
  }

  return (
    <>
      {/* Progress Bar */}
      <View className={cx(
        "h-2 rounded-full mb-8",
        isDark ? "bg-gray-800" : "bg-gray-200"
      )}>
        <Animated.View 
          className={cx(
            "h-full rounded-full",
            isDark ? "bg-blue-500" : "bg-blue-500"
          )}
          style={{
            width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%']
            })
          }}
        />
      </View>

      {/* Progress Text and Save Button */}
      <View className="flex-row justify-center items-center">
        <Text 
          style={GlobalFontStyleSheet.textLg}
          className={cx(
            "text-center font-medium",
            isDark ? "text-gray-300" : "text-gray-600"
          )}
        >
          {currentIndex + 1} of {totalCards} words
        </Text>
        
        <View className="ml-4 flex-row items-center">

          {currentCard.isSaved ? (
            <TouchableOpacity
              onPress={() => onRemoveFromSaved(currentCard)}
              className="flex-row items-center bg-green-100 dark:bg-green-900 px-3 py-1 rounded-full"
            >
              <FontAwesomeIcon 
                icon={faCheck} 
                size={14} 
                color={isDark ? "#86efac" : "#22c55e"} 
              />
              <Text 
                style={GlobalFontStyleSheet.textSm}
                className={cx(
                  "ml-1 font-medium",
                  isDark ? "text-green-300" : "text-green-700"
                )}
              >
                Saved
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={() => onSaveWord(currentCard)}
              disabled={isSavingWord || saveSuccessWordIds.has(currentCard.id)}
              className={cx(
                "flex-row items-center px-3 py-1 rounded-full",
                isDark ? "bg-blue-600" : "bg-blue-100"
              )}
            >
              {saveSuccessWordIds.has(currentCard.id) ? (
                <SaveSuccessAnimation 
                  isActive={true}
                  textStyle={{ color: isDark ? "#93c5fd" : "#3b82f6" }}
                  onAnimationComplete={() => onWordAnimationComplete(currentCard.id)}
                />
              ) : (
                <>
                  <FontAwesomeIcon 
                    icon={faPlus} 
                    size={14} 
                    color={isDark ? "#93c5fd" : "#3b82f6"} 
                  />
                  <Text 
                    style={GlobalFontStyleSheet.textSm}
                    className={cx(
                      "ml-1 font-medium",
                      isDark ? "text-blue-300" : "text-blue-700"
                    )}
                  >
                    Save
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View className="flex-1 items-center justify-center">
        <Flashcard
          key={`flashcard-${currentCard.id}-${cardKey}`} 
          frontContent={currentCard.word}
          backContent={currentCard.translation}
          isFlipped={isFlipped}
          onFlip={onFlip}
          onPlayAudio={() => onPlayAudio(currentCard.word)}
          isLoadingAudio={audioStates[currentCard.word]?.isLoading || false}
          onSwipe={onSwipe}
          hasBeenFlipped={hasBeenFlipped}
          flashcardService={flashcardService}
          language={language}
          id={currentCard.id}
          tags={[]}
          isWord={true}
          onDelete={currentCard.isSaved ? () => onRemoveFromSaved(currentCard) : undefined}
        />
        
        <Text 
          style={GlobalFontStyleSheet.textBase}
          className={cx(
            "text-center mt-8 px-6",
            isDark ? "text-gray-400" : "text-gray-500"
          )}
        >
          Swipe right if you know it, left if you don't,{'\n'}or down if you're not sure
        </Text>
      </View>
    </>
  );
};

export default FlashcardView; 
