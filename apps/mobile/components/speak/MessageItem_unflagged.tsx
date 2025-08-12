import { View, Text, Pressable, Image, useWindowDimensions, StyleSheet, Platform } from 'react-native';
import { memo, useRef, useState, useEffect } from 'react';
import cx from 'classnames';
import { GlobalFontStyleSheet } from '@/constants/Font';
import AIMessageActions from '@/components/speak/AIMessageActions';
import UserMessageActions from '@/components/speak/UserMessageActions';
import { Animated } from 'react-native';
import useDevice from '@/hooks/useDevice';
import * as Haptics from 'expo-haptics';

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

export type MessageItemProps = {
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
  selectedWord?: string | null;
  selectedSentence?: string | null;
  chatData?: any;
  autoCorrectEnabled?: boolean;
  isNew?: boolean;
  targetLanguage?: string;
  // Missing props from original:
  playingAudioId: string | null;
  playingSlowAudioId: string | null;
  isRecording: boolean;
  cancelRecording: () => void;
  activePhraseSelectionMessageId?: string | null;

  // Callbacks
  onWordPress?: (word: string, chatMessageId: string, sentence: string, isPhrase: boolean) => void;
  onPlayAudio?: (audioUrl: string, wordTimings: any, chatMessageId: string, text: string) => void;
  onPlaySlowAudio?: (item: any, chatMessageId: string, slowAudioUrl: string | null, text: string) => void;
  onTranslate?: (content: string, messageId: string) => void;
  onTextCorrection?: (item: any, previousMessage?: any) => void;
  onCorrectionExplanation?: (item: any) => void;
  handleAlternativeResponse?: (item: any) => void;
  onTranslationModalOpen?: (translation: string, originalText: string) => void;
  onPhraseSelectionStart?: (messageId: string) => void;
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
  },
  tooltip: {
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tooltipText: {
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'lato-regular',
  },
});

