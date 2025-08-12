import React, { useState } from 'react';
import { View, TextInput, ScrollView } from 'react-native';
import { ThemedText } from './shared/ThemedText';
import { GlobalFontStyleSheet } from './shared/Font';
import SlidingModal from './shared/SlidingModal';
import Button from './shared/Button';
import * as Haptics from 'expo-haptics';

interface BatchCreateModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (flashcards: { front: string; back: string }[]) => Promise<void>;
  language: string;
}

export default function BatchCreateModal({ visible, onClose, onSubmit, language }: BatchCreateModalProps) {
  const [words, setWords] = useState('');
  const [translations, setTranslations] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!words.trim() || !translations.trim()) return;

    const wordsList = words.split('\n').map(w => w.trim()).filter(Boolean);
    const translationsList = translations.split('\n').map(t => t.trim()).filter(Boolean);

    if (wordsList.length !== translationsList.length) {
      // Show error message that lists don't match
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const flashcards = wordsList.map((word, index) => ({
        front: word,
        back: translationsList[index]
      }));

      await onSubmit(flashcards);
      setWords('');
      setTranslations('');
      onClose();
    } catch (error) {
      console.error('Error creating flashcards:', error);
      // Show error message
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SlidingModal visible={visible} onClose={onClose}>
      <View className="p-4">
        <ThemedText style={GlobalFontStyleSheet.text2Xl} className="font-bold mb-4">
          Batch Create Flashcards
        </ThemedText>
        
        <ThemedText style={GlobalFontStyleSheet.textMd} className="mb-2">
          Enter words or phrases (one per line)
        </ThemedText>
        <TextInput
          className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-4"
          multiline
          numberOfLines={6}
          value={words}
          onChangeText={setWords}
          placeholder="Word 1&#10;Word 2&#10;Word 3"
          placeholderTextColor="#666"
          style={GlobalFontStyleSheet.textMd}
        />

        <ThemedText style={GlobalFontStyleSheet.textMd} className="mb-2">
          Enter translations (one per line)
        </ThemedText>
        <TextInput
          className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6"
          multiline
          numberOfLines={6}
          value={translations}
          onChangeText={setTranslations}
          placeholder="Translation 1&#10;Translation 2&#10;Translation 3"
          placeholderTextColor="#666"
          style={GlobalFontStyleSheet.textMd}
        />

        <View className="flex-row gap-4">
          <Button
            title="Cancel"
            onPress={onClose}
            btnType="secondary"
            containerClassNames="flex-1"
          />
          <Button
            title={isSubmitting ? "Creating..." : "Create Flashcards"}
            onPress={handleSubmit}
            btnType="primary"
            containerClassNames="flex-1"
          />
        </View>
      </View>
    </SlidingModal>
  );
} 