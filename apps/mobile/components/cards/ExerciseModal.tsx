import React, { useState } from 'react';
import { View, TouchableOpacity, Dimensions, Text } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
  faBrain,
  faHeadphones,
  faMicrophoneLines,
  faCircleQuestion,
  faComments,
} from '@fortawesome/pro-regular-svg-icons';
import SlidingModal from '@/components/shared/SlidingModal';
import { ThemedText } from '@/components/shared/ThemedText';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { getScreenSizeCategory } from '@/constants/Font';
import { UserSettingsContext } from '@/contexts/UserSettingsContext';

interface PracticeModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectMode: (mode: 'Recall' | 'Listen' | 'Produce' | 'Cloze' | 'Chat') => void;
}

type ModeKey = 'Recall' | 'Listen' | 'Produce' | 'Cloze' | 'Chat';

export default function PracticeModal({ visible, onClose, onSelectMode }: PracticeModalProps) {
  const userSettingsContext = React.useContext(UserSettingsContext);
  const userSettings = userSettingsContext?.userSettings;
  const screenSizeCategory = getScreenSizeCategory();
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Helper function to capitalize language names
  const capitalizeLanguage = (language: string) => {
    return language.charAt(0).toUpperCase() + language.slice(1).toLowerCase();
  };

  // Get languages from user settings, with fallbacks
  const nativeLanguage = capitalizeLanguage(userSettings?.team.langua_native_language || 'English');
  const streamLanguage = capitalizeLanguage(userSettings?.team.stream_language || 'Spanish');

  const modes: Array<{ key: ModeKey; description: string; icon: any }> = [
    {
      key: 'Recall',
      description: `Translate your vocab into ${nativeLanguage}`,
      icon: faBrain,
    },
    {
      key: 'Listen',
      description: `Like Recall, but listen instead of reading`,
      icon: faHeadphones,
    },
    {
      key: 'Produce',
      description: `Translate from ${nativeLanguage} to ${streamLanguage}`,
      icon: faMicrophoneLines,
    },
    {
      key: 'Cloze',
      description: 'Fill in missing words in sentences',
      icon: faCircleQuestion,
    },
    {
      key: 'Chat',
      description: 'Talk with AI using your saved vocabulary',
      icon: faComments,
    },
  ];

  const renderCard = ({ key, description, icon }: { key: ModeKey; description: string; icon: any }) => {
    return (
      <TouchableOpacity
        key={key}
        className="flex-row items-start border border-gray-50 dark:border-gray-700 rounded-2xl px-7 py-5 mb-4 bg-white dark:bg-gray-800"
        onPress={() => onSelectMode(key)}
        activeOpacity={0.8}
      >
        <View className="w-14 h-14 rounded-lg bg-red-50 dark:bg-red-400/10 items-center justify-center mr-4">
          <FontAwesomeIcon icon={icon} size={24} color="#F87171" />
        </View>
        <View className="flex-1 pt-2">
          <ThemedText
            style={[
              GlobalFontStyleSheet.textLg,
              { fontFamily: 'lato-bold' }
            ]}
            className="font-bold mb-1 text-gray-900 dark:text-white"
          >
            {key}
          </ThemedText>
          <ThemedText
            style={[GlobalFontStyleSheet.textSm, { lineHeight: 18 }]}
            className="text-gray-700 dark:text-gray-300 pr-2"
          >
            {description}
          </ThemedText>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SlidingModal visible={visible} onClose={onClose}>
      <View className="w-full h-full pt-6">
        <ThemedText
          style={[GlobalFontStyleSheet.text2Xl, { marginBottom: 4 }]}
          className="font-bold pb-4"
        >
          Choose Practice Mode
        </ThemedText>
        <ThemedText
          style={[GlobalFontStyleSheet.textMd, { marginBottom: 16, lineHeight: 22 }]}
          className="text-gray-700 dark:text-gray-300"
        >
          Select a practice mode to help you master your saved vocabulary.
        </ThemedText>
        
        <View className="pt-2">
          {modes.map(renderCard)}
        </View>

        <TouchableOpacity
          onPress={() => setShowHowItWorks(true)}
          className="pb-4 pt-2"
        >
          <ThemedText
            style={GlobalFontStyleSheet.textSm}
            className="text-center underline pb-12"
            lightColor="#6B7280"
            darkColor="#9CA3AF"
          >
            How does it work?
          </ThemedText>
        </TouchableOpacity>
        
        {/* How does it work modal */}
        <SlidingModal
            visible={showHowItWorks}
            onClose={() => setShowHowItWorks(false)}
        >
            
            <ThemedText
            style={[GlobalFontStyleSheet.textMd, { lineHeight: 24 }]}
            className="text-gray-700 dark:text-gray-300 mb-4"
            >
            Try to recall the translation. You can say it, write it, or simply say it in your head and tap the card to reveal the answer.

            </ThemedText>
            <ThemedText
            style={[GlobalFontStyleSheet.textMd, { lineHeight: 24 }]}
            className="text-gray-700 dark:text-gray-300"
            >
            AI will indicate whether you were correct if you speak or write. If you knew the answer, swipe right.
            If you were incorrect, swipe left. Correct but guessed? Swipe down. Feel free to ignore the AI feedback if it mishears you.
            </ThemedText>
            <ThemedText
            style={[GlobalFontStyleSheet.textMd, { lineHeight: 24 }]}
            className="text-gray-700 dark:text-gray-300 pt-5"
            >
            <Text className="font-bold">Note: </Text>
            You can apply filters to adjust your focus.
            </ThemedText>
            <ThemedText
            style={[GlobalFontStyleSheet.textMd, { lineHeight: 24 }]}
            className="text-gray-700 dark:text-gray-300 pt-5"
            >
            Alternatively, select Chat to talk with AI using your saved vocab (this won't update your vocab stats)
            </ThemedText>
            
        </SlidingModal>
      </View>
    </SlidingModal>
  );
} 
