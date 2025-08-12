import React, { useState, useEffect } from 'react';
import cx from 'classnames';
import { View, Text, Pressable } from 'react-native';
import { GlobalFontStyleSheet } from '@/constants/Font';
import VocabWordModal from '@/components/speak/VocabWordModal';
import EventBus from '@/services/EventBus';
import useDevice from '@/hooks/useDevice';
import { ProcessedMessage, Line, PressableSegment, Segment } from '@/types/chat';
import { useChatData } from '@/contexts/ChatDataContext';

interface RubyInteractiveTextProps {
  text: string | ProcessedMessage | Partial<ProcessedMessage>;
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

export const RubyInteractiveText: React.FC<RubyInteractiveTextProps> = ({
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
  const { state: chatDataState } = useChatData();
  const pronunciationCharacters = chatDataState?.chat.pronunciation_characters;

  // Add phrase selection state
  const [isPhraseSelectionMode, setIsPhraseSelectionMode] = useState(false);
  const [firstSelectedWordIndex, setFirstSelectedWordIndex] = useState<number | null>(null);
  const [selectedPhraseRange, setSelectedPhraseRange] = useState<{start: number, end: number} | null>(null);

  // Helper function to extract text content and lines from different input types
  const getTextData = () => {
    if (typeof text === 'string') {
      return { textContent: text, lines: null, isProcessedMessage: false };
    } else if (text && typeof text === 'object' && 'content' in text) {
      // ProcessedMessage or Partial<ProcessedMessage> type
      const processedMessage = text as ProcessedMessage | Partial<ProcessedMessage>;
      return { 
        textContent: processedMessage.content || '', 
        lines: processedMessage.lines || null, 
        isProcessedMessage: true 
      };
    }
    return { textContent: '', lines: null, isProcessedMessage: false };
  };

  const { textContent, lines, isProcessedMessage } = getTextData();
  const hasLines = lines && lines.length > 0;

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
      }
    }

    if (styleKey && GlobalFontStyleSheet[styleKey]) {
      return GlobalFontStyleSheet[styleKey];
    }
    
