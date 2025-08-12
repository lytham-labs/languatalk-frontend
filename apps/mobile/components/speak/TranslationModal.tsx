import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import SlidingModal from '../shared/SlidingModal';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { useColorScheme } from '@/hooks/useColorScheme';
import useDevice from '@/hooks/useDevice';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faQuoteLeft, faQuoteRight } from '@fortawesome/pro-solid-svg-icons';
import { RubyInteractiveText } from '@/components/shared/RubyInteractiveText';
import { InteractiveText } from '@/components/shared/InteractiveText';
import { ProcessedMessage } from '@/types/chat';

interface TranslationModalProps {
  visible: boolean;
  onClose: () => void;
  onOpen?: () => void;
  translation: string;
  originalText: string;
  processedOriginalText?: string | Partial<ProcessedMessage> | null;
  language?: string;
  targetLanguage?: string;
  onWordTranslated?: (word: string, translation: string) => void;
  onWordSaved?: (word: string, translation: string) => void;
  chatContextFlag?: boolean;
  japaneseReadingAidFlag?: boolean;
}

const TranslationModal: React.FC<TranslationModalProps> = ({
  visible,
  onClose,
  onOpen,
  translation,
  originalText,
  processedOriginalText = null,
  language,
  targetLanguage,
  onWordTranslated,
  onWordSaved,
  chatContextFlag = false,
  japaneseReadingAidFlag = false,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isTablet } = useDevice();

  const handleClose = () => {
    onClose();
  };

  const handleOpen = () => {
    onOpen?.();
  };

  return (
    <SlidingModal visible={visible} onClose={handleClose}>
      <View className={`px-4 rounded-xl my-5 py-3 ${
        isDark ? 'bg-gray-700/50' : 'bg-blue-50/30'
      }`}>
        <InteractiveText
          text={translation}
          languageCode={targetLanguage}
          targetLanguage={language}
          colorScheme={colorScheme || 'light'}
          onWordTranslated={onWordTranslated}
          onWordSaved={onWordSaved}
          textSize={isTablet ? 'base' : 'lg'}
          lineHeight={isTablet ? 38 : 28}
          tailwindClassName={`${isDark ? 'text-[#e5e5e5]' : 'text-[#1E3A8A]'}`}
        />
      </View>

      <View className={`pr-5 rounded-xl my-5 py-3 flex-row`}>
        <FontAwesomeIcon icon={faQuoteLeft} size={14} color={isDark ? '#F87171' : '#F87171'} />
        <View className="flex-1 ml-2">
          {processedOriginalText && chatContextFlag && japaneseReadingAidFlag ? (
            <RubyInteractiveText
              text={processedOriginalText}
              languageCode={language}
              targetLanguage={targetLanguage}
              colorScheme={colorScheme || 'light'}
              onWordTranslated={onWordTranslated}
              onWordSaved={onWordSaved}
              textSize="lg"
              tailwindClassName={`${isDark ? 'text-gray-100' : 'text-gray-500'}`}
            />
          ) : (
            <InteractiveText
              text={originalText}
              languageCode={language}
              targetLanguage={targetLanguage}
              colorScheme={colorScheme || 'light'}
              onWordTranslated={onWordTranslated}
              onWordSaved={onWordSaved}
              textSize={isTablet ? 'sm' : 'base'}
              lineHeight={isTablet ? 32 : 24}
              tailwindClassName={`${isDark ? 'text-gray-100' : 'text-gray-500'}`}
            />
          )}
        </View>
        <FontAwesomeIcon 
          icon={faQuoteRight} 
          size={14} 
          color={isDark ? '#F87171' : '#F87171'} 
          style={{ marginLeft: 4 }}
        />
      </View>
    </SlidingModal>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 10,
  },
  translationText: {
    lineHeight: 24,
  },
});

export default TranslationModal; 
