import React from 'react';
import { useFeatureFlag } from 'posthog-react-native';
import NewFlashcardPage from '@/components/cards/NewFlashcardPage';
import FlashcardPage from '@/components/cards/FlashcardPage';

export default function CardsIndex() {
  const isNewFlashcardExerciseEnabled = useFeatureFlag('new_flashcard_exercise');

  if (isNewFlashcardExerciseEnabled) {
    return <NewFlashcardPage />;
  }

  return <FlashcardPage />;
}