export const MessageItemUnflagged = memo(({ 
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
  activePhraseSelectionMessageId,
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
  onPhraseSelectionStart,
  isNew,
  targetLanguage
}: MessageItemProps) => {

  const { width } = useWindowDimensions();
  const [isTextRevealed, setIsTextRevealed] = useState(
    !(item.role === 'assistant' && chatMode === 'audio_only')
  );
  const fadeAnim = useRef(new Animated.Value(0)).current;


  // Add new state for phrase selection
  const [isPhraseSelectionMode, setIsPhraseSelectionMode] = useState(false);
  const [firstSelectedWordIndex, setFirstSelectedWordIndex] = useState<number | null>(null);
  const [selectedPhraseRange, setSelectedPhraseRange] = useState<{start: number, end: number} | null>(null);

  // Reset phrase selection when selectedWord changes (modal closes)
  useEffect(() => {
    if (!selectedWord) {
      setSelectedPhraseRange(null);
      setIsPhraseSelectionMode(false);
      setFirstSelectedWordIndex(null);
    }
  }, [selectedWord]);

  // Add effect to reset phrase selection when a different message item starts phrase selection
  useEffect(() => {
    if (activePhraseSelectionMessageId && activePhraseSelectionMessageId !== item.chat_message_id) {
      setIsPhraseSelectionMode(false);
      setFirstSelectedWordIndex(null);
      setSelectedPhraseRange(null);
    }
  }, [activePhraseSelectionMessageId, item.chat_message_id]);

  useEffect(() => {
    if (item.translation && isNew) {
      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    } else {
      // Reset the animation value
      fadeAnim.setValue(0);
    }
  }, [item.translation, isNew, fadeAnim]);

  const toggleTextVisibility = () => {
    triggerHaptic();
    setIsTextRevealed(prev => !prev);
  };

  const handleWordPressInternal = (word: string, wordIndex: number) => {
    if (isTextRevealed) {
      triggerHaptic();

      if (isPhraseSelectionMode) {
        // If we're in phrase selection mode, select the phrase
        const words = item.content.split(/\s+/);
        const start = Math.min(firstSelectedWordIndex!, wordIndex);
        const end = Math.max(firstSelectedWordIndex!, wordIndex);
        const phrase = words.slice(start, end + 1).join(' ');

        // If the phrase is just one word, treat it as a regular word selection
        if (start === end) {
          const sentence = getSentenceFromContent(item.content, phrase);
          onWordPress?.(phrase, item.chat_message_id, sentence, false);
        } else {
          // Update the selected phrase range
          setSelectedPhraseRange({ start, end });

          // Open VocabWordModal with the selected phrase
          onWordPress?.(phrase, item.chat_message_id, item.content, true);
        }

        // Reset selection mode
        setIsPhraseSelectionMode(false);
        setFirstSelectedWordIndex(null);
      } else {
        // Normal word selection
        const sentence = getSentenceFromContent(item.content, word);
        onWordPress?.(word, item.chat_message_id, sentence, false);
      }
    }
  };

  const handleWordLongPress = (word: string, wordIndex: number) => {
    if (isTextRevealed) {
      triggerHaptic();
      setIsPhraseSelectionMode(true);
      setFirstSelectedWordIndex(wordIndex);
      setSelectedPhraseRange(null);
      onPhraseSelectionStart?.(item.chat_message_id); // Notify parent component
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

  // Add feature flag hooks

  const getLineHeight = () => {
    if (isTablet) return { lineHeight: 32 };
    return { lineHeight: 24 }; // default for non-tablets
  };

  const renderInteractiveText = (text: string, type: 'content' | 'alternative' | 'correction' | 'translation' | 'explanation', chatMode: string, highlightMode: 'word' | 'sentence' | 'off') => {
    if (!text) return null;

    // Preprocess text to handle multi-word bold phrases
    let processedText = text;
    if (item.role === 'assistant') {
      // Replace "*multi word phrases*" or "**multi word phrases**" with "*multi* *word* *phrases*"
      processedText = text.replace(/(\*{1,2})([^*]+)\1/g, (match: string, asterisks: string, phrase: string) => {
        return phrase.split(' ').map(word => `*${word}*`).join(' ');
      });
    }

    // Regular text rendering
    const lines = processedText.split('\n');
    let globalWordIndex = 0;

    return (
      <View style={styles.textContainer}>
        {isPhraseSelectionMode && firstSelectedWordIndex !== null && (
          <View style={[styles.tooltip, { 
            position: 'absolute',
            top: -40,
            right: '0%',
            transform: [{ translateX: -40 }],
            zIndex: 1000,
            minWidth: 150,
            backgroundColor: colorScheme === 'light' ? 'white' : '#374151',
          }]}>
            <Text style={[styles.tooltipText, { 
              color: colorScheme === 'light' ? '#00448f' : 'white',
              fontFamily: 'lato-regular',
            }]}>
              Tap 1st/last word to translate phrase
            </Text>
          </View>
        )}
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

              // Only apply bolding for AI messages
              const shouldProcessBolding = item.role === 'assistant';
              const cleanWord = shouldProcessBolding ? word.replace(/\*/g, '') : word;
              const parts = shouldProcessBolding ? word.split(/(\*[^*]+\*)/) : [word];

              // Check if this word is part of the selected phrase
              const isInSelectedPhrase = selectedPhraseRange && 
              currentWordIndex >= selectedPhraseRange.start && 
              currentWordIndex <= selectedPhraseRange.end;

              // Check if this word is the selected word
              const isSelectedWord = selectedWord === cleanWord;

              // Check if this word is the first selected word in phrase selection
              const isFirstSelected = isPhraseSelectionMode && firstSelectedWordIndex === currentWordIndex;
  
              return (
                <Pressable
                  key={`${type}-${lineIndex}-${currentWordIndex}`}
                  onPress={() => handleWordPressInternal(cleanWord, currentWordIndex)}
                  onLongPress={() => handleWordLongPress(cleanWord, currentWordIndex)}
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
                      : isInSelectedPhrase || isSelectedWord
                        ? colorScheme === 'light' ? 'rgba(0, 68, 143, 0.1)' : 'rgba(96, 165, 250, 0.4)'
                        : 'transparent',
                  }}>
                    <View style={{ flexDirection: 'row' }}>
                      {parts.map((part, index) => (
                        <Text
                          key={index}
                          className={cx({
                            'text-black dark:text-white': true,
                            'bg-[#FC5D5D]/20': isSelectedWord,
                            'invisible': isHidden,
                            'opacity-90': type !== 'content',
                            'font-bold': shouldProcessBolding && part.startsWith('*') && part.endsWith('*'),
                            'underline decoration-2': isFirstSelected,
                            'decoration-blue-500 dark:decoration-white': isFirstSelected
                          })}
                          style={[
                            isTablet ? GlobalFontStyleSheet.textMd : GlobalFontStyleSheet.textLg,
                            getLineHeight(),
                            {
                              fontFamily: shouldProcessBolding && part.startsWith('*') && part.endsWith('*') ? 'lato-extrabold' : 'lato-regular',
                              backgroundColor: isInSelectedPhrase || isSelectedWord ? (colorScheme === 'light' ? 'rgba(0, 68, 143, 0.1)' : 'rgba(96, 165, 250, 0.4)') : 'transparent',
                              textDecorationColor: colorScheme === 'light' ? '#00448f' : 'white',
                            },
                          ]}
                        >
                          {part.startsWith('*') ? part.slice(1, -1) : part}
                        </Text>
                      ))}
                      <Text> </Text>
                    </View>
                  </Animated.View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

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
            'pb-0': item.role === 'user' , // No padding if no translation or correction
          })}
          style={item.role === 'user' ? styles.messageContainer : styles.aiMessageContainer}
        >
          <View style={
            item.role === 'user' ? styles.userMessageContent : styles.aiMessageContent
          }>
            {renderInteractiveText(item.content, 'content', chatMode, highlightMode)}
          </View>

          {item.role !== 'user' && item.translation && isNew && (
            <Animated.View 
              className="border-l-2 border-blue-500 pl-2 mb-2" 
              style={{
                opacity: fadeAnim,
                transform: [{
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0]
                  })
                }]
              }}
            >
              <Text 
                className="text-lg text-gray-800  dark:text-white" 
                style={{ lineHeight: 24, fontStyle: 'normal'}}
              >
                {item.translation}
              </Text>
            </Animated.View>
          )}
          
        </View>
      </View>
      {item.role === 'assistant' && (
        <AIMessageActions
          chatMode={chatMode}
          isPlaying={playingAudioId === item.chat_message_id}
          isPlayingSlowAudio={playingSlowAudioId === item.chat_message_id}
          hasTranslation={!!item.translation}
          audioUrl={item.audio_url}
          wordTimings={item.word_timings}
          chatMessageId={item.chat_message_id}
          content={item.content}
          slowAudioUrl={item.slow_audio_url}
          audioPlayerService={audioPlayerService}
          chatId={chatData.chat.id}
          language={chatData.chat.language}
          targetLanguage={targetLanguage}
          highlightMode={highlightMode}
          colorScheme={colorScheme}
          onPlayingChange={setCurrentPlayingMessageId}
          onPlayingSlowChange={setPlayingSlowAudioId}
          onTranslationChange={(messageId, translation) => {
            setChatData(prevData => ({
              ...prevData!,
              messages: prevData!.messages.map(message =>
                message.chat_message_id === messageId
                  ? { ...message, translation }
                  : message
              ),
            }));
          }}
          onSlowAudioChange={(messageId, audioUrl) => {
            setChatData(prevData => ({
              ...prevData!,
              messages: prevData!.messages.map(message =>
                message.chat_message_id === messageId
                  ? { ...message, slow_audio_url: audioUrl }
                  : message
              ),
            }));
          }}
          isTextRevealed={isTextRevealed}
          onToggleVisibility={toggleTextVisibility}
          isListenFirst={chatMode === 'audio_only'}
          onTranslationModalOpen={onTranslationModalOpen} // Pass the prop
          isRecording={isRecording}
          onCancelRecording={cancelRecording}
        />
      )}
      {item.role === 'user' && (
        <UserMessageActions
          isPlaying={playingAudioId === item.chat_message_id}
          correctionText={item.correction}
          hasTranslation={!!item.translation}
          isAudioOnly={item.audio_only}
          isTextRevealed={isTextRevealed}
          content={item.content}
          chatMessageId={item.chat_message_id}
          colorScheme={colorScheme}
          onCorrection={() => {
            // Find the previous AI message for context
            const messageIndex = chatData?.messages.findIndex(msg => msg.chat_message_id === item.chat_message_id) || 0;
            const previousMessages = chatData?.messages.slice(0, messageIndex).reverse() || [];
            const previousAIMessage = previousMessages.find(msg => msg.role === 'assistant');

            onTextCorrection(item, previousAIMessage);
          }}
          onAlternativeResponse={() => handleAlternativeResponse(item)}
          onTranslate={() => onTranslate(item.content, item.chat_message_id)}
          onToggleVisibility={toggleTextVisibility}
          onTranslationModalOpen={onTranslationModalOpen} // Pass the prop
          language={chatData.chat.language}
          targetLanguage={targetLanguage}
          audioPlayerService={audioPlayerService}
          onPlayingChange={setCurrentPlayingMessageId}
        />
      )}
    </View>
  );
});
