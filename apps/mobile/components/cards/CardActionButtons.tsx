import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, Text, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { GlobalFontStyleSheet } from '@/constants/Font';
import FlashcardService from '@/services/FlashcardService';
import SlidingModal from '@/components/shared/SlidingModal';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCheck, faBook, faPuzzlePiece, faLightbulb, faQuoteLeft, faLayerGroup, faLanguage, faComments, faArrowsRepeat } from '@fortawesome/pro-solid-svg-icons';
import * as Haptics from 'expo-haptics';
import { colorScheme } from 'nativewind';
import cx from 'classnames';
import useDevice from '@/hooks/useDevice';

interface CardActionButtonsProps {
  flashcardService: FlashcardService;
  currentWord: string;
  language: string;
  targetLanguage: string;
  translation: string;
}

const CardActionButtons: React.FC<CardActionButtonsProps> = ({
  flashcardService,
  currentWord,
  language,
  targetLanguage,
  translation
}) => {
  // State for usage examples
  const [usageExamples, setUsageExamples] = useState<{ source: string; translation: string }[] | null>(null);
  const [isUsageExamplesLoading, setIsUsageExamplesLoading] = useState(false);
  const [usageExamplesError, setUsageExamplesError] = useState<string | null>(null);
  const [showUsageExamplesModal, setShowUsageExamplesModal] = useState(false);
  const usageExamplesCache = useRef<{ [key: string]: { source: string; translation: string }[] }>({});

  // State for phrase examples
  const [phraseExamples, setPhraseExamples] = useState<{ source: string; translation: string }[] | null>(null);
  const [isPhraseExamplesLoading, setIsPhraseExamplesLoading] = useState(false);
  const [phraseExamplesError, setPhraseExamplesError] = useState<string | null>(null);
  const [showPhraseExamplesModal, setShowPhraseExamplesModal] = useState(false);
  const phraseExamplesCache = useRef<{ [key: string]: { source: string; translation: string }[] }>({});

  // State for similar words
  const [similarWords, setSimilarWords] = useState<{ source: string; translation: string }[] | null>(null);
  const [isSimilarWordsLoading, setIsSimilarWordsLoading] = useState(false);
  const [similarWordsError, setSimilarWordsError] = useState<string | null>(null);
  const [showSimilarWordsModal, setShowSimilarWordsModal] = useState(false);
  const similarWordsCache = useRef<{ [key: string]: { source: string; translation: string }[] }>({});

  // State for all meanings
  const [allMeanings, setAllMeanings] = useState<{ source: string; translation: string }[] | null>(null);
  const [isAllMeaningsLoading, setIsAllMeaningsLoading] = useState(false);
  const [allMeaningsError, setAllMeaningsError] = useState<string | null>(null);
  const [showAllMeaningsModal, setShowAllMeaningsModal] = useState(false);
  const allMeaningsCache = useRef<{ [key: string]: { source: string; translation: string }[] }>({});

  const [savedExamples, setSavedExamples] = useState<Set<string>>(new Set());
  const { isTablet } = useDevice();

  const fetchUsageExamples = async () => {
    setShowUsageExamplesModal(true);
    const cacheKey = `${currentWord}-${language}`;

    if (usageExamplesCache.current[cacheKey]) {
      setUsageExamples(usageExamplesCache.current[cacheKey].slice(0, 2));
      setIsUsageExamplesLoading(false);
      return;
    }

    setIsUsageExamplesLoading(true);
    setUsageExamplesError(null);
    try {
      const examples = await flashcardService.getUsageExamples(
        currentWord,
        language,
        translation
      );
      usageExamplesCache.current[cacheKey] = examples.examples;
      setUsageExamples(examples.examples.slice(0, 2));
    } catch (error: any) {
      setUsageExamplesError(error.message || "Failed to fetch usage examples.");
    } finally {
      setIsUsageExamplesLoading(false);
    }
  };

  const fetchPhraseExamples = async () => {
    setShowPhraseExamplesModal(true);
    const cacheKey = `${currentWord}-${language}`;

    if (phraseExamplesCache.current[cacheKey]) {
      setPhraseExamples(phraseExamplesCache.current[cacheKey].slice(0, 2));
      setIsPhraseExamplesLoading(false);
      return;
    }

    setIsPhraseExamplesLoading(true);
    setPhraseExamplesError(null);
    try {
      const result = await flashcardService.getPhraseExamples(
        currentWord,
        language
      );
      phraseExamplesCache.current[cacheKey] = result.phrases;
      setPhraseExamples(result.phrases.slice(0, 2));
    } catch (error: any) {
      setPhraseExamplesError(error.message || "Failed to fetch phrase examples.");
    } finally {
      setIsPhraseExamplesLoading(false);
    }
  };

  const fetchSimilarWords = async () => {
    setShowSimilarWordsModal(true);
    const cacheKey = `${currentWord}-${language}`;

    if (similarWordsCache.current[cacheKey]) {
      setSimilarWords(similarWordsCache.current[cacheKey].slice(0, 2));
      setIsSimilarWordsLoading(false);
      return;
    }

    setIsSimilarWordsLoading(true);
    setSimilarWordsError(null);
    try {
      const result = await flashcardService.getSimilarWords(
        currentWord,
        language
      );
      similarWordsCache.current[cacheKey] = result.similar_words;
      setSimilarWords(result.similar_words.slice(0, 2));
    } catch (error: any) {
      setSimilarWordsError(error.message || "Failed to fetch similar words.");
    } finally {
      setIsSimilarWordsLoading(false);
    }
  };
  const fetchAllMeanings = async () => {
    setShowAllMeaningsModal(true);
    const cacheKey = `${translation}-${language}`;

    if (allMeaningsCache.current[cacheKey]) {
      setAllMeanings(allMeaningsCache.current[cacheKey]);
      setIsAllMeaningsLoading(false);
      return;
    }

    setIsAllMeaningsLoading(true);
    setAllMeaningsError(null);
    try {
      const result = await flashcardService.getAllMeanings(
        translation,
        language, 
        targetLanguage
      );
      console.log('result: ', result);
      allMeaningsCache.current[cacheKey] = result;
      setAllMeanings(result);
    } catch (error: any) {
      setAllMeaningsError(error.message || "Failed to fetch all meanings.");
    } finally {
      setIsAllMeaningsLoading(false);
    }
  }

  const handleSaveExample = async (example: { source: string; translation: string }, type: 'sentence' | 'phrase' | 'word' = 'word', uniqueKey?: string) => {
    try {
      await flashcardService.addFlashcard(
        {
          front: example.source,
          back: example.translation,
          language: language,
        },
        type
      );

      const keyToAdd = uniqueKey || example.source;
      setSavedExamples((prev) => new Set(prev).add(keyToAdd));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error saving example as flashcard:", error);
    }
  };

  const SaveButton = ({
    item,
    onPress,
    uniqueKey,
  }: {
    item: { source: string; translation: string };
    onPress: () => void;
    uniqueKey?: string;
  }) => {
    const keyToCheck = uniqueKey || item.source;
    const isSaved = savedExamples.has(keyToCheck);
    const isDark = colorScheme.get() === "dark";

    return (
      <TouchableOpacity
        onPress={onPress}
        className="absolute right-0 top-0"
        disabled={isSaved}
      >
        <View
          className={`w-8 h-8 md:w-10 md:h-10 rounded-full ${
            isSaved ? "bg-green-500" : "bg-[#FC5D5D]"
          } items-center justify-center`}
          style={{
            opacity: isDark ? 0.9 : 1,
          }}
        >
          {isSaved ? (
            <FontAwesomeIcon icon={faCheck} size={16} color="#ffffff" />
          ) : (
            <Text className="pb-1 text-white text-xl md:text-2xl font-bold">
              +
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const ExamplesList = ({ 
    items, 
    isLoading, 
    error, 
    title,
    type
  }: { 
    items: { source: string; translation: string }[] | null;
    isLoading: boolean;
    error: string | null;
    title: string;
    type: 'sentence' | 'phrase' | 'word';
  }) => {
    const isDark = colorScheme.get() === "dark";

    if (isLoading) {
      return (
        <View className="items-center py-8">
          <ActivityIndicator size="large" color={isDark ? "#60A5FA" : "#3B82F6"} />
          <Text 
            style={[GlobalFontStyleSheet.textMd]} 
            className="mt-4 text-gray-400 dark:text-gray-500"
          >
            Loading {title.toLowerCase()}...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View className="flex-1 justify-center items-center">
          <Text className="text-red-500 dark:text-red-400 text-center">{error}</Text>
        </View>
      );
    }

    if (!items || items.length === 0) {
      return (
        <View className="flex-1 justify-center items-center">
          <Text 
            style={GlobalFontStyleSheet.textLg} 
            className="text-center text-gray-500 dark:text-gray-400"
          >
            No {title.toLowerCase()} found.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView className="flex-1 w-full pt-6">
        <Text 
          style={GlobalFontStyleSheet.textXl} 
          className="font-bold mb-6 text-center text-gray-900 dark:text-white"
        >
          {title}
        </Text>
        {items.map((example, index) => (
          <View key={index} className="mb-6 relative px-12">
            <Text 
              style={GlobalFontStyleSheet.textLg} 
              className="mb-2 text-gray-900 dark:text-white"
            >
              {example.source}
            </Text>
            <Text 
              style={GlobalFontStyleSheet.textMd} 
              className="text-gray-600 dark:text-gray-400"
            >
              {example.translation}
            </Text>
            <SaveButton
              item={example}
              onPress={() => handleSaveExample(example, type)}
            />
          </View>
        ))}
      </ScrollView>
    );
  };

  // Add the new MeaningsList component
  const MeaningsList = ({
    items,
    isLoading,
    error,
    title,
    word,
    type,
  }: {
    items: { translation: string }[] | null;
    isLoading: boolean;
    error: string | null;
    title: string;
    word: string;
    type: "word";
  }) => {
    const isDark = colorScheme.get() === "dark";

    if (isLoading) {
      return (
        <View className="items-center py-8">
          <ActivityIndicator size="large" color={isDark ? "#60A5FA" : "#3B82F6"} />
          <Text
            style={[GlobalFontStyleSheet.textMd]}
            className="mt-4 text-gray-400 dark:text-gray-500"
          >
            Loading {title.toLowerCase()}...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View className="flex-1 justify-center items-center">
          <Text className="text-red-500 dark:text-red-400 text-center">{error}</Text>
        </View>
      );
    }

    if (!items || items.length === 0) {
      return (
        <View className="flex-1 justify-center items-center">
          <Text
            style={GlobalFontStyleSheet.textLg}
            className="text-center text-gray-500 dark:text-gray-400"
          >
            No {title.toLowerCase()} found.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView className="flex-1 w-full pt-6">
        <Text
          style={GlobalFontStyleSheet.textXl}
          className="font-bold mb-6 text-center text-gray-900 dark:text-white"
        >
          {title}
        </Text>
        {items.map((meaning, index) => {
          // Create a unique key for this meaning (combining the passed word and translation)
          const uniqueKey = `${word}-${meaning.translation}`;
          return (
            <View key={index} className="mb-6 relative px-12">
              <Text
                style={GlobalFontStyleSheet.textLg}
                className="mb-2 text-gray-900 dark:text-white"
              >
                {meaning.translation}
              </Text>
              <SaveButton
                item={{ source: word, translation: meaning.translation }}
                uniqueKey={uniqueKey}
                onPress={() =>
                  handleSaveExample(
                    { source: word, translation: meaning.translation },
                    type,
                    uniqueKey
                  )
                }
              />
            </View>
          );
        })}
      </ScrollView>
    );
  };

  // Add a dimension check for small devices
  const { width } = Dimensions.get('window');
  const IS_SMALL_DEVICE = width < 360; // Threshold for very small devices

  return (
    <>
      <View className={cx(
        "flex-row justify-between mt-4",
        IS_SMALL_DEVICE ? "px-2" : "px-4",
        isTablet && "max-w-[500px] self-center" // Constrain width on tablet
      )}>
        <View className={cx("items-center", isTablet ? "w-28" : "w-20")}>
          <TouchableOpacity
            onPress={fetchAllMeanings}
            className="items-center w-full"
          >
            <View className={cx(
              "items-center justify-center mb-1",
              isTablet ? "w-8 h-8" : "w-6 h-6"
            )}>
              <FontAwesomeIcon 
                icon={faLanguage} 
                size={isTablet ? 24 : 22} 
                color={colorScheme.get() === "dark" ? "rgba(15, 117, 224, 0.7)" : "rgba(15, 117, 224, 0.5)"} 
              />
            </View>
            <Text
              className="text-center font-medium text-gray-600 dark:text-gray-300"
              style={[
                GlobalFontStyleSheet.textSm,
                isTablet && { fontSize: 13, lineHeight: 16 }
              ]}
              numberOfLines={1}
            >
              Meanings
            </Text>
          </TouchableOpacity>
        </View>

        <View className={cx("items-center", isTablet ? "w-28" : "w-20")}>
          <TouchableOpacity
            onPress={fetchUsageExamples}
            className="items-center w-full"
          >
            <View className={cx(
              "items-center justify-center mb-1",
              isTablet ? "w-8 h-8" : "w-6 h-6"
            )}>
              <FontAwesomeIcon 
                icon={faQuoteLeft} 
                size={isTablet ? 24 : 22} 
                color={colorScheme.get() === "dark" ? "rgba(16, 185, 129, 0.7)" : "rgba(16, 185, 129, 0.5)"} 
              />
            </View>
            <Text
              className="text-center font-medium text-gray-600 dark:text-gray-300"
              style={[
                GlobalFontStyleSheet.textSm,
                isTablet && { fontSize: 13, lineHeight: 16 }
              ]}
              numberOfLines={1}
            >
              Sentences
            </Text>
          </TouchableOpacity>
        </View>

        <View className={cx("items-center", isTablet ? "w-28" : "w-20")}>
          <TouchableOpacity
            onPress={fetchPhraseExamples}
            className="items-center w-full"
          >
            <View className={cx(
              "items-center justify-center mb-1",
              isTablet ? "w-8 h-8" : "w-6 h-6"
            )}>
              <FontAwesomeIcon 
                icon={faComments} 
                size={isTablet ? 24 : 22} 
                color={colorScheme.get() === "dark" ? "rgba(99, 102, 241, 0.7)" : "rgba(99, 102, 241, 0.5)"} 
              />
            </View>
            <Text
              className="text-center font-medium text-gray-600 dark:text-gray-300"
              style={[
                GlobalFontStyleSheet.textSm,
                isTablet && { fontSize: 13, lineHeight: 16 }
              ]}
              numberOfLines={1}
            >
              Phrases
            </Text>
          </TouchableOpacity>
        </View>

        <View className={cx("items-center", isTablet ? "w-28" : "w-20")}>
          <TouchableOpacity
            onPress={fetchSimilarWords}
            className="items-center w-full"
          >
            <View className={cx(
              "items-center justify-center mb-1",
              isTablet ? "w-8 h-8" : "w-6 h-6"
            )}>
              <FontAwesomeIcon 
                icon={faArrowsRepeat} 
                size={isTablet ? 24 : 22} 
                color={colorScheme.get() === "dark" ? "rgba(245, 158, 11, 0.7)" : "rgba(245, 158, 11, 0.5)"} 
              />
            </View>
            <Text
              className="text-center font-medium text-gray-600 dark:text-gray-300"
              style={[
                GlobalFontStyleSheet.textSm,
                isTablet && { fontSize: 13, lineHeight: 16 }
              ]}
              numberOfLines={1}
            >
              Similar
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modals */}
      <SlidingModal visible={showUsageExamplesModal} onClose={() => setShowUsageExamplesModal(false)}>
        <View className="w-full h-full">
          <ExamplesList
            items={usageExamples}
            isLoading={isUsageExamplesLoading}
            error={usageExamplesError}
            title="Usage Examples"
            type="sentence"
          />
        </View>
      </SlidingModal>

      <SlidingModal visible={showPhraseExamplesModal} onClose={() => setShowPhraseExamplesModal(false)}>
        <View className="w-full h-full">
          <ExamplesList
            items={phraseExamples}
            isLoading={isPhraseExamplesLoading}
            error={phraseExamplesError}
            title="Common Phrases"
            type="phrase"
          />
        </View>
      </SlidingModal>

      <SlidingModal visible={showSimilarWordsModal} onClose={() => setShowSimilarWordsModal(false)}>
        <View className="w-full h-full">
          <ExamplesList
            items={similarWords}
            isLoading={isSimilarWordsLoading}
            error={similarWordsError}
            title="Similar Words"
            type="word"
          />
        </View>
      </SlidingModal>

      <SlidingModal visible={showAllMeaningsModal} onClose={() => setShowAllMeaningsModal(false)}>
        <View className="w-full h-full">
          <MeaningsList
            items={allMeanings}
            isLoading={isAllMeaningsLoading}
            error={allMeaningsError}
            title="All Meanings"
            word={currentWord}
            type="word"
          />
        </View>
      </SlidingModal>
    </>
  );
};

export default CardActionButtons;
