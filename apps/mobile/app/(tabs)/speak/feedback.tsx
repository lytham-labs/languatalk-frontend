import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL, WS_URL } from '@/constants/api';
import SkeletonLoader from '@/components/SkeletonLoader';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getFontSize, GlobalFontStyleSheet } from '@/constants/Font';
import { useNavigation } from 'expo-router';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import CollapsibleSection from '@/components/shared/CollapsibleSection';
import VocabWordModal from '@/components/speak/VocabWordModal';
import { getIconSize } from '@/constants/Font';
import { useWebSocket } from '@/contexts/ActionCableWebSocketContext';
import useDevice from '@/hooks/useDevice';
interface FeedbackSection {
  title: string;
  content: string;
}

interface FeedbackData {
  feedback: string;
  chat_date: string;
  language: string;
  native_language: string;
}

export default function FeedbackScreen() {
  const { id } = useLocalSearchParams();
  const { token } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [chatFeedback, setChatFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatDate, setChatDate] = useState<string>('');
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedSentence, setSelectedSentence] = useState<string | null>(null);
  const [isPhraseSelectionMode, setIsPhraseSelectionMode] = useState(false);
  const [firstSelectedWordIndex, setFirstSelectedWordIndex] = useState<number | null>(null);
  const [selectedPhraseRange, setSelectedPhraseRange] = useState<{start: number, end: number} | null>(null);
  const [activeListItemId, setActiveListItemId] = useState<string | null>(null);
  const [isVocabModalVisible, setIsVocabModalVisible] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState<string>('');
  const { isTablet } = useDevice();
  const [isPhrase, setIsPhrase] = useState(false);

  const navigation = useNavigation();

  const {
    connectWebSocket,
    closeWebSocket,
    onMessage,
    removeMessageListener,
  } = useWebSocket();

  const handleWordPress = (word: string, sentence: string, isPhrase: boolean) => {
    setSelectedWord(word);
    setSelectedSentence(sentence);
    setIsVocabModalVisible(true);
    setIsPhrase(isPhrase);
  };

  const handleWordPressInternal = (word: string, wordIndex: number, listItemId: string) => {
    if (isPhraseSelectionMode && activeListItemId === listItemId) {
      // If we're in phrase selection mode and in the same list item, select the phrase
      const words = word.split(/\s+/);
      const start = Math.min(firstSelectedWordIndex!, wordIndex);
      const end = Math.max(firstSelectedWordIndex!, wordIndex);
      
      // Get the actual words for the phrase
      const selectedWords = words.slice(start, end + 1);
      const phrase = selectedWords.join(' ');
      
      const cleanPhrase = phrase.replace(/[.,!?¿¡;:]+$/g, '');
      
      // If the phrase is just one word, treat it as a regular word selection
      if (start === end) {
        const sentence = getSentenceFromContent(word, cleanPhrase);
        handleWordPress(cleanPhrase, sentence, false);
        // Reset selection mode for single word
        setIsPhraseSelectionMode(false);
        setFirstSelectedWordIndex(null);
        setActiveListItemId(null);
      } else {
        setSelectedPhraseRange({ start, end });
        
        handleWordPress(cleanPhrase, word, true);
      }
    } else {
      // Normal word selection
      const cleanWord = word.split(/\s+/)[wordIndex].replace(/[.,!?¿¡;:\(\)《》「」『』（）、。！？]+$/g, '');
      const sentence = getSentenceFromContent(word, cleanWord);
      handleWordPress(cleanWord, sentence, false);
    }
  };

  const handleWordLongPress = (word: string, wordIndex: number, listItemId: string) => {
    // Reset any existing selection when starting a new one
    setSelectedPhraseRange(null);
    setIsPhraseSelectionMode(true);
    setFirstSelectedWordIndex(wordIndex);
    setActiveListItemId(listItemId);
  };

  const getSentenceFromContent = (content: string, word: string): string => {
    // First clean the HTML content
    const cleanContent = content
      .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
      .replace(/&nbsp;/g, ' ')   // Replace &nbsp; with spaces
      .replace(/\s+/g, ' ')      // Normalize spaces
      .trim();

    const endOfSentenceRegex = /[.!?。！？។៕။…\u3002\uFF01\uFF1F\u0964\u0965]/;
    
    // Split content into sentences
    const sentences = cleanContent.split(new RegExp(`(?<=${endOfSentenceRegex.source})`));
    
    // Find the sentence containing the word
    const targetSentence = sentences.find(sentence => {
      // Create word boundaries to match whole words only
      const wordRegex = new RegExp(`\\b${word}\\b`, 'i'); // Added 'i' flag for case-insensitive matching
      return wordRegex.test(sentence);
    });

    if (targetSentence) {
      return cleanSentence(targetSentence);
    }

    // If no sentence found, return a smaller context around the word
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

  const parseCorrection = (htmlText: string) => {
    // First clean up paragraph tags
    const cleanedHtml = htmlText.replace(/<\/?p>/g, '');
    
    const parts: { text: string; type: 'del' | 'ins' | 'b' | 'normal' }[] = [];
    const regex = /<(del|ins|b)>(.*?)<\/\1>|([^<]+)/g;
    let match;

    while ((match = regex.exec(cleanedHtml)) !== null) {
      if (match[1] && match[2]) {
        // For tagged content, trim only outer spaces but preserve inner spaces
        const text = match[1] === 'b' ? match[2].replace(/^\s+|\s+$/g, '') : match[2];
        parts.push({
          text: text,
          type: match[1] as 'del' | 'ins' | 'b'
        });
      } else if (match[3]) {
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
  const renderContent = (content: string) => {
    // Split content into list items and regular content
    const parts = content.split(/<\/?ul>/).map((part, index) => {
      if (part.includes('<li>')) {
        // Handle list items
        return (
          <View key={`list-${index}`} style={{ marginVertical: 8 }}>
            {part.split(/<li>/)
              .filter(item => item.trim())
              .map((item, itemIndex) => {
                const cleanItem = item.replace(/<\/li>/g, '').trim();
                const listItemId = `list-${index}-item-${itemIndex}`;
                
                return (
                  <View 
                    key={`item-${itemIndex}`}
                    style={{ 
                      flexDirection: 'row',
                      marginBottom: 8,
                      alignItems: 'flex-start'
                    }}
                  >
                    <Text style={{ 
                      marginRight: 8,
                      marginTop: 4,
                      color: colorScheme === 'dark' ? '#fff' : '#000'
                    }}>
                      •
                    </Text>
                    <View style={{ flex: 1, paddingLeft: 8 }}>
                      {renderParsedContent(cleanItem, listItemId)}
                    </View>
                  </View>
                );
              })}
          </View>
        );
      }
      // Handle regular content
      return renderParsedContent(part, `content-${index}`);
    });

    return <View>{parts}</View>;
  };

  const renderParsedContent = (content: string, listItemId: string) => {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {parseCorrection(content).map((part, index) => {
          const words = part.text.split(/\s+/);
          
          return words.map((word, wordIndex) => {
            if (!word.trim()) return null;
            
            // Clean the word of punctuation for the click handler
            const cleanWord = word.replace(/[.,!?;:\(\)]$/g, '');
            
            // Create a unique identifier for this word
            const wordId = `${listItemId}-${index}-${wordIndex}`;
            
            // Check if this word is part of the selected phrase
            const isInSelectedPhrase = selectedPhraseRange && 
              activeListItemId === listItemId &&
              wordIndex >= selectedPhraseRange.start && 
              wordIndex <= selectedPhraseRange.end;
            
            // Check if this word is the first selected word in phrase selection
            const isFirstSelected = isPhraseSelectionMode && 
              activeListItemId === listItemId && 
              firstSelectedWordIndex === wordIndex && !selectedPhraseRange;
            
            return (
              <Pressable
                key={wordId}
                onPress={() => {
                  if (part.type !== 'del') {
                    handleWordPressInternal(part.text, wordIndex, listItemId);
                  }
                }}
                onLongPress={() => handleWordLongPress(part.text, wordIndex, listItemId)}
                style={{ marginRight: 4, marginBottom: 4 }}
              >
                <Text
                  style={[
                    isTablet ? GlobalFontStyleSheet.textSm : GlobalFontStyleSheet.textBase,
                    {
                      lineHeight: isTablet ? 32 : 24,
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
                      fontWeight: '700',
                      color: colorScheme === 'dark' ? '#fff' : '#003670'
                    },
                    part.type === 'normal' && {
                      color: colorScheme === 'dark' ? '#fff' : '#000'
                    },
                    isInSelectedPhrase && {
                      backgroundColor: colorScheme === 'dark' ? 'rgba(96, 165, 250, 0.4)' : 'rgba(0, 68, 143, 0.1)',
                    },
                    isFirstSelected && {
                      textDecorationLine: 'underline',
                      textDecorationColor: colorScheme === 'dark' ? '#fff' : '#00448f',
                    }
                  ]}
                >
                  {word}{' '}
                </Text>
              </Pressable>
            );
          }).filter(Boolean);
        })}
      </View>
    );
  };

  const parseFeedbackSections = (htmlContent: string): FeedbackSection[] => {
    const sections = htmlContent.split(/<h5[^>]*>/i).filter(Boolean);
    return sections.map(section => {
      const titleMatch = section.match(/(.*?)<\/h5>/i);
      if (titleMatch) {
        return {
          title: titleMatch[1].trim(),
          content: section.replace(/.*?<\/h5>/i, '').trim()
        };
      }
      return {
        title: 'Feedback',
        content: section.trim()
      };
    });
  };

  const fetchFeedback = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/chats/${id}/feedback`, {
        headers: {
          'Authorization': `${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch feedback');
      }

      const data: FeedbackData = await response.json();
      
      if (data.feedback) {
        setChatFeedback(data.feedback);
        setChatDate(data.chat_date);
        setSourceLanguage(data.language);
        setTargetLanguage(data.native_language);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  useEffect(() => {
    if (!chatFeedback && token) {
      // Connect to ActionCable channel
      connectWebSocket(-1, {
        name: 'ChatFeedbackChannel',
        params: { chat_id: id }
      });

      const handleWebSocketMessage = (event: MessageEvent) => {
        const data = event.data?.data || event.data;

        if (data.completed) {
          setChatFeedback(data.feedback);
          setChatDate(data.date);
          setSourceLanguage(data.language);
          setTargetLanguage(data.native_language);
          setLoading(false);
        }
      };

      onMessage(-1, handleWebSocketMessage);

      return () => {
        removeMessageListener(-1, handleWebSocketMessage);
        closeWebSocket(-1, 'ChatFeedbackChannel');
      };
    }
  }, [chatFeedback, id, token, fetchFeedback]);

  useEffect(() => {
    // If we can't go back, add a manual back button
      navigation.setOptions({
        headerLeft: () => (
          <TouchableOpacity 
            onPress={() => router.navigate('/speak')}
          >
            <FontAwesomeIcon 
              icon={faChevronLeft} 
              size={getIconSize(24)} 
              color={Colors[colorScheme ?? 'light'].text} 
            />
          </TouchableOpacity>
        ),
      });
    
  }, [navigation]);

  return (
    <>
      <ScrollView className="flex-1 bg-white dark:bg-gray-900">
        <View className={`m-4 ${isTablet ? 'flex-1 items-center' : ''}`}>
          <View className={`${isTablet ? 'max-w-[700px] w-full' : 'w-full'}`}>

          <View>
            {loading ? (
              <Text style={isTablet ? GlobalFontStyleSheet.textLg : GlobalFontStyleSheet.textXl} className="text-center pt-3 m-4 font-bold text-gray-800 dark:text-white">
                We are generating your feedback
              </Text>
            ) : (
              <Text style={isTablet ? GlobalFontStyleSheet.textLg : GlobalFontStyleSheet.textXl} className="text-center pt-3 mx-4 mt-2 font-bold text-gray-800 dark:text-white">
                Feedback related to your conversation ({chatDate})
              </Text>
            )}
          </View>

          {loading ? (
            <View className="p-4">
              <Text style={GlobalFontStyleSheet.textBase} className="text-center mb-4 text-gray-600 dark:text-white">
                It typically takes 10-20 seconds.
              </Text>
              <SkeletonLoader styleType="simple" />
            </View>
          ) : chatFeedback ? (
            <View className="py-4 px-1">
              {parseFeedbackSections(chatFeedback).map((section, index) => (
                <CollapsibleSection
                  key={index}
                  initiallyExpanded={index === 0}
                  title={
                    <Text 
                      style={isTablet ? GlobalFontStyleSheet.textMd : GlobalFontStyleSheet.textLg} 
                      className="text-gray-800 dark:text-white py-2 font-bold"
                    >
                      {section.title}
                    </Text>
                  }
                >
                  {renderContent(section.content)}
                </CollapsibleSection>
              ))}
            </View>
          ) : (
            <View className="p-4">
              <Text style={GlobalFontStyleSheet.textBase} className="text-center text-gray-600 dark:text-gray-400">
                Failed to load feedback. Please try again later.
              </Text>
            </View>
          )}
        </View>
      </View>
      </ScrollView>

      <VocabWordModal
        visible={isVocabModalVisible}
        onClose={() => {
          setIsVocabModalVisible(false);
          setSelectedWord(null);
          setSelectedSentence(null);
          setIsPhraseSelectionMode(false);
          setFirstSelectedWordIndex(null);
          setSelectedPhraseRange(null);
          setActiveListItemId(null);
          setIsPhrase(false);
        }}
        word={selectedWord || ''}
        language={sourceLanguage}
        targetLanguage={targetLanguage}
        contextSentence={selectedSentence || ''}
        isPhrase={isPhrase}
      />
    </>
  );
}

