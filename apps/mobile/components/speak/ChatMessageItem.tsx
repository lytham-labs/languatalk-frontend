import { View, Text, Pressable, TouchableOpacity, Image, useWindowDimensions, StyleSheet, Platform } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faPencil } from '@fortawesome/free-solid-svg-icons';
import { memo, useRef, useState, useEffect } from 'react';
import cx from 'classnames';
import { GlobalFontStyleSheet } from '@/constants/Font';
import CallModeAIActions from '@/components/speak/CallModeAIActions';
import UserMessageActions from '@/components/speak/UserMessageActions';
import { Animated } from 'react-native';
import useDevice from '@/hooks/useDevice';
import * as Haptics from 'expo-haptics';
import { TranscriptionMessage } from "./TranscriptionTile";

const { isTablet } = useDevice();

const triggerHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

const cleanSentence = (sentence: string): string => {
    // Skip cleanup for RTL languages (Arabic, Hebrew, etc)
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0590-\u05FF]/.test(sentence)) {
    return sentence.trim();
  }
  
  const cleanups: [RegExp, string][] = [
    // Replace multiple spaces with a single space
    [/\s+/g, ' '],

    // Handle punctuation spacing
    [/\s*([,.:;?!»)}\]°"'%‰‱])/g, '$1'],
    [/([«({\[])\s*/g, '$1'],
    [/(\S)\s*([:.;,])/g, '$1$2'],

    // Handle apostrophes
    [/(\S)\s*([''])\s*(\S)/g, '$1$2$3'],

    // Handle quotation marks
    [/"(\S)/g, '" $1'],
    [/(\S)"/g, '$1 "'],
    [/([.!?])\s*"/g, '$1"'],

    // Remove leading punctuation and spaces
    [/^\s*([^\w\s]+\s*)*/, '']

  ];

  return cleanups.reduce((text, [pattern, replacement]) =>
    text.replace(pattern, replacement), sentence).trim();
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

export type ChatMessageItemProps = {
  item: {
    role: 'user' | 'assistant';
    content: string;
    chat_message_id: string;
    correction?: string;
    correction_explanation?: string;
    translation?: string;
    alternative_response?: string;
    audio_url?: string;
    slow_audio_url?: string;
    word_timings?: any;
    audio_only?: boolean;
  };
  colorScheme?: 'light' | 'dark';
  chatMode?: string;
  highlightMode?: 'word' | 'sentence' | 'off';
  audioPlayerService?: any;
  selectedWord?: string;
  selectedSentence?: string;
  chatData?: any;
  autoCorrectEnabled?: boolean;
  
  // Missing props from original:
  playingAudioId: string | null;
  playingSlowAudioId: string | null;
  isRecording: boolean;
  cancelRecording: () => void;
  getTranscriptionMessages: () => TranscriptionMessage[];
  
  // Callbacks
  onWordPress?: (word: string, chatMessageId: string, sentence: string) => void;
  onPlayAudio?: (audioUrl: string, wordTimings: any, chatMessageId: string, text: string) => void;
  onPlaySlowAudio?: (item: any, chatMessageId: string, slowAudioUrl: string | null, text: string) => void;
  onTranslate?: (content: string, messageId: string) => void;
  onTextCorrection?: (item: any, previousMessage?: any) => void;
  onCorrectionExplanation?: (item: any) => void;
  handleAlternativeResponse?: (item: any) => void;
  onTranslationModalOpen?: (translation: string) => void;
  
  // State setters
  setCurrentPlayingMessageId?: (id: string | null) => void;
  setPlayingSlowAudioId?: (id: string | null) => void;
  setChatData?: React.Dispatch<React.SetStateAction<any | null>>;
};

const styles = StyleSheet.create({
  messageList: {
    paddingVertical: 16,
  },
  messageWrapper: {
    marginBottom: 24,
    marginHorizontal: isTablet ? 54 : 5,
  },
  userMessageWrapper: {
    alignItems: 'flex-end',
  },
  aiMessageWrapper: {
    alignItems: 'flex-start',
  },
  messageContentWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    position: 'relative',
  },
  messageContainer: {
    borderRadius: 20,
    maxWidth: Platform.select({
      android: '85%',
      default: '95%'
    }),
    marginTop: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    marginHorizontal: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiMessageContainer: {
    maxWidth: Platform.select({
      android: '85%',
      default: '100%'
    }),
    paddingVertical: 2,
    marginHorizontal: 4,
    backgroundColor: 'transparent',
  },
  aiMessageContent: {
    paddingLeft: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  userMessageContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 24,
    alignSelf: 'flex-start',
    flexShrink: 1,
    paddingBottom: 4,
  },
  textContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 1,
  },
  wordContainer: {
    marginRight: 2,
    marginVertical: 2,
    alignItems: 'center',
  },
  deletedText: {
    textDecorationLine: 'line-through',
    color: '#ff6b6b',
    opacity: 0.7,
    textDecorationStyle: Platform.OS === 'ios' ? 'solid' : undefined,
  },
  insertedText: {
    textDecorationLine: 'underline',
    color: '#51cf66',
    textDecorationStyle: Platform.OS === 'ios' ? 'solid' : undefined,
    fontWeight: '500',
  },
  boldText: {
    fontWeight: '700',
  },
  correctionWord: {
    textAlignVertical: Platform.OS === 'android' ? 'center' : undefined,
    padding: 2,
  },
  lineContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  userMessageActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    marginRight: 8,
    gap: 8,
    marginBottom: 0,
  },
  translationWrapper: {
    width: '100%',
    alignSelf: 'flex-start',
    flexDirection: 'column',
  },
  translationContainer: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    width: '100%',
  },
  translationText: {
    alignSelf: 'flex-start',
    flexShrink: 1,
  },
  correctionOuterContainer: {
    marginTop: 8,
    marginBottom: 4,
    marginLeft: 40,
  },
  correctionOuterContainerLight: {
    backgroundColor: 'transparent',
  },
  correctionOuterContainerDark: {
    backgroundColor: 'transparent',
  },
  correctionInnerContainer: {
    borderLeftWidth: 2,
    borderLeftColor: '#059669',
    paddingLeft: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 80 : 60,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 5,
    paddingVertical: 8,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  optionButton: {
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    borderColor: '#00448f',
    borderWidth: 2,
  },
  selectSuggestionButton: {
    padding: 8,
    marginLeft: 'auto',
    backgroundColor: '#00488f',
    borderRadius: 4,
  }
});

export const ChatMessageItem = memo(({ 
  item,
  colorScheme = 'light',
  chatMode = 'text',
  highlightMode = 'off',
  audioPlayerService,
  selectedWord,
  selectedSentence,
  chatData,
  autoCorrectEnabled = false,
  playingAudioId,
  playingSlowAudioId,
  isRecording,
  cancelRecording,
  getTranscriptionMessages,
  onWordPress,
  onPlayAudio,
  onPlaySlowAudio,
  onTranslate,
  onTextCorrection,
  onCorrectionExplanation,
  handleAlternativeResponse,
  onTranslationModalOpen,
  setCurrentPlayingMessageId,
  setPlayingSlowAudioId,
  setChatData,
}: ChatMessageItemProps) => {

  const { width } = useWindowDimensions();
  const [isTextRevealed, setIsTextRevealed] = useState(
    !(item.role === 'assistant' && chatMode === 'audio_only')
  );

  const toggleTextVisibility = () => {
    triggerHaptic();
    setIsTextRevealed(prev => !prev);
  };

  const handleWordPressInternal = (word: string) => {
    // Only allow word interaction if text is revealed
    if (isTextRevealed) {
      triggerHaptic();
      const sentence = getSentenceFromContent(item.content, word);
      onWordPress?.(word, item.chat_message_id, sentence);
    }
  };

  const messageRef = useRef<View>(null);

  const parseCorrection = (htmlText: string) => {
    const parts: { text: string; type: 'deleted' | 'inserted' | 'bold' | 'normal' }[] = [];

    // Regular expression to match <del>, <ins>, <b> tags and their content
    const regex = /<(del|ins|b)>(.*?)<\/\1>|([^<]+)/g;
    let match;

    while ((match = regex.exec(htmlText)) !== null) {
      if (match[1] && match[2]) { // Matched a tag
        parts.push({
          text: match[2],
          type: match[1] as 'deleted' | 'inserted' | 'bold' | 'normal'
        });
      } else if (match[3]) { // Matched text outside tags
        // Clean up any whitespace but preserve single spaces between words
        const cleanText = match[3].replace(/\s+/g, ' ');
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

  const isRTLText = (text: string): boolean => {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0590-\u05FF]/.test(text);
  };

  const renderInteractiveText = (text: string, type: 'content' | 'alternative' | 'correction' | 'translation' | 'explanation', chatMode: string, highlightMode: 'word' | 'sentence' | 'off') => {
    if (!text) return null;

    // Keep the correction text logic
    if (type === 'correction' && (text.includes('<del>') || text.includes('<ins>') || text.includes('<b>'))) {
      const parts = parseCorrection(text);

      return (
        <View style={styles.textContainer}>
          {parts.map((part, partIndex) =>
            (isRTLText(part.text) ? part.text.split(' ').reverse() : part.text.split(' ')).map((word, wordIndex) => {
              if (!word.trim()) return null;

              const textStyle = (() => {
                switch(part.type) {
                  case 'del': return styles.deletedText;
                  case 'ins': return styles.insertedText;
                  case 'b': return styles.boldText;
                  default: return null;
                }
              })();

              return (
                <Pressable
                  key={`${type}-${partIndex}-${wordIndex}`}
                  onPress={() => handleWordPressInternal(word)}
                  style={styles.wordContainer}
                >
                  <Text
                    style={[
                      GlobalFontStyleSheet.textLg,
                      styles.correctionWord,
                      textStyle,
                      {
                        color: colorScheme === 'dark' ? '#fff' : '#000',
                      }
                    ]}
                  >
                    {word}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      );
    }

    // Regular text rendering
    const lines = text.split('\n');
    let globalWordIndex = 0;

    return (
      <View style={styles.textContainer}>
        {lines.map((line, lineIndex) => (
          <View key={`line-${lineIndex}`} style={styles.lineContainer} className="pb-2">
            {(isRTLText(line) ? line.split(' ').reverse() : line.split(' ')).map((word, _) => {
              if (!word.trim()) return null;
              const currentWordIndex = globalWordIndex++;
              
              // Determine if this word should be hidden
              const isHidden = item.role === 'assistant' && 
                             chatMode === 'audio_only' && 
                             !isTextRevealed && 
                             type === 'content';
              
              return (
                <Pressable
                  key={`${type}-${lineIndex}-${currentWordIndex}`}
                  onPress={() => handleWordPressInternal(word)}
                  disabled={isHidden}
                  style={styles.wordContainer}
                >
                  <Animated.View style={{
                    backgroundColor: audioPlayerService && type === 'content'
                      ? audioPlayerService.getWordAnimation(currentWordIndex, item.chat_message_id, highlightMode, text).interpolate({
                        inputRange: [0, 1],
                        outputRange: ['transparent',
                          highlightMode === 'sentence'
                            ? colorScheme === 'light' ? 'rgba(0, 68, 143, 0.1)' : 'rgba(96, 165, 250, 0.4)'
                            : highlightMode === 'word'
                              ? colorScheme === 'light' ? 'rgba(0, 68, 143, 0.1)' : 'rgba(96, 165, 250, 0.4)'
                              : 'transparent'
                        ],
                      })
                      : 'transparent',
                  }}>
                    <Text
                      className={cx({
                        'text-black dark:text-white': true,
                        'bg-[#FC5D5D]/20': selectedWord === word,
                        'invisible': isHidden,
                        'opacity-90': type !== 'content',
                      })}
                      style={[
                        isTablet ? GlobalFontStyleSheet.textMd : GlobalFontStyleSheet.textLg
                      ]}
                    >
                      {word}{' '}
                    </Text>
                  </Animated.View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  // Only show correction in bubble if auto-correct is enabled
  const shouldShowCorrection = autoCorrectEnabled && item.correction;

  return (
    <View ref={messageRef} style={[styles.messageWrapper, item.role === 'user' ? styles.userMessageWrapper : styles.aiMessageWrapper]}>
      {item.role === 'assistant' && (
        <View className="flex-row items-center mt-2 pl-2 mb-2">
            <Image
              source={{ uri: chatData?.chat.avatar_url }}
              className={`${isTablet ? 'w-16 h-16' : 'w-10 h-10'} rounded-full`}  // Increased size for tablet
            />
            {/* <Text 
              className={`ml-2 ${isTablet ? 'text-xl' : 'text-lg'} font-semibold ${
                colorScheme === 'dark' ? 'text-gray-400' : 'black'
              }`}
            >
              {chatData?.chat.voice || 'AI Partner'}
            </Text> */}
        </View>
      )}
      <View style={styles.messageContentWrapper}>
        
        
        <View
          className={cx({
            'bg-gray-50 dark:bg-gray-700': item.role === 'user', // Removed /90 opacity
            'bg-white dark:bg-gray-450': item.role !== 'user',
            'pb-5': item.role === 'user' && ((autoCorrectEnabled && item.correction)), // Only add padding if there's translation or correction
            'pb-0': item.role === 'user' && !item.translation && !(autoCorrectEnabled && item.correction), // No padding if no translation or correction
          })}
          style={item.role === 'user' ? styles.messageContainer : styles.aiMessageContainer}
        >
          <View style={
            item.role === 'user' ? styles.userMessageContent : styles.aiMessageContent
          }>
            {renderInteractiveText(item.content, 'content', chatMode, highlightMode)}
          </View>

          

          {shouldShowCorrection && (
            <View className="pb-6 border-l border-[#6B7280] dark:border-[#9CA3AF] pl-4">
              <View className="flex-row items-center mb-1">
                <FontAwesomeIcon 
                  icon={faPencil}
                  size={12}
                  color={colorScheme === 'dark' ? '#9CA3AF' : '#6B7280'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[
                  GlobalFontStyleSheet.textSm,
                  { 
                    color: colorScheme === 'dark' ? '#9CA3AF' : '#6B7280',
                    fontWeight: '500'
                  }
                ]}>
                  Feedback
                </Text>
              </View>
              
              {/* Correction text with formatting */}
              <View className="ml-4">
                {renderInteractiveText(item.correction, 'correction', chatMode, highlightMode)}

                {item.correction_explanation ? (
                  <View className="mt-2">
                    <Text style={[
                      GlobalFontStyleSheet.textSm,
                      {
                        color: colorScheme === 'dark' ? '#94A3B8' : '#64748B',
                        marginBottom: 1
                      }
                    ]}>
                      Why?
                    </Text>
                    {renderInteractiveText(item.correction_explanation, 'explanation', chatMode, highlightMode)}
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => onCorrectionExplanation(item)}
                    className="mt-2"
                  >
                    <Text style={[
                      GlobalFontStyleSheet.textSm,
                      { color: colorScheme === 'dark' ? '#60A5FA' : '#00448F' }
                    ]}>
                      Explain this feedback →
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          
        </View>
      </View>
    </View>
  );
}); 
