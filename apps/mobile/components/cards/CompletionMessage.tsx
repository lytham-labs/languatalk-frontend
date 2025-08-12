import React, { useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { ThemedText } from "@/components/shared/ThemedText";
import { GlobalFontStyleSheet } from "@/constants/Font";
import { useRouter } from "expo-router";
import FlashcardService from "@/services/FlashcardService";
import SlidingModal from "@/components/shared/SlidingModal";

interface CompletionMessageProps {
  flashcardService: FlashcardService;
  onReset: (clearFilters?: boolean) => void;
  points: number;
  hasNoFlashcards?: boolean;
  noCardsAvailable?: boolean;
  hasNoCards?: boolean;
  activeFilters?: Record<string, any>;
  hasAttemptedUnknownVocab?: boolean;
  onCloseModal?: () => void;
}

const NoCardsMessage: React.FC<{ 
  hasNoFlashcards: boolean; 
  noCardsAvailable?: boolean; 
  hasNoCards?: boolean; 
  activeFilters?: Record<string, any>;
  points: number;
  onReset: (clearFilters?: boolean) => void;
  hasAttemptedUnknownVocab?: boolean;
  onCloseModal?: () => void;
}> = ({ 
  hasNoFlashcards, 
  noCardsAvailable, 
  hasNoCards, 
  activeFilters,
  points,
  onReset,
  hasAttemptedUnknownVocab,
  onCloseModal,
}) => {
  const router = useRouter();

  if (hasNoFlashcards) {
    return (
      <View className="flex-1 justify-center items-center px-8">
        <View className="w-full max-w-md ">
          <ThemedText
            style={GlobalFontStyleSheet.text2Xl}
            className="font-bold mb-8 text-center text-gray-900 dark:text-white"
          >
             You don't have any flashcards due for review
          </ThemedText>

          <ThemedText
            style={GlobalFontStyleSheet.textLg}
            className="mb-6 text-gray-700 dark:text-gray-200 text-center"
          >
            You can add vocab by:
          </ThemedText>

          <View className="mb-8 space-y-4">
            <ThemedText
              style={GlobalFontStyleSheet.textMd}
              className="text-gray-600 dark:text-gray-300"
            >
              • clicking the + button after selecting words during chats
            </ThemedText>
            <ThemedText
              style={GlobalFontStyleSheet.textMd}
              className="text-gray-600 dark:text-gray-300"
            >
              • selecting 'Actions' on the flashcards page and creating lists with AI
            </ThemedText>
            <ThemedText
              style={GlobalFontStyleSheet.textMd}
              className="text-gray-600 dark:text-gray-300 mt-5 italic"
            >
              Or if you applied a filter, remove the filter to see hidden words. 
            </ThemedText>
          </View>

          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-[#00448F]/90 dark:bg-gray-700 px-6 py-4 rounded-xl w-full"
          >
            <ThemedText
              style={GlobalFontStyleSheet.textMd}
              className="!text-white text-center font-semibold"
            >
              Back to Flashcards
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center items-center px-8">
      <View className="w-full max-w-md">
        <ThemedText
          style={[GlobalFontStyleSheet.text2Xl]}
          className="font-bold mb-8 text-center text-[#00448F] dark:text-peach-500"
        >
          All of today's flashcards completed! 🙌
        </ThemedText>

        <View className="mb-8">
          {points === 0 ? (
            <ThemedText
              style={[GlobalFontStyleSheet.textLg]}
              className="font-bold mb-4 text-gray-900 dark:text-white"
            >
              Continue learning...
            </ThemedText>
          ) : (
            <ThemedText
              style={[GlobalFontStyleSheet.textLg]}
              className="font-bold mb-4 text-gray-900 dark:text-white"
            >
              You've earned {points} {points === 1 ? 'point' : 'points'}! If you have time, why not...
            </ThemedText>
          )}

          <View>
            <TouchableOpacity 
              onPress={() => {
                router.push("/(tabs)/speak" as any);
                setTimeout(() => {
                  router.setParams({ selectedOption: "Vocab & Games" });
                }, 100);
              }}
              className="w-full bg-[#e6eeff] rounded-xl p-4 flex-row items-center mb-3"
            >
              <Text className="text-xl mr-2">💬</Text>
              <ThemedText style={[GlobalFontStyleSheet.textMd, { color: '#00448F' }]}>
                Chat using your vocab
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.push("/(tabs)/speak" as any)}
              className="w-full bg-[#f5e6ff] rounded-xl p-4 flex-row items-center mb-3"
            >
              <Text className="text-xl mr-2">🙊</Text>
              <ThemedText style={[GlobalFontStyleSheet.textMd, { color: '#7b1fa2' }]}>
                Start a new conversation
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <ThemedText
            style={[GlobalFontStyleSheet.textLg]}
            className="font-bold mb-4 text-gray-900 dark:text-white"
          >
            Want more flashcards?
          </ThemedText>

          <View>
            {((activeFilters?.status && activeFilters.status.length > 0) || 
              (activeFilters?.months && activeFilters.months.length > 0) || 
              (activeFilters?.tags && activeFilters.tags.length > 0)) && (
              <TouchableOpacity 
                onPress={() => onReset(true)}
                className="w-full bg-[#3d4752] dark:bg-[#3d4752] rounded-xl p-4 flex-row items-center justify-between mb-3"
              >
                <ThemedText style={GlobalFontStyleSheet.textMd} className="!text-white">
                  Remove your filter
                </ThemedText>
                <ThemedText className="text-xl">🔍</ThemedText>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              onPress={() => {
                onReset();
              }}
              className="w-full bg-[#3d4752] dark:bg-[#3d4752] rounded-xl p-4 flex-row items-center justify-between mb-3"
            >
              <ThemedText style={GlobalFontStyleSheet.textMd} className="!text-white">
                Practice unknown vocab again
              </ThemedText>
              <ThemedText className="text-xl">🧠</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.push("/(tabs)/settings/language-settings" as any)}
              className="w-full bg-[#3d4752] dark:bg-[#3d4752] rounded-xl p-4 flex-row items-center justify-between mb-3"
            >
              <ThemedText style={GlobalFontStyleSheet.textMd} className="!text-white">
                Switch settings to random mode
              </ThemedText>
              <ThemedText className="text-xl">🔀</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {hasAttemptedUnknownVocab && (
        <SlidingModal
          visible={true}
          onClose={() => {
            onCloseModal?.();
          }}
        >
          <View className="w-full h-full">
            <ThemedText
              style={[GlobalFontStyleSheet.textMd, { lineHeight: 24 }]}
            className="mt-6 text-gray-700 dark:text-gray-300 mb-2"
            >
              All your recently reviewed vocab is marked as learned. Want to practice your entire deck? Switch from spaced repetition to random mode.
            </ThemedText>
          </View>
        </SlidingModal>
      )}
    </View>
  );
};

const CompletionMessage: React.FC<CompletionMessageProps> = ({
  onReset,
  points,
  hasNoFlashcards,
  noCardsAvailable,
  hasNoCards,
  activeFilters,
  hasAttemptedUnknownVocab,
  onCloseModal,
}) => {
  const [showModal, setShowModal] = useState(false);
  
  return (
    <>
      <NoCardsMessage 
        hasNoFlashcards={hasNoFlashcards || false}
        noCardsAvailable={noCardsAvailable}
        hasNoCards={hasNoCards}
        activeFilters={activeFilters}
        points={points}
        onReset={onReset}
        hasAttemptedUnknownVocab={hasAttemptedUnknownVocab}
        onCloseModal={onCloseModal}
      />
    </>
  );
};

export default CompletionMessage;
