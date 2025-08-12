import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { useColorScheme } from 'react-native';
import cx from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faVolumeHigh, faLanguage, faXmark, faPlus, faCheck } from '@fortawesome/pro-solid-svg-icons';
import * as Haptics from 'expo-haptics';
import SaveSuccessAnimation from '@/components/shared/SaveSuccessAnimation';
import { Word, AudioState } from '@/types/vocabulary';

interface VocabularyListViewProps {
  vocabularyWords: Word[];
  visibleTranslations: {[key: string]: boolean};
  showAllTranslations: boolean;
  saveSuccessWordIds: Set<string>;
  isSavingWord: boolean;
  savingWordId: string | null;
  audioStates: Record<string, AudioState>;
  onToggleTranslation: (wordId: string) => void;
  onToggleAllTranslations: () => void;
  onPlayAudio: (text: string) => Promise<void>;
  onSaveWord: (word: Word) => Promise<void>;
  onRemoveFromSaved: (word: Word) => void;
  onWordAnimationComplete: (wordId: string) => void;
  onStartFlashcards: () => void;
  isTranslationVisible: (wordId: string) => boolean;
  onSaveAllWords: () => Promise<void>;
  showSaveSuccess: boolean;
  onAnimationComplete: () => void;
  isDark: boolean;
}

export const VocabularyListView: React.FC<VocabularyListViewProps> = ({
  vocabularyWords,
  visibleTranslations,
  showAllTranslations,
  saveSuccessWordIds,
  isSavingWord,
  savingWordId,
  audioStates,
  onToggleTranslation,
  onToggleAllTranslations,
  onPlayAudio,
  onSaveWord,
  onRemoveFromSaved,
  onWordAnimationComplete,
  onStartFlashcards,
  isTranslationVisible,
  onSaveAllWords,
  showSaveSuccess,
  onAnimationComplete,
  isDark
}) => {
  if (vocabularyWords.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6 mt-12">
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
    <ScrollView 
      className="flex-1 w-full px-2"
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-row items-center">
          <Text 
            style={GlobalFontStyleSheet.textBase}
            className={cx(
              isDark ? "text-gray-300" : "text-gray-700"
            )}
          >
            {vocabularyWords.filter(w => w.isSaved).length} of {vocabularyWords.length} words saved
          </Text>
          
          <TouchableOpacity 
            onPress={onToggleAllTranslations}
            className="ml-4 flex-row items-center"
          >
            <FontAwesomeIcon 
              icon={faLanguage} 
              size={16} 
              color={showAllTranslations ? "#FC5D5D" : isDark ? "#93c5fd" : "#3b82f6"}
            />
            <Text 
              style={GlobalFontStyleSheet.textSm}
              className={cx(
                "ml-1",
                showAllTranslations 
                  ? (isDark ? "text-red-400" : "text-red-500")
                  : (isDark ? "text-blue-300" : "text-blue-600")
              )}
            >
              {showAllTranslations ? "Hide All" : "Show All"}
            </Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          onPress={onSaveAllWords}
          disabled={isSavingWord || vocabularyWords.every(w => w.isSaved)}
          className={cx(
            "px-3 py-2 rounded-lg flex-row items-center",
            vocabularyWords.every(w => w.isSaved) 
              ? (isDark ? "bg-green-600" : "bg-green-500") 
              : (isDark ? "bg-blue-600" : "bg-blue-500"),
            isSavingWord && "opacity-70"
          )}
        >
          {isSavingWord ? (
            <ActivityIndicator size="small" color="white" />
          ) : showSaveSuccess ? (
            <SaveSuccessAnimation 
              isActive={showSaveSuccess} 
              text="All Saved!" 
              onAnimationComplete={onAnimationComplete}
            />
          ) : (
            <>
              <FontAwesomeIcon 
                icon={vocabularyWords.every(w => w.isSaved) ? faCheck : faPlus} 
                size={14} 
                color="white" 
              />
              <Text 
                style={GlobalFontStyleSheet.textSm}
                className="text-white font-medium ml-2"
              >
                {vocabularyWords.every(w => w.isSaved) ? "All Saved" : "Save All"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {vocabularyWords.map((word, index) => (
        <View 
          key={`word-${index}`} 
          className={cx(
            "flex-row items-center p-4 rounded-lg mb-2",
            isDark ? "bg-gray-800" : "bg-white"
          )}
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 1,
            elevation: 1
          }}
        >
          <View className="flex-1">
            <Text 
              style={GlobalFontStyleSheet.textBase}
              className={cx(
                "font-medium",
                isDark ? "text-gray-300" : "text-gray-800"
              )}
            >
              {word.word}
            </Text>
            
            {isTranslationVisible(word.id) && (
              <Text 
                style={GlobalFontStyleSheet.textSm}
                className={cx(
                  "mt-2",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}
              >
                {word.translation}
              </Text>
            )}
          </View>
          
          <View className="flex-row items-center space-x-2 gap-4">
            {/* Audio Play Button */}
            <TouchableOpacity 
              onPress={() => onPlayAudio(word.word)}
              disabled={audioStates[word.word]?.isLoading}
              className="p-2"
            >
              {audioStates[word.word]?.isLoading ? (
                <ActivityIndicator 
                  size="small" 
                  color={isDark ? "#a0aec0" : "#718096"} 
                />
              ) : (
                <FontAwesomeIcon 
                  icon={faVolumeHigh} 
                  size={16} 
                  color={audioStates[word.word]?.isPlaying 
                    ? "#FC5D5D" 
                    : (isDark ? "#a0aec0" : "#718096")
                  } 
                />
              )}
            </TouchableOpacity>
            
            {/* Translation Toggle Button */}
            <TouchableOpacity 
              onPress={() => onToggleTranslation(word.id)}
              className="p-2"
            >
              <FontAwesomeIcon 
                icon={faLanguage} 
                size={16} 
                color={isTranslationVisible(word.id) 
                  ? "#FC5D5D" 
                  : (isDark ? "#a0aec0" : "#718096")
                } 
              />
            </TouchableOpacity>
            
            {/* Save Button */}
            {word.isSaved ? (
              <TouchableOpacity
                onPress={() => onRemoveFromSaved(word)}
                className="flex-row items-center bg-green-100 dark:bg-green-900 p-1 rounded-full"
              >
                <FontAwesomeIcon 
                  icon={faCheck} 
                  size={14} 
                  color={isDark ? "#86efac" : "#22c55e"} 
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                onPress={() => {
                  // Always show animation immediately, then call saveWord
                  // This is handled by the parent component's onSaveWord
                  onSaveWord(word);
                }}
                disabled={isSavingWord}
                className={cx(
                  "flex-row items-center p-1 rounded-full",
                  isDark ? "bg-blue-600" : "bg-blue-100"
                )}
              >
                {saveSuccessWordIds.has(word.id) ? (
                  <SaveSuccessAnimation 
                    isActive={true}
                    text=""
                    onAnimationComplete={() => onWordAnimationComplete(word.id)}
                  />
                ) : (
                  <FontAwesomeIcon 
                    icon={faPlus} 
                    size={14} 
                    color={isDark ? "#93c5fd" : "#3b82f6"} 
                  />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
      
      <TouchableOpacity
        onPress={onStartFlashcards}
        className={cx(
          "mt-4 p-4 rounded-2xl mb-8 items-center bg-blue-500"
        )}
      >
        <Text 
          style={GlobalFontStyleSheet.textBase}
          className="text-white font-medium"
        >
          Practice as Flashcards
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default VocabularyListView; 
