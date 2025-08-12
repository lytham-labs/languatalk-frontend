import { View, Text, Pressable, Image, useWindowDimensions, StyleSheet, Platform } from 'react-native';
import { memo, useRef, useState, useEffect } from 'react';
import cx from 'classnames';
import { GlobalFontStyleSheet } from '@/constants/Font';
import AIMessageActions from '@/components/speak/AIMessageActions';
import UserMessageActions from '@/components/speak/UserMessageActions';
import { Animated } from 'react-native';
import useDevice from '@/hooks/useDevice';
import * as Haptics from 'expo-haptics';
import { useChatData } from '@/contexts/ChatDataContext';
import { useSelection } from '@/contexts/SelectionContext';
import { Line, PressableSegment, ProcessedMessage, Segment } from '@/types/chat';
import SegmentText from '@/components/shared/SegmentText';
import { getFontSize } from '@/constants/Font';

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
  flashItemkey: string;
  item: ProcessedMessage;
  colorScheme?: 'light' | 'dark';
  chatMode?: string;
  audioPlayerService?: any;
  chatData?: any;
  isNew?: boolean;
  targetLanguage?: string;
  // Missing props from original:
  playingAudioId: string | null;
  playingSlowAudioId: string | null;
  isRecording: boolean;
  cancelRecording: () => void;
  
  // Callbacks
  onWordPress?: (word: string, chatMessageId: string, sentence: string, isPhrase: boolean) => void;
  onPlayAudio?: (audioUrl: string, wordTimings: any, chatMessageId: string, text: string) => void;
  onPlaySlowAudio?: (item: any, chatMessageId: string, slowAudioUrl: string | null, text: string) => void;
  onTranslate?: (content: string, messageId: string) => void;
  onTextCorrection?: (item: any, previousMessage?: any) => void;
  onCorrectionExplanation?: (item: any) => void;
  handleAlternativeResponse?: (item: any) => void;
  onTranslationModalOpen?: (translation: string, originalText: string) => void;
  // State setters
  setCurrentPlayingMessageId?: (id: string | null) => void;
  setPlayingSlowAudioId?: (id: string | null) => void;
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
    // marginTop: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
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
    position: 'relative',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    flexDirection: 'column',
    flexWrap: 'nowrap',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
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
    alignItems: 'flex-end',
    marginBottom: 8,
    flex: 1,
  },
  spaceContainer: {
    marginRight: 0,
    marginVertical: 0,
  },
  wordContainer: {
    marginRight: 2,
    marginVertical: 3,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  segmentText: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 0,
    flexWrap: 'nowrap',
    paddingTop: 5,
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

export const MessageItem = memo(({ 
  flashItemkey,
  item,
  colorScheme = 'light',
  chatMode = 'text',
  audioPlayerService,
  chatData,
  playingAudioId,
  playingSlowAudioId,
  isRecording,
  cancelRecording,
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
  isNew,
  targetLanguage
}: MessageItemProps) => {

  const { state: chatDataState, dispatch: chatDataDispatch } = useChatData();
  const { highlight_mode: highlightMode } = chatDataState?.chat || {};
  const { width } = useWindowDimensions();
  const [isTextRevealed, setIsTextRevealed] = useState(
    !(item.role === 'assistant' && chatMode === 'audio_only')
  );
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Add new state for phrase selection
  const [isPhraseSelectionMode, setIsPhraseSelectionMode] = useState(false);
  const [firstSelectedWordIndex, setFirstSelectedWordIndex] = useState<number | null>(null);
  const [selectedPhraseRange, setSelectedPhraseRange] = useState<{start: number, end: number} | null>(null);

  const {
    selectedVocabWord,
    selectedSentence,
    activePhraseSelectionMessageId,
    setActivePhraseSelectionMessageId,
  } = useSelection();

  // Reset phrase selection when selectedWord changes (modal closes)
  useEffect(() => {
    if (!selectedVocabWord) {
      setSelectedPhraseRange(null);
      setIsPhraseSelectionMode(false);
      setFirstSelectedWordIndex(null);
    }
  }, [selectedVocabWord]);

  // Add effect to reset phrase selection when a different message item starts phrase selection
  useEffect(() => {
    if (!activePhraseSelectionMessageId || activePhraseSelectionMessageId !== item.chat_message_id) {
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
        const phrase = (item.messageSegmentTextArray ?? []).slice(start, end + 1).join(' ');

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
    // Only allow word interaction if text is revealed
    if (isTextRevealed) {
      triggerHaptic();
      setIsPhraseSelectionMode(true);
      setFirstSelectedWordIndex(wordIndex);
      setSelectedPhraseRange(null);
      setActivePhraseSelectionMessageId?.(item.chat_message_id); // Notify parent component
    }
  };

  const messageRef = useRef<View>(null);

  // Add feature flag hooks

  const getLineHeight = (hasRuby: boolean) => {
    if (isTablet) return { lineHeight: hasRuby ? 42 : 32 };
    return { lineHeight: hasRuby ? 35 : 24 }; // default for non-tablets
  };

  const renderMessageContent = (chatMessageId: string, lines: Line[], chatMode: string, highlightMode: 'word' | 'sentence' | 'off' ) => {
    let globalSegmentIndex = 0;
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
        {lines.map((line, lineIndex) => {
          // Handle empty lines (newlines) with proper spacing
          if (line.text === '' && line.pressableSegments.length === 0) {
            return (
              <View key={`${flashItemkey}-${chatMessageId}-empty-line-${lineIndex}`} style={{ flex:1 }}>
                <Text style={{ height: 16 }}>
                  {line.text}
                </Text>
              </View>
            );
          }
          console.log('********** MessageItem: text: ', line.text); 
          const lineHasRuby = line.pressableSegments.some((segment: PressableSegment) => segment.type === 'ruby');
          return (
            <View key={`${flashItemkey}-${chatMessageId}-content-line-${lineIndex}`} style={styles.lineContainer}>
              {line.pressableSegments.map((pressableSegment: PressableSegment, pressableSegmentIndex: number) => {
                const { type, text, isBold, segments, messageSegmentIndex } = pressableSegment;
                // // what about spaces? return spaces as space.
                if (!text.trim()) {
                  return (
                    <Text key={`${flashItemkey}-space-${chatMessageId}-${lineIndex}-${pressableSegmentIndex}`} style={styles.spaceContainer}> </Text>
                  );
                }
                // const currentWordIndex = globalSegmentIndex++;
                const currentWordIndex = messageSegmentIndex ?? -1;
                // Determine if this word should be hidden
                const isHidden = item.role === 'assistant' && 
                              chatMode === 'audio_only' && 
                              !isTextRevealed;
                
                // Check if this word is part of the selected phrase
                const isInSelectedPhrase = selectedPhraseRange && 
                currentWordIndex >= selectedPhraseRange.start && 
                currentWordIndex <= selectedPhraseRange.end;

                // Check if this word is the selected word
                const isSelectedWord = selectedVocabWord === text;

                // Check if this word is the first selected word in phrase selection
                const isFirstSelected = isPhraseSelectionMode && firstSelectedWordIndex === currentWordIndex;
                
                // console.log('********** MessageItem: segments: ', segments);
                return (
                  <Pressable
                    key={`${flashItemkey}-pressable-segment-${chatMessageId}-${lineIndex}-${currentWordIndex}-${pressableSegmentIndex}`}
                    onPress={() => handleWordPressInternal(text, currentWordIndex)}
                    onLongPress={() => handleWordLongPress(text, currentWordIndex)}
                    disabled={isHidden}
                  >
                    <Animated.View style={{
                      backgroundColor: audioPlayerService
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
                      <View className="flex-row nowrap" style={styles.wordContainer}>
                        {segments.map((segment: Segment, segmentIndex: number) => (
                          <SegmentText 
                            key={`${flashItemkey}-segment-text-${chatMessageId}-${lineIndex}-${currentWordIndex}-${segmentIndex}-${pressableSegmentIndex}`} 
                            segment={segment} 
                            type={chatDataState?.chat.pronunciation_characters && type === 'ruby' && chatDataState?.chat.pronunciation_characters !== 'disabled' ? 'ruby' : 'plain'}
                            isBold={isBold ?? false} 
                            isSelected={isSelectedWord} 
                            isFirstSelected={isFirstSelected} 
                            isInSelectedPhrase={isInSelectedPhrase} 
                            isHidden={isHidden} 
                            colorScheme={colorScheme} 
                            lineHeight={lineHasRuby ? (isTablet ? 42 : 35) : (isTablet ? 32 : 24)}
                          />
                        ))}
                      </View>
                    </Animated.View>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </View>
    )
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
            {/* handle no content */}
            {item.lines ? renderMessageContent(item.chat_message_id, item.lines, chatMode, highlightMode) : null}
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
          voice={chatData.chat.voice}
          voice_provider={chatData.chat.voice_provider}
          targetLanguage={targetLanguage}
          highlightMode={highlightMode}
          colorScheme={colorScheme}
          onPlayingChange={setCurrentPlayingMessageId}
          onPlayingSlowChange={setPlayingSlowAudioId}
          onTranslationChange={(messageId, translation) => {
            chatDataDispatch({'type': 'updateMessageProp', 'payload': {id: parseInt(messageId, 10), translation: translation}, key: 'translation'})
          }}
          onSlowAudioChange={(messageId, audioUrl) => {
            chatDataDispatch({'type': 'updateMessageProp', 'payload': {id: parseInt(messageId, 10), slow_audio_url: audioUrl}, key: 'slow_audio_url'})
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
