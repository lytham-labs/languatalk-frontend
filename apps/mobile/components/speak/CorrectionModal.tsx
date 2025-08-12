import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, useColorScheme, Pressable } from 'react-native';
import { GlobalFontStyleSheet } from '@/constants/Font';
import SlidingModal from '../shared/SlidingModal';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faLightbulb, faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import cx from 'classnames';
import VocabWordModal from './VocabWordModal';
import useDevice from '@/hooks/useDevice';
import { InteractiveText } from '@/components/shared/InteractiveText';
import { RubyInteractiveText } from '@/components/shared/RubyInteractiveText';
import { ProcessedMessage } from '@/types/chat';

interface CorrectionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onOpen?: () => void;
  correction: string;
  processedCorrection?: string | Partial<ProcessedMessage>;
  correctionExplanation?: string;
  onRequestExplanation?: () => void;
  isLoading?: boolean;
  language: string;
  onWordTranslated?: (word: string, translation: string) => void;
  onWordSaved?: (word: string, translation: string) => void;
  targetLanguage: string;
  chatContextFlag?: boolean;
  japaneseReadingAidFlag?: boolean;
}

export default function CorrectionModal({
  isVisible,
  onClose,
  onOpen,
  correction,
  processedCorrection,
  correctionExplanation,
  onRequestExplanation,
  isLoading = false,
  language,
  targetLanguage,
  onWordTranslated,
  onWordSaved,
  chatContextFlag = false,
  japaneseReadingAidFlag = false
}: CorrectionModalProps) {
  const colorScheme = useColorScheme();
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedSentence, setSelectedSentence] = useState<string | null>(null);
  const [isVocabModalVisible, setIsVocabModalVisible] = useState(false);
  const { isTablet } = useDevice();
  const [isPhraseSelectionMode, setIsPhraseSelectionMode] = useState(false);
  const [firstSelectedWordIndex, setFirstSelectedWordIndex] = useState<number | null>(null);
  const [selectedPhraseRange, setSelectedPhraseRange] = useState<{start: number, end: number} | null>(null);

  // Reset phrase selection when modal closes
  useEffect(() => {
    if (!isVisible) {
      setIsPhraseSelectionMode(false);
      setFirstSelectedWordIndex(null);
      setSelectedPhraseRange(null);
    }
  }, [isVisible]);

  const getSentenceFromContent = (content: string, word: string): string => {
    const cleanContent = content.replace(/<[^>]+>/g, '').trim();
    
    const endOfSentenceRegex = /[.!?。！？។៕။…\u3002\uFF01\uFF1F\u0964\u0965]/;
    
    const sentences = cleanContent.split(new RegExp(`(?<=${endOfSentenceRegex.source})`));
    
    const targetSentence = sentences.find(sentence => {
      const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
      return wordRegex.test(sentence);
    });

    if (targetSentence) {
      return cleanSentence(targetSentence);
    }

    const words = cleanContent.split(/\s+/);
    const wordIndex = words.findIndex(w => w.toLowerCase() === word.toLowerCase());
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

  useEffect(() => {
    if (isVisible && onOpen) {
      onOpen();
    }
  }, [isVisible, onOpen]);

  const parseCorrection = (htmlText: string) => {
    const parts: { text: string; type: 'del' | 'ins' | 'b' | 'normal' }[] = [];
    const regex = /<(del|ins|b)>(.*?)<\/\1>|([^<]+)/g;
    let match;

    while ((match = regex.exec(htmlText)) !== null) {
      if (match[1] && match[2]) {
        parts.push({
          text: match[2],
          type: match[1] as 'del' | 'ins' | 'b'
        });
      } else if (match[3]) {
        const cleanText = match[3];
        if (cleanText.trim()) {
          parts.push({
            text: cleanText,
            type: 'normal'
          });
        }
      }
    }

    return parts;
  };

  const handleLongPress = (word: string, partType: 'del' | 'ins' | 'b' | 'normal') => {
    if (partType !== 'del') {
      setIsPhraseSelectionMode(true);
      
      const selectableWords: { word: string, index: number }[] = [];
      let currentIndex = 0;
      
      parseCorrection(correction).forEach(part => {
        if (part.type === 'b' || part.type === 'normal') {
          const words = part.text.split(/\s+/).filter(w => w.trim());
          words.forEach(w => {
            // Clean the word of punctuation for matching
            const cleanWord = w.replace(/[.,!?;:()]$/g, '');
            selectableWords.push({ word: cleanWord, index: currentIndex++ });
          });
        }
      });
      
      // Clean the input word for matching
      const cleanInputWord = word.replace(/[.,!?;:()]$/g, '');
      const wordIndex = selectableWords.findIndex(w => w.word === cleanInputWord);
      setFirstSelectedWordIndex(wordIndex);
    }
  };

  const handleWordPress = (word: string, wordIndex: number, partType: 'del' | 'ins' | 'b' | 'normal') => {    
    if (isPhraseSelectionMode && firstSelectedWordIndex !== null && partType !== 'del') {
      const selectableWords: { word: string, index: number }[] = [];
      let currentIndex = 0;
      
      parseCorrection(correction).forEach(part => {
        if (part.type !== 'del') {
          const words = part.text.split(/\s+/).filter(w => w.trim());
          words.forEach(w => {
            const cleanWord = w.replace(/[.,!?;:()]$/g, '');
            selectableWords.push({ word: cleanWord, index: currentIndex++ });
          });
        }
      });
      
      const cleanInputWord = word.replace(/[.,!?;:()]$/g, '');
      const currentWordIndex = selectableWords.findIndex(w => w.word === cleanInputWord);
      
      if (currentWordIndex !== -1) {
        const start = Math.min(firstSelectedWordIndex, currentWordIndex);
        const end = Math.max(firstSelectedWordIndex, currentWordIndex);
        const selectedWords = selectableWords.slice(start, end + 1).map(w => w.word);
        const selectedPhrase = selectedWords.join(' ');
        
        setSelectedPhraseRange({ start, end });
        setSelectedWord(selectedPhrase);
        setSelectedSentence(correction);
        setIsVocabModalVisible(true);
        setIsPhraseSelectionMode(false);
        setFirstSelectedWordIndex(null);
      }
    } else if (partType !== 'del') {
      const sentence = getSentenceFromContent(correction, word);
      setSelectedWord(word);
      setSelectedSentence(sentence);
      setIsVocabModalVisible(true);
    }
  };

  return (
    <SlidingModal visible={isVisible} onClose={onClose}>
      <View className={cx(
        "p-2 rounded-t-3xl pt-5",
        colorScheme === 'dark' ? 'bg-gray-800' : 'bg-white'
      )}>
        
        {isLoading ? (
          <View className="items-center justify-center py-8">
            <ActivityIndicator size="large" color="#00448f" />
            <Text 
              style={GlobalFontStyleSheet.textMd} 
              className={cx(
                "mt-4",
                colorScheme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              )}
            >
              Analysing language usage...
            </Text>
          </View>
        ) : (
          <>
            <View className={cx(
              "mb-6 p-4 rounded-xl",
              colorScheme === 'dark' ? 'bg-gray-700/50' : 'bg-blue-50/40'
            )}>
              {/* Use processed correction if available and flags are enabled, otherwise fall back to original parsing */}
              {processedCorrection && chatContextFlag ? (
                <RubyInteractiveText
                  text={processedCorrection}
                  languageCode={language}
                  targetLanguage={targetLanguage}
                  colorScheme={colorScheme || 'light'}
                  onWordTranslated={onWordTranslated}
                  onWordSaved={onWordSaved}
                />
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {(() => {
                    let globalWordIndex = 0;
                    return parseCorrection(correction).map((part, index) => {
                      const words = part.text.split(/\s+/);
                      
                      return words.map((word, localWordIndex) => {
                        if (!word.trim()) return null;
                        
                        const cleanWord = word.replace(/[.,!?;:()]$/g, '');
                        
                        // Only increment global index for non-deleted words
                        const currentWordIndex = part.type === 'del' ? -1 : globalWordIndex++;
                        
                        const isInSelectedPhrase = selectedPhraseRange && 
                          currentWordIndex >= selectedPhraseRange.start && 
                          currentWordIndex <= selectedPhraseRange.end;
                        
                        const isFirstSelected = isPhraseSelectionMode && firstSelectedWordIndex === currentWordIndex;
                        
                        return (
                          <Pressable
                            key={`${index}-${localWordIndex}`}
                            onPress={() => handleWordPress(cleanWord, currentWordIndex, part.type)}
                            onLongPress={() => handleLongPress(cleanWord, part.type)}
                            style={{ marginRight: 4, marginBottom: 4 }}
                          >
                            <Text
                              style={[
                                isTablet ? GlobalFontStyleSheet.textMd : GlobalFontStyleSheet.textLg,
                                {
                                  lineHeight: isTablet ? 38 : 28,
                                },
                                part.type === 'del' && {
                                  textDecorationLine: 'line-through', 
                                  color: colorScheme === 'dark' ? '#ff8787' : '#ff6b6b',
                                  backgroundColor: colorScheme === 'dark' ? 'rgba(255, 135, 135, 0.1)' : 'rgba(255, 107, 107, 0.1)',
                                  paddingHorizontal: 4,
                                  borderRadius: 4,
                                },
                                part.type === 'ins' && {
                                  textDecorationLine: 'none',
                                  color: colorScheme === 'dark' ? '#69db7c' : '#51cf66',
                                  backgroundColor: colorScheme === 'dark' ? 'rgba(105, 219, 124, 0.1)' : 'rgba(81, 207, 102, 0.1)',
                                  paddingHorizontal: 4,
                                  borderRadius: 4,
                                  fontWeight: '600',
                                },
                                part.type === 'b' && {
                                  fontFamily: 'Lato-Bold',
                                  color: colorScheme === 'dark' ? '#fff' : '#003670'
                                },
                                part.type === 'normal' && {
                                  color: colorScheme === 'dark' ? '#e5e5e5' : '#003670'
                                },
                                isFirstSelected && (part.type !== 'del') && {
                                  textDecorationLine: 'underline',
                                  textDecorationColor: colorScheme === 'light' ? '#00448f' : 'white',
                                  textDecorationStyle: 'solid'
                                },
                                isInSelectedPhrase && (part.type !== 'del') && {
                                  backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                                }
                              ]}
                            >
                              {cleanWord}
                            </Text>
                          </Pressable>
                        );
                      }).filter(Boolean);
                    });
                  })()}
                </View>
              )}
            </View>
          </>
        )}
      </View>
      {correctionExplanation ? (
        <View className={cx(
          "py-4 rounded-xl",
        )}>
          <View className="flex-row items-center mb-4">
            <FontAwesomeIcon 
              icon={faCircleInfo} 
              size={18} 
              color={colorScheme === 'dark' ? '#93c5fd' : '#60a5fa'}
            />
            <Text 
              style={GlobalFontStyleSheet.textMd} 
              className={cx(
                "font-semibold ml-2",
                colorScheme === 'dark' ? 'text-gray-300' : 'text-gray-900'
              )}
            >
              Explanation
            </Text>
          </View>
          <Text 
            style={[
              GlobalFontStyleSheet.textBase,
            ]}
            className={colorScheme === 'dark' ? 'text-gray-100' : 'text-[#4B5563]'}
          >
            {parseCorrection(correctionExplanation).map((part, index) => {
              // Split by newlines to preserve paragraphs
              const paragraphs = part.text.split(/\n/);
              
              return (
                <React.Fragment key={`exp-${index}`}>
                  {paragraphs.map((paragraph, paragraphIndex) => (
                    <React.Fragment key={`exp-para-${index}-${paragraphIndex}`}>
                      {paragraphIndex > 0 && <Text>{'\n'}</Text>}
                      <Text
                        style={[
                          isTablet ? GlobalFontStyleSheet.textMd : GlobalFontStyleSheet.textBase,
                          {
                            lineHeight: isTablet ? 38 : 28,
                          },
                          part.type === 'b' && {
                            fontFamily: 'Lato-Bold',
                            color: colorScheme === 'dark' ? '#fff' : '#003670'
                          },
                          part.type === 'normal' && {
                            color: colorScheme === 'dark' ? '#e5e5e5' : '#003670'
                          }
                        ]}
                      >
                        {paragraph}
                      </Text>
                    </React.Fragment>
                  ))}
                </React.Fragment>
              );
            })}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={onRequestExplanation}
          className={cx(
            "flex-row items-center justify-center p-4 rounded-xl",
            colorScheme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50'
          )}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
          }}
        >
          <FontAwesomeIcon 
            icon={faLightbulb} 
            size={20} 
            color={colorScheme === 'dark' ? '#60a5fa' : '#2563eb'} 
          />
          <Text
            style={GlobalFontStyleSheet.textMd}
            className={cx(
              "ml-2 font-medium",
              colorScheme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            )}
          >
            Explain this feedback
          </Text>
        </TouchableOpacity>
      )}
      <VocabWordModal
        visible={isVocabModalVisible}
        onClose={() => {
          setIsVocabModalVisible(false);
          setSelectedPhraseRange(null);
          setSelectedWord(null);
          setSelectedSentence(null);
        }}
        word={selectedWord || ''}
        language={language}
        targetLanguage={targetLanguage}
        contextSentence={selectedSentence || ''}
        onWordTranslated={onWordTranslated}
        onWordSaved={onWordSaved}
        isPhrase={selectedPhraseRange !== null}
      />
    </SlidingModal>
  );
}
