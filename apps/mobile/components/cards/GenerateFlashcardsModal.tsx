import React, { useState, useEffect } from 'react';
import { View, TextInput, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCheck, faChevronDown } from '@fortawesome/pro-solid-svg-icons';
import SlidingModal from '@/components/shared/SlidingModal';
import FlashcardService, { GeneratedFlashcard, WordType } from '@/services/FlashcardService';
import useUserSettings from '@/services/api/useUserSettings';
import { colorScheme } from 'nativewind';
import { Text } from 'react-native';
import NativePicker from '@/components/shared/NativePicker';

interface GenerateFlashcardsModalProps {
  visible: boolean;
  onClose: () => void;
  flashcardService: FlashcardService;
  onFlashcardsGenerated: () => void;
}

export default function GenerateFlashcardsModal({ 
  visible, 
  onClose, 
  flashcardService,
  onFlashcardsGenerated 
}: GenerateFlashcardsModalProps) {
  const [generationType, setGenerationType] = useState<"word" | "sentence">("word");
  const [count, setCount] = useState("20");
  const [topic, setTopic] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedWords, setGeneratedWords] = useState<GeneratedFlashcard[]>([]);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [wordType, setWordType] = useState<WordType>('recently_saved');
  const { userSettings } = useUserSettings();

  useEffect(() => {
    setCount(generationType === "word" ? "20" : "10");
  }, [generationType]);

  const typeOptions = [
    { label: "Words", value: "word" },
    { label: "Sentences", value: "sentence" }
  ];

  const getCountOptions = () => {
    if (generationType === "word") {
      return [
        { label: "20", value: "20" },
        { label: "40", value: "40" }
      ];
    }
    return [
      { label: "10", value: "10" },
      { label: "20", value: "20" }
    ];
  };

  const wordTypeOptions = [
    { label: "Recently Saved Words", value: "recently_saved" },
    { label: "Almost Learned Words", value: "almost_learned" },
    { label: "Words Due for Review", value: "next_due_for_review" }
  ];

  const handleCreateMore = async () => {
    try {
      setIsGenerating(true);

      let response;
      if (generationType === "word") {
        if (!topic) {
          throw new Error("Topic is required for word generation");
        }
        response = await flashcardService.generateWords(
          topic,
          parseInt(count)
        );
      } else {
        response = await flashcardService.generateSentences(
          wordType,
          parseInt(count)
        );
      }

      setGeneratedWords(response.generated_words);
    } catch (error) {
      console.error("Error generating vocabulary:", error);
      // TODO: Add error UI feedback
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddSelected = async () => {
    try {
      if (selectedWords.size === 0) return;

      const selectedItems = generatedWords.filter(item => 
        selectedWords.has(item.word)
      );

      // Create flashcards for each selected item
      await Promise.all(selectedItems.map(item => 
        flashcardService.addFlashcard({
          front: item.word,
          back: item.translation,
          language: userSettings?.team?.stream_language || "en",
          context_sentence: item.context_sentence,
          translated_sentence: item.context_translation,
          // Add sentence-specific tags when generating sentences
          tags: generationType === "word" 
            ? [topic.toLowerCase().trim()] 
            : ["sentence", "context sentence"]
        })
      ));

      onFlashcardsGenerated();
      handleClose();
    } catch (error) {
      console.error("Error adding selected words:", error);
      // TODO: Add error UI feedback
    }
  };

  const toggleWordSelection = (word: string) => {
    setSelectedWords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(word)) {
        newSet.delete(word);
      } else {
        newSet.add(word);
      }
      return newSet;
    });
  };

  const handleClose = () => {
    setGeneratedWords([]);
    setSelectedWords(new Set());
    setTopic("");
    onClose();
  };

  return (
    <SlidingModal visible={visible} onClose={handleClose}>
      {!generatedWords.length ? (
        <>
          <Text 
            style={[GlobalFontStyleSheet.textXl, { 
              color: colorScheme.get() === "dark" ? "#FFFFFF" : "#111827",
              fontWeight: '700',
              marginBottom: 24
            }]}
          >
            Generate Flashcards
          </Text>

          {isGenerating ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text 
                style={[GlobalFontStyleSheet.textMd, { 
                  marginTop: 16,
                  color: colorScheme.get() === "dark" ? "#9CA3AF" : "#6B7280"
                }]}
              >
                Generating new {generationType}s...
              </Text>
            </View>
          ) : (
            <>
              <Text 
                style={[GlobalFontStyleSheet.textMd, { 
                  color: colorScheme.get() === "dark" ? "#9CA3AF" : "#6B7280",
                  marginBottom: 16
                }]}
              >
                What do you want to create?
              </Text>

              {/* Count and Type Selection Row */}
              <View className="flex-row items-center gap-3 mb-6">
                <View className="flex-1">
                  <NativePicker
                    items={getCountOptions()}
                    onValueChange={(value) => setCount(value)}
                    selectedValue={count}
                    placeholderLabel="Select count"
                    faIcon={faChevronDown}
                  />
                </View>
                <View className="flex-1">
                  <NativePicker
                    items={typeOptions}
                    onValueChange={(value) => setGenerationType(value as "word" | "sentence")}
                    selectedValue={generationType}
                    placeholderLabel="Select type"
                    faIcon={faChevronDown}
                  />
                </View>
              </View>

              {/* Related to / That use my */}
              <Text 
                style={[GlobalFontStyleSheet.textMd, { 
                  color: colorScheme.get() === "dark" ? "#9CA3AF" : "#6B7280",
                  textAlign: 'center',
                  marginBottom: 12
                }]}
              >
                {generationType === "word" ? "related to" : "that use my"}
              </Text>

              {/* Topic Input or Word Type Selection */}
              {generationType === "word" ? (
                <TextInput
                  className="bg-white dark:bg-gray-700 px-4 py-3 rounded-lg text-gray-900 dark:text-white mb-6 border border-gray-300 dark:border-gray-600"
                  value={topic}
                  onChangeText={setTopic}
                  placeholder="e.g. Food, Travel, Business"
                  placeholderTextColor="#9ca3af"
                  style={GlobalFontStyleSheet.textMd}
                />
              ) : (
                <View className="mb-6">
                  <NativePicker
                    items={wordTypeOptions}
                    onValueChange={(value) => setWordType(value as WordType)}
                    selectedValue={wordType}
                    placeholderLabel="Select word type"
                    faIcon={faChevronDown}
                  />
                </View>
              )}

              <TouchableOpacity
                className="bg-[#FC5D5D] py-3 rounded-lg mt-6"
                onPress={handleCreateMore}
              >
                <Text style={[GlobalFontStyleSheet.textMd, { 
                  color: '#FFFFFF',
                  textAlign: 'center',
                  fontWeight: '600'
                }]}>
                  Generate
                </Text>
              </TouchableOpacity>
            </>
          )}
        </>
      ) : (
        <>
          <Text 
            style={[GlobalFontStyleSheet.textLg, { 
              color: colorScheme.get() === "dark" ? "#FFFFFF" : "#111827",
              fontWeight: '700',
              marginBottom: 24
            }]}
          >
            Select Words to Add
          </Text>

          <ScrollView className="max-h-[400px] mb-4">
            {generatedWords.map((item, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => toggleWordSelection(item.word)}
                className={`flex-row items-center justify-between p-4 mb-2 rounded-lg ${
                  selectedWords.has(item.word)
                    ? "bg-[#FC5D5D]/10 dark:bg-[#FC5D5D]/20"
                    : "dark:bg-gray-800"
                }`}
              >
                <View className="flex-1">
                  <Text
                    style={[
                      generationType === "word" ? GlobalFontStyleSheet.textLg : GlobalFontStyleSheet.textMd,
                      {
                        color: colorScheme.get() === "dark" ? "#FFFFFF" : "#111827",
                        fontWeight: '600',
                        marginBottom: 4
                      }
                    ]}
                  >
                    {item.word}
                  </Text>
                  <Text
                    style={[
                      generationType === "word" ? GlobalFontStyleSheet.textMd : GlobalFontStyleSheet.textSm,
                      {
                        color: colorScheme.get() === "dark" ? "#9CA3AF" : "#6B7280",
                      }
                    ]}
                  >
                    {item.translation}
                  </Text>
                  {item.context_sentence && (
                    <Text
                      style={[GlobalFontStyleSheet.textSm, {
                        color: colorScheme.get() === "dark" ? "#9CA3AF" : "#6B7280",
                        marginTop: 4,
                        fontStyle: 'italic'
                      }]}
                    >
                      {item.context_sentence}
                    </Text>
                  )}
                </View>
                <View
                  className={`w-6 h-6 border-2 rounded-md flex items-center justify-center ml-4
                  ${
                    selectedWords.has(item.word)
                      ? "bg-[#FC5D5D] border-[#FC5D5D]"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {selectedWords.has(item.word) && (
                    <FontAwesomeIcon
                      icon={faCheck}
                      size={12}
                      color="#ffffff"
                    />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View className="flex-row gap-2">
            <TouchableOpacity
              className="flex-1 py-3 rounded-lg border border-gray-200 dark:border-gray-700"
              onPress={() =>
                setSelectedWords(new Set(generatedWords.map((w) => w.word)))
              }
            >
              <Text style={[GlobalFontStyleSheet.textMd, {
                textAlign: 'center',
                fontWeight: '600',
                color: colorScheme.get() === "dark" ? "#FFFFFF" : "#374151"
              }]}>
                Select All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 py-3 rounded-lg bg-[#FC5D5D]"
              onPress={handleAddSelected}
              disabled={selectedWords.size === 0}
            >
              <Text style={[GlobalFontStyleSheet.textMd, {
                color: '#FFFFFF',
                textAlign: 'center',
                fontWeight: '600'
              }]}>
                Add Selected ({selectedWords.size})
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SlidingModal>
  );
}
