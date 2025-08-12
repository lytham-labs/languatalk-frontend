import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Platform, StyleSheet } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronLeft, faEye, faEyeSlash, faPlus, faCheck } from '@fortawesome/free-solid-svg-icons';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/constants/api';
import { useColorScheme } from '@/hooks/useColorScheme';
import cx from 'classnames';
import { Colors } from '@/constants/Colors';
import { useNavigation } from '@react-navigation/native';
import { useWebSocket } from '@/contexts/ActionCableWebSocketContext';
import AudioPlayerService from '@/services/AudioPlayerService';
import AudioPlayer from '@/components/AudioPlayer';
import { InteractiveText } from '@/components/shared/InteractiveText';
import SkeletonLoader from '@/components/SkeletonLoader';
import useDevice from '@/hooks/useDevice';
import FlashcardService from '@/services/FlashcardService';
import * as Haptics from 'expo-haptics';
import useUserSettings from '@/services/api/useUserSettings';

const HighlightedText = ({ 
  text, 
  colorScheme,
  language
}: { 
  text: string;
  colorScheme: 'light' | 'dark';
  language: string;
}) => {
  const [visibleTranslations, setVisibleTranslations] = useState<{[key: number]: boolean}>({});
  const [addedItems, setAddedItems] = useState<{[key: string]: boolean}>({});
  const [addingItems, setAddingItems] = useState<{[key: string]: boolean}>({});
  const { token } = useAuth();
  const flashcardService = useMemo(() => token ? new FlashcardService(token) : null, [token]);
  const { userSettings } = useUserSettings();

  const processText = (line: string, lineIndex: number) => {
    if (!line.trim()) return null;
    
    let processedText = line.replace(/<break[^>]*\/>/g, '').replace(/--/g, '');
    const translationRegex = /<translation>(.*?)<\/translation>/;
    const hasTranslation = translationRegex.test(processedText);
    let mainText = processedText.replace(/<translation>.*?<\/translation>/g, '');
    let translation = '';

    const translationMatch = processedText.match(translationRegex);
    if (translationMatch) {
      translation = translationMatch[1];
    }

    if (!mainText.trim()) return null;

    const parts = mainText.split('>');
    if (parts.length > 1) {
      return {
        regular: parts[0] + '>',
        strikethrough: parts[1],
        translation,
        hasTranslation,
        isVocab: mainText.trim().split(' ').length <= 10
      };
    }
    
    return { 
      regular: mainText, 
      strikethrough: '',
      translation,
      hasTranslation,
      isVocab: mainText.trim().split(' ').length <= 10
    };
  };

  const toggleTranslation = (lineIndex: number) => {
    setVisibleTranslations(prev => ({
      ...prev,
      [lineIndex]: !prev[lineIndex]
    }));
  };

  const handleAddToVocab = async (word: string, translation: string) => {
    if (!flashcardService || !token) return;
    
    const itemKey = `${word}-${translation}`;
    
    try {
      setAddingItems(prev => ({ ...prev, [itemKey]: true }));
      
      // Check if it's a single word or a phrase by counting spaces
      const wordCount = word.trim().split(/\s+/).length;
      const wordType = wordCount === 1 ? 'words' : 'phrase';
      
      await flashcardService.addFlashcard({
        front: word,
        back: translation,
        language: language,
        flashcard_type: 'word',
        context_sentence: '',
        translated_sentence: '',
        tags: [wordType] // Add appropriate tag based on word count
      });
      
      setAddedItems(prev => ({ ...prev, [itemKey]: true }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Error adding word to vocabulary:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAddingItems(prev => ({ ...prev, [itemKey]: false }));
    }
  };

  const lines = text.split('\n');

  return (
    <View style={styles.contentContainer}>
      {lines.map((line, lineIndex) => {
        const processed = processText(line, lineIndex);
        if (!processed) return null;

        const { regular, strikethrough, translation, hasTranslation, isVocab } = processed;
        const isTranslationVisible = visibleTranslations[lineIndex];
        const itemKey = `${regular}-${translation}`;
        const isAdding = addingItems[itemKey];
        const isAdded = addedItems[itemKey];

        if (isVocab && hasTranslation) {
          return (
            <View 
              key={`line-${lineIndex}`}
              style={[
                styles.vocabCard,
                { backgroundColor: colorScheme === 'dark' ? '#1F2937' : '#FFFFFF' },
              ]}
            >
              <View style={styles.vocabContent}>
                <InteractiveText
                  text={regular}
                  colorScheme={colorScheme}
                  languageCode={language}
                  targetLanguage={userSettings?.team.langua_native_language || 'english'}
                />
                {isTranslationVisible && (
                  <Text 
                    style={[
                      GlobalFontStyleSheet.textBase,
                      { color: colorScheme === 'dark' ? '#9CA3AF' : '#6B7280', marginTop: 4 },
                    ]}
                  >
                    {translation}
                  </Text>
                )}
              </View>
              <View style={styles.vocabActions}>
                {isAdded ? (
                  <View style={styles.addedIcon}>
                    <FontAwesomeIcon icon={faCheck} size={14} color="#fff" />
                  </View>
                ) : (
                  <TouchableOpacity 
                    onPress={() => translation && handleAddToVocab(regular, translation)}
                    style={[
                      styles.addIcon,
                      { backgroundColor: isAdding ? '#9CA3AF' : '#FC5D5D' },
                    ]}
                    disabled={isAdding || !translation}
                  >
                    {isAdding ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <FontAwesomeIcon icon={faPlus} size={14} color="#fff" />
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  onPress={() => {
                    toggleTranslation(lineIndex);}}
                  style={[
                    styles.vocabIcon,
                    { backgroundColor: colorScheme === 'dark' ? '#374151' : '#F3F4F6' },
                  ]}
                >
                  <FontAwesomeIcon 
                    icon={isTranslationVisible ? faEye : faEyeSlash} 
                    size={14} 
                    color={colorScheme === 'dark' ? '#D1D5DB' : '#4B5563'} 
                  />
                </TouchableOpacity>
              </View>
            </View>
          );
        }

        return (
          <View
            key={`line-${lineIndex}`}
            style={[
              styles.paragraphContainer,
              { backgroundColor: colorScheme === 'dark' ? '#1F2937' : '#FFFFFF' },
            ]}
          >
            <View style={styles.textContent}>
              <InteractiveText 
              text={regular} 
              colorScheme={colorScheme} 
              languageCode={language} 
              targetLanguage={userSettings?.team.langua_native_language || 'english'}
              />
              {strikethrough && (
                <InteractiveText
                  text={strikethrough}
                  colorScheme={colorScheme}
                  languageCode={language}
                  targetLanguage={userSettings?.team.langua_native_language || 'english'}
                  parseCorrection={(text) => [
                    {
                      text: strikethrough,
                      type: 'del',
                    },
                  ]}
                  isCorrection={true}
                />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default function SummaryScreen() {
  const { id } = useLocalSearchParams();
  const { token } = useAuth();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryText, setSummaryText] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>('en');
  const audioPlayerService = useMemo(() => new AudioPlayerService(), []);
  const { connectWebSocket, closeWebSocket, onMessage, removeMessageListener } = useWebSocket();
  const isMounted = useRef(true);
  const hasReceivedData = useRef(false);
  const { isTablet } = useDevice();

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    if (!isMounted.current) return;

    const data = JSON.parse(
      typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
    );
    
    // Check if this is a summary update message
    if (data.action === 'received' && data.summary_text && data.audio_url && !hasReceivedData.current ) {
      setSummaryText(data.summary_text);
      setAudioUrl(data.audio_url);
      setLanguage(data.language);
      setIsLoading(false);
      hasReceivedData.current = true;
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    if (!id || !token || hasReceivedData.current || summaryText) return;

    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/v1/chats/${id}/chat_summary`, {
        headers: {
          'Authorization': `${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch summary');
      }

      const data = await response.json();
      if (data.summary && !hasReceivedData.current) {
        setIsLoading(false);
        setSummaryText(data.summary);
        setAudioUrl(data.audio_url);
        setLanguage(data.language);
        hasReceivedData.current = true;
      }
      // If no summary exists or is stale, the backend will trigger generation
      // and we'll receive the update via WebSocket
    } catch (error) {
      setIsLoading(false);
      console.error('Error fetching summary:', error);
      if (!hasReceivedData.current) {
        setError(error instanceof Error ? error.message : 'Failed to fetch summary');
      }
    }
  }, [id, token, summaryText]);

  useEffect(() => {
    if (!id || !token) return;

    const wsId = -1;

    connectWebSocket(wsId, {
      name: 'ChatChannel',
      params: { chat_id: id }
    });

    onMessage(wsId, handleWebSocketMessage);

    if (!hasReceivedData.current) {
      fetchSummary();
    }

    return () => {
      isMounted.current = false;
      removeMessageListener(wsId, handleWebSocketMessage);
      closeWebSocket(wsId, 'ChatChannel');
      if (audioPlayerService) {
        audioPlayerService.stopSound();
      }
    };
  }, [id, token]);

  useEffect(() => {
      navigation.setOptions({
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.navigate('/speak')}>
            <FontAwesomeIcon 
              icon={faChevronLeft} 
              size={24} 
              color={Colors[colorScheme ?? 'light'].text} 
            />
          </TouchableOpacity>
        ),
      });
  }, [navigation, colorScheme, router]);

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    hasReceivedData.current = false;
    fetchSummary();
  };

  const forcedColorScheme = colorScheme || 'light';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView 
        className={cx(
          "flex-1",
          colorScheme === 'dark' ? 'bg-gray-900' : 'bg-white'
        )}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
      >
        <View className={`p-6 ${isTablet ? 'p-16' : 'p-6'}`}>

          {isLoading && !summaryText ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="large" color="#00448f" />
              <Text style={GlobalFontStyleSheet.textXl} className="text-center pt-3 m-4 font-bold text-gray-800 dark:text-white">
                Generating summary...
              </Text>
              <Text style={GlobalFontStyleSheet.textBase} className="text-center mb-4 text-gray-600 dark:text-white">
                It typically takes 20-30 seconds.
              </Text>
              <SkeletonLoader styleType="simple" />
            </View>
            
          ) : error ? (
            <View className="py-8">
              <Text 
                style={GlobalFontStyleSheet.textMd}
                className="text-red-500 text-center mb-4"
              >
                {error}
              </Text>
              <TouchableOpacity 
                onPress={handleRetry}
                className="mt-4 bg-blue-500 py-2 px-4 rounded-lg self-center"
              >
                <Text 
                  style={GlobalFontStyleSheet.textMd}
                  className="text-white"
                >
                  Try Again
                </Text>
              </TouchableOpacity>
            </View>
          ) : summaryText ? (
            <View>
              <HighlightedText 
                text={summaryText}
                colorScheme={forcedColorScheme}
                language={language}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {audioUrl && (
        <View 
          style={[
            styles.fixedPlayer,
            { 
              backgroundColor: colorScheme === 'dark' ? '#1F2937' : '#FFFFFF',
              borderTopColor: colorScheme === 'dark' ? '#374151' : '#E5E7EB',
            }
          ]}
        >
          <AudioPlayer
            audioUrl={audioUrl}
            colorScheme={forcedColorScheme}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    gap: 12,
    padding: 5,
  },
  paragraphContainer: {
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  vocabCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  vocabContent: {
    flex: 1,
    marginRight: 12,
  },
  vocabActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vocabIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FC5D5D',
  },
  addedIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#10B981',
  },
  textContent: {
    flex: 1,
  },
  fixedPlayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
});
