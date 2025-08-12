import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TouchableOpacity } from 'react-native';
import { GlobalFontStyleSheet } from '@/constants/Font';
import VocabWordModal from '@/components/speak/VocabWordModal';
import EventBus from '@/services/EventBus';
import useDevice from '@/hooks/useDevice';

interface InteractiveTextProps {
  text: string;
  languageCode?: string;
  colorScheme?: 'light' | 'dark';
  messageId?: string;
  isCorrection?: boolean;
  parseCorrection?: (text: string) => { text: string; type: 'del' | 'ins' | 'b' | 'normal' }[];
  textSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  fontWeight?: 'normal' | 'medium' | 'bold';
  lineHeight?: number;
  onWordTranslated?: (word: string, translation: string) => void;
  onWordSaved?: (word: string, translation: string) => void;
  tailwindClassName?: string;
  targetLanguage?: string;
  suggestionId?: string;
  activeSuggestionId?: string | null;
  onWordLongPress?: () => void;
}

export const InteractiveText: React.FC<InteractiveTextProps> = ({
  text,
  languageCode,
  colorScheme = 'light',
  messageId,
  isCorrection = false,
  parseCorrection,
  textSize,
  fontWeight,
  lineHeight,
  onWordTranslated,
  onWordSaved,
  tailwindClassName,
  targetLanguage = 'en',
  suggestionId,
  activeSuggestionId,
  onWordLongPress
}) => {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedSentence, setSelectedSentence] = useState<string | null>(null);
  const [isVocabModalVisible, setIsVocabModalVisible] = useState(false);
  const { isTablet } = useDevice();

  // Add RTL text detection
  const isRTLText = (text: string): boolean => {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0590-\u05FF]/.test(text);
  };

  // Add phrase selection state
  const [isPhraseSelectionMode, setIsPhraseSelectionMode] = useState(false);
  const [firstSelectedWordIndex, setFirstSelectedWordIndex] = useState<number | null>(null);
  const [selectedPhraseRange, setSelectedPhraseRange] = useState<{start: number, end: number} | null>(null);

  // Reset phrase selection state when suggestionId or activeSuggestionId changes
  useEffect(() => {
    if (suggestionId !== activeSuggestionId) {
      setIsPhraseSelectionMode(false);
      setFirstSelectedWordIndex(null);
      setSelectedPhraseRange(null);
    }
  }, [suggestionId, activeSuggestionId]);

  // Helper function to get the text style based on size
  const getTextStyle = () => {
    let styleKey: keyof typeof GlobalFontStyleSheet | undefined;
    if (textSize) {
      switch (textSize) {
        case 'sm': styleKey = 'textSm'; break;
        case 'base': styleKey = 'textBase'; break;
        case 'lg': styleKey = 'textLg'; break;
        case 'xl': styleKey = 'textXl'; break;
        case '2xl': styleKey = 'text2Xl'; break;
        // 'xs', '3xl', '4xl' and other unmapped textSize values will use the default style below
      }
    }

    if (styleKey && GlobalFontStyleSheet[styleKey]) {
      return GlobalFontStyleSheet[styleKey];
    }
    
    // Otherwise use the default tablet-aware sizing
    return isTablet ? GlobalFontStyleSheet.textMd : GlobalFontStyleSheet.textLg;
  };

  const getSentenceFromContent = (content: string, word: string): string => {
    // First clean the content
    const cleanContent = content.trim();
    
    const endOfSentenceRegex = /[.!?。！？។៕။…\u3002\uFF01\uFF1F\u0964\u0965]/;
    
    // Split content into sentences, but keep the sentence endings
    const sentences = cleanContent.split(new RegExp(`(?<=${endOfSentenceRegex.source})`))
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Find the sentence containing the word
    const targetSentence = sentences.find(sentence => {
      // Create word boundaries to match whole words only, accounting for punctuation
      const wordPattern = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape special characters
      const wordRegex = new RegExp(`(?:^|\\s|[,;:"'¿¡])(${wordPattern})(?:$|\\s|[,;:"'?!.])`,'i');
      return wordRegex.test(sentence);
    });

    if (targetSentence) {
      return cleanSentence(targetSentence);
    }

    // If no sentence found, return a smaller context around the word
    const words = cleanContent.split(/\s+/);
    const wordIndex = words.findIndex(w => {
      const cleanW = w.replace(/^[.,!?¿¡;:()《》「」『』（）、。！？]+|[.,!?¿¡;:()《》「」『』（）、。！？]+$/g, '');
      return cleanW.toLowerCase() === word.toLowerCase();
    });

    if (wordIndex !== -1) {
      const start = Math.max(0, wordIndex - 5);
      const end = Math.min(words.length, wordIndex + 6);
      return words.slice(start, end).join(' ');
    }

    return '';
  };

  const cleanSentence = (sentence: string): string => {
    const cleanups: [RegExp, string][] = [
      [/\s+/g, ' '],
      [/\s*([,.:;?!»)}\]°"'%‰‱])/g, '$1'],
      [/([«({\[])\s*/g, '$1'],
      [/(\S)\s*([:.;,])/g, '$1$2'],
      [/(\S)\s*([''])\s*(\S)/g, '$1$2$3'],
      [/"(\S)/g, '" $1'],
      [/(\S)"/g, '$1 "'],
      [/([.!?])\s*"/g, '$1"'],
      [/^\s*([^\w\s]+\s*)*/, '']
    ];

    return cleanups.reduce((text, [pattern, replacement]) =>
      text.replace(pattern, replacement), sentence).trim();
  };

  const handleWordPress = (word: string, wordIndex: number) => {
    try {
      EventBus.emit('pause-audio');

      if (isPhraseSelectionMode) {
        // If we're in phrase selection mode, select the phrase
        const words = text.split(/\s+/);
        const start = Math.min(firstSelectedWordIndex!, wordIndex);
        const end = Math.max(firstSelectedWordIndex!, wordIndex);
        const phrase = words.slice(start, end + 1).join(' ');
        
        // If the phrase is just one word, treat it as a regular word selection
        if (start === end) {
          const cleanWord = word.replace(/^[.,!?¿¡;:()《》「」『』（）、。！？]+|[.,!?¿¡;:()《》「」『』（）、。！？]+$/g, '');
          const plainText = text.replace(/<[^>]+>/g, '');
          const sentence = getSentenceFromContent(plainText, cleanWord);
          
          setSelectedWord(cleanWord);
          setSelectedSentence(sentence);
          setIsVocabModalVisible(true);
        } else {
          // Update the selected phrase range
          setSelectedPhraseRange({ start, end });
          
          // Open VocabWordModal with the selected phrase
          setSelectedWord(phrase);
          setSelectedSentence(text);
          setIsVocabModalVisible(true);
        }
        
        // Reset selection mode
        setIsPhraseSelectionMode(false);
        setFirstSelectedWordIndex(null);
      } else {
        // Normal word selection
        const cleanWord = word.replace(/^[.,!?¿¡;:()《》「」『』（）、。！？]+|[.,!?¿¡;:()《》「」『』（）、。！？]+$/g, '');
        const plainText = text.replace(/<[^>]+>/g, '');
        const sentence = getSentenceFromContent(plainText, cleanWord);
        
        setSelectedWord(cleanWord);
        setSelectedSentence(sentence);
        setIsVocabModalVisible(true);
      }
    } catch (error) {
      console.error('Error in handleWordPress:', error);
      // Reset states in case of error
      setIsPhraseSelectionMode(false);
      setFirstSelectedWordIndex(null);
      setSelectedPhraseRange(null);
      setSelectedWord(null);
      setSelectedSentence(null);
    }
  };

  const handleWordLongPress = (word: string, wordIndex: number) => {
    EventBus.emit('pause-audio');
    setIsPhraseSelectionMode(true);
    setFirstSelectedWordIndex(wordIndex);
    setSelectedPhraseRange(null);
    onWordLongPress?.();
  };

  // Determine the appropriate line height
  const defaultLineHeight = isTablet ? 40 : 28;
  const effectiveLineHeight = lineHeight || defaultLineHeight;

  // Determine effective font family based on fontWeight prop
  const baseStyle = getTextStyle();
  let effectiveFontFamily = baseStyle.fontFamily; // Default from size

  if (fontWeight === 'bold') {
    effectiveFontFamily = 'Lato-Bold';
  } else if (fontWeight === 'medium') {
    effectiveFontFamily = 'Lato-Medium';
  } else if (fontWeight === 'normal') {
    effectiveFontFamily = 'Lato-Regular';
  }

  const combinedTextStyle = [
    { ...baseStyle, fontFamily: effectiveFontFamily }, // Apply size and determined font family
    { lineHeight: effectiveLineHeight, marginRight: 4 } // Apply line height and margin
  ];

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {(isRTLText(text) ? text.split(/\s+/).reverse() : text.split(/\s+/)).map((word, index) => {
          const isInSelectedPhrase = selectedPhraseRange && 
            index >= selectedPhraseRange.start && 
            index <= selectedPhraseRange.end;
          const isFirstSelected = isPhraseSelectionMode && firstSelectedWordIndex === index;
          
          return (
            <Pressable
              key={index}
              onPress={() => handleWordPress(word, index)}
              onLongPress={() => handleWordLongPress(word, index)}
            >
              <Text
                style={[
                  combinedTextStyle,
                  {
                    backgroundColor: isInSelectedPhrase ? (colorScheme === 'light' ? 'rgba(0, 68, 143, 0.1)' : 'rgba(96, 165, 250, 0.4)') : 'transparent',
                    textDecorationLine: isFirstSelected ? 'underline' : 'none',
                    textDecorationColor: colorScheme === 'light' ? '#00448f' : 'white',
                  }
                ]}
                className={`${colorScheme === 'dark' ? 'text-white' : 'text-blue-600'} ${tailwindClassName || ''}`}
              >
                {word}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <VocabWordModal
        visible={isVocabModalVisible}
        onClose={() => {
          setIsVocabModalVisible(false);
          setSelectedWord(null);
          setSelectedSentence(null);
          setSelectedPhraseRange(null);
          // When the modal is closed, emit a resume event so the audio resumes
          EventBus.emit('resume-audio');
        }}
        word={selectedWord || ''}
        language={languageCode || ''}
        targetLanguage={targetLanguage}
        contextSentence={selectedSentence || ''}
        onWordTranslated={onWordTranslated}
        onWordSaved={onWordSaved}
        isPhrase={selectedPhraseRange !== null}
      />
    </View>
  );
};