    return isTablet ? GlobalFontStyleSheet.textMd : GlobalFontStyleSheet.textLg;
  };

  const getSentenceFromContent = (content: string, word: string): string => {
    const cleanContent = content.trim();
    const endOfSentenceRegex = /[.!?。！？។៕။…\u3002\uFF01\uFF1F\u0964\u0965]/;
    
    const sentences = cleanContent.split(new RegExp(`(?<=${endOfSentenceRegex.source})`))
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const targetSentence = sentences.find(sentence => {
      const wordPattern = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordRegex = new RegExp(`(?:^|\\s|[,;:"'¿¡])(${wordPattern})(?:$|\\s|[,;:"'?!.])`,'i');
      return wordRegex.test(sentence);
    });

    if (targetSentence) {
      return cleanSentence(targetSentence);
    }

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

  const handleWordPress = (word: string, wordIndex: number, fullText: string) => {
    try {
      EventBus.emit('pause-audio');

      if (isPhraseSelectionMode) {
        // Handle phrase selection logic (similar to original InteractiveText)
        const words = fullText.split(/\s+/);
        const start = Math.min(firstSelectedWordIndex!, wordIndex);
        const end = Math.max(firstSelectedWordIndex!, wordIndex);
        const phrase = words.slice(start, end + 1).join(' ');
        
        if (start === end) {
          const cleanWord = word.replace(/^[.,!?¿¡;:()《》「」『』（）、。！？]+|[.,!?¿¡;:()《》「」『』（）、。！？]+$/g, '');
          const plainText = fullText.replace(/<[^>]+>/g, '');
          const sentence = getSentenceFromContent(plainText, cleanWord);
          
          setSelectedWord(cleanWord);
          setSelectedSentence(sentence);
          setIsVocabModalVisible(true);
        } else {
          setSelectedPhraseRange({ start, end });
          setSelectedWord(phrase);
          setSelectedSentence(fullText);
          setIsVocabModalVisible(true);
        }
        
        setIsPhraseSelectionMode(false);
        setFirstSelectedWordIndex(null);
      } else {
        // Normal word selection
        const cleanWord = word.replace(/^[.,!?¿¡;:()《》「」『』（）、。！？]+|[.,!?¿¡;:()《》「」『』（）、。！？]+$/g, '');
        const plainText = fullText.replace(/<[^>]+>/g, '');
        const sentence = getSentenceFromContent(plainText, cleanWord);
        
        setSelectedWord(cleanWord);
        setSelectedSentence(sentence);
        setIsVocabModalVisible(true);
      }
    } catch (error) {
      console.error('Error in handleWordPress:', error);
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
  let effectiveFontFamily = baseStyle.fontFamily;

  if (fontWeight === 'bold') {
    effectiveFontFamily = 'Lato-Bold';
  } else if (fontWeight === 'medium') {
    effectiveFontFamily = 'Lato-Medium';
  } else if (fontWeight === 'normal') {
    effectiveFontFamily = 'Lato-Regular';
  }

  const combinedTextStyle = [
    { ...baseStyle, fontFamily: effectiveFontFamily },
    { lineHeight: effectiveLineHeight, marginRight: 4 }
  ];

  // Render ruby text segments (for Line[] type)
  const renderNonPressableRubySegment = (type: string, segment: Segment, isBold: boolean = false) => {
    const rubyText = pronunciationCharacters === 'disabled' ? null : 
                    pronunciationCharacters === 'romaji' ? segment.romaji : 
                    pronunciationCharacters === 'hiragana' ? segment.hiragana : null;

    // Create base styles
    const baseStyles: any = {
      ...combinedTextStyle[0],
      ...combinedTextStyle[1],
      textDecorationColor: colorScheme === 'light' ? '#00448f' : 'white',
      fontFamily: isBold ? 'Lato-Bold' : 'Lato-Regular',
    };

    // Apply formatting styles
    if (segment.formatting?.isBold) {
      baseStyles.fontWeight = 'bold';
    }
    if (segment.formatting?.isDeleted) {
      baseStyles.textDecorationLine = 'line-through';
      baseStyles.color = '#ff6b6b';
      baseStyles.opacity = 0.7;
      baseStyles.textDecorationStyle = 'solid';
    }
    if (segment.formatting?.isItalic) {
      baseStyles.fontStyle = 'italic';
    }
    if (segment.formatting?.isUnderlined) {
      baseStyles.textDecorationLine = 'underline';
      baseStyles.textDecorationColor = colorScheme === 'light' ? '#00448f' : 'white';
    }

    if (type === "ruby") {
      if (rubyText) {
        return (
          <View className="flex-column items-center">
            <Text 
              style={[combinedTextStyle, { fontSize: Math.max(10, baseStyle.fontSize * 1), fontFamily: isBold ? 'Lato-Bold' : 'Lato-Regular' }]} 
              className={cx('tracking-widest', {
                'font-bold': isBold,
                'text-blue-300': colorScheme === 'light',
                'text-blue-500': colorScheme === 'dark'
              })}
            >
              {rubyText}
            </Text>
            <Text 
              style={baseStyles} 
              className={cx('tracking-widest text-center', {
                'text-white': colorScheme === 'dark',
                'text-gray-900': colorScheme === 'light',
                'font-bold': isBold,
              })}
            >
              {segment.baseText}
            </Text>
          </View>
        );
      }
      return (
          <Text 
            style={baseStyles} 
            className={cx('tracking-widest text-center', {
              'text-white': colorScheme === 'dark',
              'text-gray-900': colorScheme === 'light',
              'font-bold': isBold,
            })}
          >
            {segment.baseText}
          </Text>
      );
      
    }
    return (
      <Text 
        style={baseStyles} 
        className={`${colorScheme === 'dark' ? 'text-white' : 'text-gray-900'} ${tailwindClassName || ''}`}
      >
        {segment.baseText}
      </Text>
    );
  };

  // Render ruby text segments (for Line[] type)
  const renderRubySegment = (type: string, segment: Segment, segmentIndex: number, pressableSegmentIndex: number, isInSelectedPhrase: boolean, isFirstSelected: boolean, isBold: boolean = false) => {
    const rubyText = pronunciationCharacters === 'disabled' ? null : 
                    pronunciationCharacters === 'romaji' ? segment.romaji : 
                    pronunciationCharacters === 'hiragana' ? segment.hiragana : null;

    // Create base styles
    const baseStyles: any = {
      ...combinedTextStyle[0],
      ...combinedTextStyle[1],
      backgroundColor: isInSelectedPhrase ? (colorScheme === 'light' ? 'rgba(0, 68, 143, 0.1)' : 'rgba(96, 165, 250, 0.4)') : 'transparent',
      textDecorationLine: isFirstSelected ? 'underline' : 'none',
      textDecorationColor: colorScheme === 'light' ? '#00448f' : 'white',
      fontFamily: isBold ? 'Lato-Bold' : 'Lato-Regular',
    };

    // Apply formatting styles
    if (segment.formatting?.isBold) {
      baseStyles.fontWeight = 'bold';
    }
    if (segment.formatting?.isDeleted) {
      baseStyles.textDecorationLine = 'line-through';
      baseStyles.color = '#ff6b6b';
      baseStyles.textDecorationColor = '#ff6b6b';
      baseStyles.opacity = 0.7;
      baseStyles.textDecorationStyle = 'solid';
    }
    if (segment.formatting?.isItalic) {
      baseStyles.fontStyle = 'italic';
    }
    if (segment.formatting?.isUnderlined) {
      baseStyles.textDecorationLine = 'underline';
      baseStyles.textDecorationColor = colorScheme === 'light' ? '#00448f' : 'white';
    }

    if (type === "ruby") {
      if (rubyText) {
        return (
          <View key={`${pressableSegmentIndex}-${segmentIndex}`} className="flex-column items-center">
            <Text 
              style={[combinedTextStyle, { fontSize: Math.max(10, baseStyle.fontSize * 1), fontFamily: isBold ? 'Lato-Bold' : 'Lato-Regular' }]} 
              className={cx('tracking-widest', {
                'font-bold': isBold,
                'text-blue-300': colorScheme === 'light',
                'text-blue-500': colorScheme === 'dark'
              })}
            >
              {rubyText}
            </Text>
            <Text 
              style={baseStyles} 
              className={cx('text-center', {
                'text-white': colorScheme === 'dark',
                'text-gray-900': colorScheme === 'light',
                'font-bold': isBold,
              })}
            >
              {segment.baseText}
            </Text>
          </View>
        );
      }
      return (
          <Text 
            key={`${pressableSegmentIndex}-${segmentIndex}`} 
            style={baseStyles} 
            className={cx('text-center', {
              'text-white': colorScheme === 'dark',
              'text-gray-900': colorScheme === 'light',
              'font-bold': isBold,
            })}
          >
            {segment.baseText}
          </Text>
      );
      
    }
    return (
      <Text 
        key={`${pressableSegmentIndex}-${segmentIndex}`} 
        style={baseStyles} 
        className={`${colorScheme === 'dark' ? 'text-white' : 'text-gray-900'} ${tailwindClassName || ''}`}
      >
        {segment.baseText}
      </Text>
    );
  };

  // Render pressable segment for Line[] type
  const renderNonPressableSegment = (pressableSegment: PressableSegment, pressableSegmentIndex: number, lineText: string, globalWordIndex: number) => {
    return (
      <View className="flex-row flex-wrap justify-center items-end">
        {pressableSegment.segments.map((segment: Segment) => 
          renderNonPressableRubySegment(pressableSegment.type, segment, pressableSegment.isBold || false)
        )}
      </View>
    );
  };
  // Render pressable segment for Line[] type
  const renderPressableSegment = (pressableSegment: PressableSegment, pressableSegmentIndex: number, lineText: string, globalWordIndex: number) => {
    const isInSelectedPhrase = Boolean(selectedPhraseRange && 
      globalWordIndex >= selectedPhraseRange.start && 
      globalWordIndex <= selectedPhraseRange.end);
    const isFirstSelected = isPhraseSelectionMode && firstSelectedWordIndex === globalWordIndex;

    return (
      <Pressable
        key={pressableSegmentIndex}
        onPress={() => handleWordPress(pressableSegment.text, globalWordIndex, textContent)}
        onLongPress={() => handleWordLongPress(pressableSegment.text, globalWordIndex)}
        className="flex-row items-end mb-2"
      >
        <View className="flex-row flex-wrap justify-center items-end">
          {pressableSegment.segments.map((segment: Segment, segmentIndex: number) => 
            renderRubySegment(pressableSegment.type, segment, segmentIndex, pressableSegmentIndex, isInSelectedPhrase, isFirstSelected, pressableSegment.isBold || false)
          )}
        </View>
      </Pressable>
    );
  };

  // Function to split text into words while preserving contractions
  const splitTextIntoWords = (text: string): string[] => {
    // Split on spaces but preserve contractions
    const words = text.split(/\s+/);
    const result: string[] = [];
    
    for (const word of words) {
      if (!word) continue;
      
      // Check if this word contains a contraction (apostrophe)
      if (word.includes("'")) {
        // Keep the entire contraction as one word
        result.push(word);
      } else {
        result.push(word);
      }
    }
    
    return result;
  };

  // Render string text (original InteractiveText behavior)
  const renderStringText = (textString: string) => {
    const isRTLText = (text: string): boolean => {
      return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0590-\u05FF]/.test(text);
    };

    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {(isRTLText(textString) ? splitTextIntoWords(textString).reverse() : splitTextIntoWords(textString)).map((word, index) => {
          const isInSelectedPhrase = selectedPhraseRange && 
            index >= selectedPhraseRange.start && 
            index <= selectedPhraseRange.end;
          const isFirstSelected = isPhraseSelectionMode && firstSelectedWordIndex === index;
          
          return (
            <Pressable
              key={index}
              onPress={() => handleWordPress(word, index, textString)}
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
    );
  };

  // Render Line[] array
  const renderLinesArray = (lines: Line[]) => {
    let globalWordIndex = 0;

    return (
      <View>
        {lines.map((line, lineIndex) => (
          <View key={lineIndex} className="flex-row flex-wrap mb-2">
            {line.pressableSegments.map((pressableSegment, pressableSegmentIndex) => {
              const currentWordIndex = globalWordIndex;
              globalWordIndex++;
              return renderPressableSegment(pressableSegment, pressableSegmentIndex, line.text, currentWordIndex);
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View>
      {hasLines ? renderLinesArray(lines!) : renderStringText(textContent)}

      <VocabWordModal
        visible={isVocabModalVisible}
        onClose={() => {
          setIsVocabModalVisible(false);
          setSelectedWord(null);
          setSelectedSentence(null);
          setSelectedPhraseRange(null);
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

export default RubyInteractiveText; 