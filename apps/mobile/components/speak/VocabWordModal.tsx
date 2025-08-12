import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, Animated, StyleSheet, PixelRatio, Platform, Dimensions } from 'react-native';
import SlidingModal from '@/components/shared/SlidingModal';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faPlus, faVolumeUp, faTimes, faLanguage, faBook, faArrowsLeftRight, faCheck } from '@fortawesome/free-solid-svg-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import AudioPlayerService from '@/services/AudioPlayerService';
import FlashcardService from '@/services/FlashcardService';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/constants/api';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { getIconSize, GlobalFontStyleSheet, getFontStyle } from '@/constants/Font';
import useUserSettings from '@/services/api/useUserSettings';
import { useReadingAid } from '@/contexts/ReadingAidContext';
import { processTextSegments } from '@/utils/textProcessingUtils';
import { PressableSegment, Segment } from '@/types/chat';
import VocabModalSegment from './VocabModalSegment';

export type VocabWordModalProps = {
  visible: boolean;
  onClose: () => void;
  onOpen?: () => void;
  word: string;
  language: string;
  targetLanguage: string;
  contextSentence?: string;
  onWordTranslated?: (word: string, translation: string) => void;
  onWordSaved?: (word: string, translation: string) => void;
  isPhrase?: boolean;
};

interface Example {
  source: string;
  translation: string;
}

interface Phrase {
  source: string;
  translation: string;
}

interface AddedItems {
  [key: string]: boolean;
}

interface WordInfo {
  explain: string;
  gender: string | null;
  lemma: string;
  pos: string;
}

// Add new interface for multiple translations
interface Translation {
  source: string;
  translation: string;
}

// Helper to detect if running on iPad
const isIpad = () => {
  const { width, height } = Dimensions.get('window');
  return (
    Platform.OS === 'ios' &&
    (Platform.isPad ||
     (width > 700 && height > 700) || 
     (width > 960 && height > 720))
  );
};

function removePunctuation(str: string): string {
  // Remove punctuation but keep letters (including accented ones), numbers, and whitespace.
  return str.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
}

  // Helper function to capitalize language names
  const capitalizeLanguage = (language: string) => {
    return language.charAt(0).toUpperCase() + language.slice(1).toLowerCase();
  };

export default function VocabWordModal({ 
  visible, 
  onClose, 
  onOpen, 
  word, 
  language, 
  targetLanguage, 
  contextSentence,
  onWordTranslated,
  onWordSaved,
  isPhrase = false
}: VocabWordModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const { token } = useAuth();
  const { userSettings } = useUserSettings();
  const [voice, setVoice] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [translation, setTranslation] = useState<string>('');
  const [examples, setExamples] = useState<Example[]>([]);
  const [similarWords, setSimilarWords] = useState<Example[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { readingAidService } = useReadingAid();
  
  // Loading states for each section
  const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);
  const [isLoadingExamples, setIsLoadingExamples] = useState(false);
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);
  
  // Visibility states for each section
  const [showTranslation, setShowTranslation] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [showSimilar, setShowSimilar] = useState(false);
  
  // Add new states for phrases
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [isLoadingPhrases, setIsLoadingPhrases] = useState(false);
  const [showPhrases, setShowPhrases] = useState(false);

  // Add state for active tab
  const [activeTab, setActiveTab] = useState<'examples' | 'similar' | 'phrases'>('examples');

  const audioPlayerService = useRef(new AudioPlayerService()).current;
  const flashcardService = useRef(token ? new FlashcardService(token) : null).current;

  // Add state for audio URL
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // Add these states inside the VocabWordModal component
  const [addedItems, setAddedItems] = useState<AddedItems>({});
  const [addingItems, setAddingItems] = useState<AddedItems>({});

  // Add these state variables at the top with other states
  const [expandedSections, setExpandedSections] = useState<{
    context: boolean;
    examples: boolean;
    similar: boolean;
    phrases: boolean;
    infinitive: boolean;
    multiple: boolean;
    definition: boolean;
  }>({
    context: false,
    examples: false,
    similar: false,
    phrases: false,
    infinitive: false,
    multiple: false,
    definition: false,
  });

  // Add these state variables near the top with other states
  const [contextTranslation, setContextTranslation] = useState<string>('');
  const [isLoadingTextProcessing, setIsLoadingTextProcessing] = useState(false);
  const [processedRubySegments, setProcessedRubySegments] = useState<PressableSegment[] | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [showContext, setShowContext] = useState(false);

  // Add state for animation
  const [isClosing, setIsClosing] = useState(false);

  // Add state for scale animation
  const [scaleAnim] = useState(new Animated.Value(1));

  // Add new state variables
  const [wordInfo, setWordInfo] = useState<WordInfo | null>(null);
  const [infinitiveTranslations, setInfinitiveTranslations] = useState<Translation[]>([]);
  const [isLoadingInfinitive, setIsLoadingInfinitive] = useState(false);
  const [showInfinitive, setShowInfinitive] = useState(false);

  // Add new state for multiple translations
  const [multipleTranslations, setMultipleTranslations] = useState<Translation[]>([]);
  const [isLoadingMultiple, setIsLoadingMultiple] = useState(false);
  const [showMultiple, setShowMultiple] = useState(false);

  // Add new state for definition
  const [definition, setDefinition] = useState<string>('');
  const [isLoadingDefinition, setIsLoadingDefinition] = useState(false);
  const [showDefinition, setShowDefinition] = useState(false);

  // Compute the cleaned word to remove punctuation
  const cleanWord = word ? removePunctuation(word) : "";

  const processRubySegments = async (word : string, readingAidService?: any) => {
    // processing the word.
    const processedRubySegments = await processTextSegments(word, readingAidService);
    console.log('******VocabWordModal******  processed ruby segments', processedRubySegments);
    setProcessedRubySegments(processedRubySegments);
  }

  // Add useEffect for voice settings
  useEffect(() => {
    if (userSettings?.team?.chat_settings?.voice) {
      const fullVoice = userSettings.team.chat_settings.voice;
      // Only use the voice if it contains "11labs"
      if (fullVoice.toLowerCase().includes('elevenlabs')) {
        const shortVoice = fullVoice.split('_')[0];
        setVoice(shortVoice);
      } else {
        setVoice('');
      }
    }
  }, [userSettings]);

  // Add new handler for all meanings
  const handleAllMeanings = async () => {
    if (!token || !word || isLoadingMultiple) return;

    setIsLoadingMultiple(true);
    setError(null);
    try {
      const response = await fetch('https://translation-worker.lythamlabs.workers.dev', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          word: word,
          language: language,
          target_language: targetLanguage,
          translation_type: 'multiple'
        }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data = await response.json();
      const formattedTranslations = data.translations.map((t: { translation: string }) => ({
        source: word,
        translation: t.translation
      }));
      setMultipleTranslations(formattedTranslations);
      setShowMultiple(true);
    } catch (error) {
      console.error('Error fetching multiple translations:', error);
    } finally {
      setIsLoadingMultiple(false);
    }
  };

  // Add useEffect to fetch translation when modal opens
  useEffect(() => {
    if (visible) {
      if (onOpen) {
        onOpen();
      }
      if (word && !translation) {
        if (readingAidService) {
          console.log('******VocabWordModal******  processing ruby segments', word);
          processRubySegments(word, readingAidService);
        }
        handleFetchTranslation();
      }
    }

    // Cleanup function
    return () => {
      if (audioPlayerService) {
        audioPlayerService.stopSound().catch(error => {
          console.error("Error cleaning up audio:", error);
        });
      }
    };
  }, [visible, word, onOpen, readingAidService]);

  const resetState = () => {
    setIsLoading(false);
    setTranslation('');
    setExamples([]);
    setSimilarWords([]);
    setError(null);
    setIsPlayingAudio(false);
    setIsSuccess(false);
    
    setIsLoadingTranslation(false);
    setIsLoadingExamples(false);
    setIsLoadingSimilar(false);
    
    setShowTranslation(false);
    setShowExamples(false);
    setShowSimilar(false);
    setPhrases([]);
    setIsLoadingPhrases(false);
    setShowPhrases(false);
    setContextTranslation('');
    setIsLoadingContext(false);
    setShowContext(false);
    setExpandedSections({
      context: false,
      examples: false,
      similar: false,
      phrases: false,
      infinitive: false,
      multiple: false,
      definition: false,
    });
    setWordInfo(null);
    setInfinitiveTranslations([]);
    setIsLoadingInfinitive(false);
    setShowInfinitive(false);
    setMultipleTranslations([]);
    setIsLoadingMultiple(false);
    setShowMultiple(false);
    setDefinition('');
    setIsLoadingDefinition(false);
    setShowDefinition(false);
    setExpandedSections(prev => ({ ...prev, definition: false }));
  };

  const handleClose = async () => {
    setIsClosing(true);
    if (isPlayingAudio) {
      try {
        await audioPlayerService.stopSound();
      } catch (error) {
        console.error("Error stopping audio:", error);
      }
    }
    
    setTimeout(() => {
      setIsClosing(false);
      resetState();
      onClose();
    }, 300);
  };

  const handleFetchTranslation = async () => {
    if (!token || isLoadingTranslation) return;
    
    setIsLoadingTranslation(true);
    setError(null);
    try {      
      const translationPromise = fetch('https://translation-worker.lythamlabs.workers.dev', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          word: word,
          sentence: word,
          context_sentence: contextSentence,
          language: language,
          target_language: targetLanguage,
          translation_type: isPhrase ? 'sentence' : 'word'
        }),
      }).then(response => {
        if (!response.ok) {
          throw new Error('Translation failed');
        }
        return response.json();
      });

      const wordInfoPromise = fetch(`${API_URL}/api/v1/word_infos?word=${encodeURIComponent(word)}&language=${encodeURIComponent(language)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        }
      }).then(response => {
        if (!response.ok) {
          return null;
        }
        return response.json();
      });

      // Wait for both promises to resolve
      const [translationData, wordInfoData] = await Promise.all([translationPromise, wordInfoPromise]);

      // Set translation
      setTranslation(translationData.translation);
      
      // Call onWordTranslated when translation is fetched
      if (onWordTranslated && translationData.translation) {
        onWordTranslated(word, translationData.translation);
      }

      // Set word info if available and valid
      if (wordInfoData && typeof wordInfoData === 'object' && wordInfoData !== null) {
        setWordInfo(wordInfoData);
      }
    } catch (error) {
      console.error('Error fetching translation:', error);
    } finally {
      setIsLoadingTranslation(false);
    }
  };


  const handleFetchExamples = async () => {
    if (!flashcardService || isLoadingExamples) return;
    
    setIsLoadingExamples(true);
    setError(null);
    try {
      const examplesData = await flashcardService.getUsageExamples(
        word,
        language || '',
        targetLanguage
      );

      // Safely handle the response data
      const formattedExamples = (examplesData?.examples || []).map((example: any) => ({
        source: example.source || example.text || '',
        translation: example.translation || example.translated_text || ''
      }));

      setExamples(formattedExamples);
      setShowExamples(true);
      setActiveTab('examples');
    } catch (err) {
      console.error('Error fetching examples:', err);
      setError('Unable to load examples. Please try again.');
    } finally {
      setIsLoadingExamples(false);
    }
  };

  const handleFetchSimilar = async () => {
    if (!flashcardService || isLoadingSimilar) return;
    
    setIsLoadingSimilar(true);
    setError(null);
    try {
      const similarData = await flashcardService.getSimilarWords(
        word,
        language || ''
      );
      setSimilarWords(similarData.similar_words);
      setShowSimilar(true);
      setActiveTab('similar');
    } catch (err) {
      console.error('Error fetching similar words:', err);
      setError('Unable to load similar words. Please try again.');
    } finally {
      setIsLoadingSimilar(false);
    }
  };

  const handleFetchPhrases = async () => {
    if (!flashcardService || isLoadingPhrases) return;
    
    setIsLoadingPhrases(true);
    setError(null);
    try {
      const phrasesData = await flashcardService.getPhraseExamples(
        word,
        language || ''
      );
      setPhrases(phrasesData.phrases);
      setShowPhrases(true);
      setExpandedSections(prev => ({ ...prev, phrases: true }));
    } catch (err) {
      console.error('Error fetching phrases:', err);
      setError('Unable to load phrases. Please try again.');
    } finally {
      setIsLoadingPhrases(false);
    }
  };

  const handleFetchDefinition = async () => {
    if (!token || !word || isLoadingDefinition) return;
    
    setIsLoadingDefinition(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/definitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          word: cleanWord,
          language: language,
          context: contextSentence
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch definition');
      }

      const data = await response.json();
      setDefinition(data.definition);
      setShowDefinition(true);
    } catch (err) {
      console.error('Error fetching definition:', err);
      setError('Unable to load definition. Please try again.');
    } finally {
      setIsLoadingDefinition(false);
    }
  };

  const handleAddToVocab = async () => {
    if (!flashcardService || !token) return;
    
    setIsLoading(true);
    setError(null);
    try {
      // Make sure we have a translation first
      if (!translation) {
        // Fetch translation if we don't have it
        const response = await fetch('https://translation-worker.lythamlabs.workers.dev', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            word: word,
            language: language,
            target_language: targetLanguage,
            translation_type: 'word'
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch translation');
        }

        const data = await response.json();
        setTranslation(data.translation);
        
        // Wait for translation to be set
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Now we should have the translation
      if (!translation) {
        throw new Error('No translation available');
      }

      // Add to flashcards using FlashcardService
      await flashcardService.addFlashcard({
        front: word,
        back: translation,
        language: language || '',
        flashcard_type: 'word',
        context_sentence: examples[0]?.source,
        translated_sentence: examples[0]?.translation,
        tags: [] // Remove tags for words
      });

      // Call onWordSaved when word is added to vocabulary
      if (onWordSaved) {
        onWordSaved(word, translation);
      }

      setIsSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error adding to vocabulary:', error);
      setError('Failed to add to vocabulary. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayAudio = async () => {
    if (!word) return;
    
    // Add haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Animate the scale
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    if (isPlayingAudio) {
      await audioPlayerService.pauseSound();
      setIsPlayingAudio(false);
      return;
    }

    setIsLoadingAudio(true);
    try {
      const response = await fetch(
        `${API_URL}/api/v1/stream_text_to_speech`,
        {
          method: "POST",
          headers: {
            Authorization: `${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: word,
            language: language,
            voice_provider: 'elevenlabs',
            voice: voice
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to fetch audio");

      // Get the text from the blob for 11Labs
      const blob = await response.blob();
      const textResponse = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blob);
      });

      // Process the text stream
      const lines = textResponse.split('\n');
      let audioBytes = "";

      for (const line of lines) {
        if (line.trim()) {
          try {
            const responseDict = JSON.parse(line);
            if (responseDict.audio_base64) {
              const audioBytesChunk = atob(responseDict.audio_base64);
              audioBytes += audioBytesChunk;
            }
          } catch (e) {
            console.error('Error parsing JSON line:', e);
          }
        }
      }

      // Convert accumulated audioBytes to Uint8Array
      const byteArray = new Uint8Array(audioBytes.length);
      for (let i = 0; i < audioBytes.length; i++) {
        byteArray[i] = audioBytes.charCodeAt(i);
      }

      const fileUri = FileSystem.documentDirectory + `temp_audio_${word}.mp3`;
      await FileSystem.writeAsStringAsync(
        fileUri,
        btoa(String.fromCharCode(...byteArray)),
        { encoding: FileSystem.EncodingType.Base64 }
      );

      setAudioUrl(fileUri);
      playAudio(fileUri);
    } catch (error) {
      console.error("Error fetching audio:", error);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const playAudio = async (audioUrl: string) => {
    try {
      await audioPlayerService.playSound(
        audioUrl,
        null,
        word,
        false,
        "off",
        word,
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlayingAudio(false);
          }
        }
      );
      setIsPlayingAudio(true);
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsPlayingAudio(false);
    }
  };

  // Add these helper functions after the VocabWordModal component definition
  const handleAddExample = async (example: Example, flashcardService: FlashcardService | null, language: string) => {
    if (!flashcardService) return;
    
    const itemKey = `${example.source}-${example.translation}`;
    
    try {
      setAddingItems(prev => ({ ...prev, [itemKey]: true }));
      
      await flashcardService.addFlashcard({
        front: example.source,
        back: example.translation,
        language: language === 'it' ? 'italian' : language,
        flashcard_type: 'sentence',
        tags: ['sentence'] // Add sentence tag
      });
      
      setAddedItems(prev => ({ ...prev, [itemKey]: true }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Error adding example to vocabulary:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAddingItems(prev => ({ ...prev, [itemKey]: false }));
    }
  };

  const handleTranslateContext = async () => {
    if (!token || !contextSentence || isLoadingContext) return;
    
    setIsLoadingContext(true);
    setError(null);
    try {
      const response = await fetch('https://translation-worker.lythamlabs.workers.dev', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sentence: contextSentence,
          language: language,
          target_language: targetLanguage,
          translation_type: 'sentence'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch translation');
      }

      const data = await response.json();
      setContextTranslation(data.translation);
      setShowContext(true);
    } catch (err) {
      console.error('Error fetching context translation:', err);
      setError('Unable to load translation. Please try again.');
    } finally {
      setIsLoadingContext(false);
    }
  };

  const handleAddContextSentence = async () => {
    if (!flashcardService || !contextSentence || !contextTranslation) return;
    
    const itemKey = `${contextSentence}-${contextTranslation}`;
    
    try {
      setAddingItems(prev => ({ ...prev, [itemKey]: true }));
      
      await flashcardService.addFlashcard({
        front: contextSentence,
        back: contextTranslation,
        language: language || '',
        flashcard_type: 'sentence',
        tags: ['sentence'] // Add sentence tag
      });
      
      setAddedItems(prev => ({ ...prev, [itemKey]: true }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Error adding sentence to vocabulary:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAddingItems(prev => ({ ...prev, [itemKey]: false }));
    }
  };

  // Update handleAddSimilarWord
  const handleAddSimilarWord = async (similar: Example) => {
    if (!flashcardService) return;
    
    const itemKey = `${similar.source}-${similar.translation}`;
    
    try {
      setAddingItems(prev => ({ ...prev, [itemKey]: true }));
      
      await flashcardService.addFlashcard({
        front: similar.source,
        back: similar.translation,
        language: language || '',
        flashcard_type: 'word',
        tags: [] // Remove tags for words
      });
      
      // Call onWordSaved to add similar word to chat data
      if (onWordSaved) {
        onWordSaved(similar.source, similar.translation);
      }
      
      setAddedItems(prev => ({ ...prev, [itemKey]: true }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Error adding similar word to vocabulary:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAddingItems(prev => ({ ...prev, [itemKey]: false }));
    }
  };

  // Update handleAddPhrase
  const handleAddPhrase = async (phrase: Phrase) => {
    if (!flashcardService) return;
    
    const itemKey = `${phrase.source}-${phrase.translation}`;
    
    try {
      setAddingItems(prev => ({ ...prev, [itemKey]: true }));
      
      await flashcardService.addFlashcard({
        front: phrase.source,
        back: phrase.translation,
        language: language || '',
        flashcard_type: 'sentence',
        tags: ['phrase'] // Add phrase tag
      });
      
      // Call onWordSaved to add phrase to chat data
      if (onWordSaved) {
        onWordSaved(phrase.source, phrase.translation);
      }
      
      setAddedItems(prev => ({ ...prev, [itemKey]: true }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Error adding phrase to vocabulary:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAddingItems(prev => ({ ...prev, [itemKey]: false }));
    }
  };

  const handleTranslateInfinitive = async () => {
    if (!token || !wordInfo?.lemma || isLoadingInfinitive) return;
    
    setIsLoadingInfinitive(true);
    setError(null);
    try {
      const response = await fetch('https://translation-worker.lythamlabs.workers.dev', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          word: wordInfo.lemma,
          language: language,
          target_language: targetLanguage,
          translation_type: 'multiple',
          is_infinitive: true
        }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data = await response.json();
      // Fix the formatting to extract just the translation string
      const formattedTranslations = data.translations.map((t: { translation: string }) => ({
        source: wordInfo.lemma,
        translation: t.translation
      }));
      setInfinitiveTranslations(formattedTranslations);
      setShowInfinitive(true);
    } catch (error) {
      console.error('Error fetching infinitive translations:', error);
    } finally {
      setIsLoadingInfinitive(false);
    }
  };

  // Update handleAddInfinitive
  const handleAddInfinitive = async (translation: Translation) => {
    if (!flashcardService) return;

    const itemKey = `${translation.source}-${translation.translation}`;

    try {
      setAddingItems(prev => ({ ...prev, [itemKey]: true }));

      await flashcardService.addFlashcard({
        front: translation.source,
        back: translation.translation,
        language: language || '',
        flashcard_type: 'word',
        tags: [] // Remove tags for words
      });

      // Call onWordSaved to add infinitive to chat data
      if (onWordSaved) {
        onWordSaved(translation.source, translation.translation);
      }

      setAddedItems(prev => ({ ...prev, [itemKey]: true }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Error adding infinitive to vocabulary:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAddingItems(prev => ({ ...prev, [itemKey]: false }));
    }
  };

  // Update handleAddAllTranslations
  const handleAddAllTranslations = async () => {
    if (!flashcardService || !word || multipleTranslations.length === 0 || !language) return;

    const translations = multipleTranslations.map(t => t.translation).join(' / ');
    const itemKey = `${word}-${translations}`;

    try {
      setAddingItems(prev => ({ ...prev, [itemKey]: true }));

      await flashcardService.addFlashcard({
        front: word,
        back: translations,
        language: language,
        flashcard_type: 'word'
      });

      // Call onWordSaved to add the combined translations to chat data
      if (onWordSaved) {
        onWordSaved(word, translations);
      }

      setAddedItems(prev => ({ ...prev, [itemKey]: true }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Error adding all translations to vocabulary:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAddingItems(prev => ({ ...prev, [itemKey]: false }));
    }
  };

  const renderSection = (
    title: string, 
    isLoading: boolean, 
    content: React.ReactNode, 
    onPress: () => void,
    sectionKey: 'context' | 'examples' | 'similar' | 'phrases' | 'infinitive' | 'multiple' | 'definition'
  ) => {
    // Check if we already have data for this section
    const hasData = () => {
      switch (sectionKey) {
        case 'context':
          return !!contextTranslation;
        case 'examples':
          return examples.length > 0;
        case 'similar':
          return similarWords.length > 0;
        case 'phrases':
          return phrases.length > 0;
        case 'infinitive':
          return infinitiveTranslations.length > 0;
        case 'multiple':
          return multipleTranslations.length > 0;
        case 'definition':
          return !!definition;
        default:
          return false;
      }
    };

    return (
      <View className="mb-4">
        <Pressable 
          onPress={() => {
            if (!isLoading) {
              if (expandedSections[sectionKey]) {
                // Just collapse the section
                setExpandedSections(prev => ({ ...prev, [sectionKey]: false }));
              } else {
                // Only fetch if we don't have data yet
                if (!hasData()) {
                  onPress();
                }
                setExpandedSections(prev => ({ ...prev, [sectionKey]: true }));
              }
            }
          }}
          className="py-2"
        >
          <View className="flex-row items-center justify-between">
            <Text 
              style={[getFontStyle('textLg'), { fontFamily: 'Lato-Bold' }]}
              className={`${colorScheme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              {title}
            </Text>
            {isLoading && <ActivityIndicator size="small" color={colorScheme === 'dark' ? '#fff' : '#000'} />}
          </View>
        </Pressable>
        {expandedSections[sectionKey] && content}
      </View>
    );
  };

  const renderExampleItem = (item: Example, index: number) => {
    const itemKey = `${item.source}-${item.translation}`;
    const isAdding = addingItems[itemKey];
    const isAdded = addedItems[itemKey];

    return (
      <View key={index} className="mb-4 last:mb-0">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-3 mb-3">
            <Text 
              style={getFontStyle('textLg')}
              className={`${colorScheme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}
            >
              {item.source}
            </Text>
            <Text 
              style={getFontStyle('textMd')}
              className={`mt-1 ${colorScheme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
            >
              {item.translation}
            </Text>
          </View>
          {isAdded ? (
            <View className="bg-green-500/80 p-2 rounded-lg">
              <FontAwesomeIcon icon={faCheck} size={getIconSize(16)} color="#fff" />
            </View>
          ) : (
            <Pressable 
              onPress={() => handleAddExample(item, flashcardService, language || '')} 
              className={`${isAdding ? 'bg-gray-400' : 'bg-[#FC5D5D]/80'} p-2 rounded-lg`}
              disabled={isAdding}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <FontAwesomeIcon icon={faPlus} size={getIconSize(16)} color="#fff" />
              )}
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  useEffect(() => {
    if (processedRubySegments) {
      console.log('******VocabWordModal******  processed ruby segments', processedRubySegments);
    }
  }, [processedRubySegments]);

  return (
    <SlidingModal 
      visible={visible} 
      onClose={handleClose}
      isClosing={isClosing}
    >
      <View className="flex-1">
        {/* Header with word and audio */}
        <View className={`px-5 pt-6 pb-4 border-b ${colorScheme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
          <View className="flex-row items-center mb-2">
            <View className="flex-row flex-wrap justify-center">
              {/* add Segment rendering for Japanese and Chinese if ReadingAidService has pronunciation characters */}
              { processedRubySegments && processedRubySegments.length > 0 ? (
                processedRubySegments.map((segment: PressableSegment, pressableSegmentIndex: number) => {
                    return (
                      <VocabModalSegment 
                        key={`${pressableSegmentIndex}`}
                        segment={segment} 
                        pressableSegmentIndex={pressableSegmentIndex}
                      />
                    )
                  })
                ): (
                <Text 
                  style={[getFontStyle('text2Xl'), { fontFamily: 'Lato-Bold' }]}
                  className={`tracking-tight ${colorScheme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                >
                  {cleanWord}
                </Text>
              )}
              
              {/* Display gender for nouns */}
              {wordInfo?.explain === 'noun' && wordInfo.gender && (
                <Text 
                  style={getFontStyle('textLg')}
                  className={`ml-2 ${colorScheme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
                >
                  ({wordInfo.gender === 'Masculine' ? 'nm' :
                     wordInfo.gender === 'Feminine' ? 'nf' :
                     wordInfo.gender === 'Neuter' ? 'nn' : ''})
                </Text>
              )}
            </View>
          </View>
          {translation && (
            <Text 
              style={getFontStyle('textLg')}
              className={`mt-1 ${colorScheme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
            >
              {translation}
            </Text>
          )}
        </View>

        {/* Content sections - only show if not a phrase */}
        {!isPhrase && (
          <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
            {/* Meanings section */}
            {renderSection(
              wordInfo?.pos === 'Verb' || wordInfo?.pos === 'Auxiliary'
                ? (wordInfo?.lemma?.toLowerCase() === word.toLowerCase() ? 'All Meanings' : `Translate '${wordInfo?.lemma}'`)
                : 'All Meanings',
              wordInfo?.pos === 'Verb' || wordInfo?.pos === 'Auxiliary'
                ? isLoadingInfinitive
                : isLoadingMultiple,
              (wordInfo?.pos === 'Verb' || wordInfo?.pos === 'Auxiliary'
                ? (showInfinitive && infinitiveTranslations.length > 0)
                : (showMultiple && multipleTranslations.length > 0)) && (
                <View className="mt-2">
                  {(wordInfo?.pos === 'Verb' || wordInfo?.pos === 'Auxiliary'
                    ? infinitiveTranslations
                    : multipleTranslations).map((translation, index) => (
                    <View key={index} className="mb-4 last:mb-0">
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1 mr-3 mb-3">
                          <Text 
                            style={getFontStyle('textLg')}
                            className={`${index !== infinitiveTranslations.length - 1 ? 'mb-6' : 'mb-2'} ${colorScheme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}
                          >
                            {translation.translation}
                          </Text>
                        </View>
                        {addedItems[`${translation.source}-${translation.translation}`] ? (
                          <View className="bg-green-500/80 p-2 rounded-lg">
                            <FontAwesomeIcon icon={faCheck} size={getIconSize(16)} color="#fff" />
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => handleAddInfinitive(translation)}
                            className={`${addingItems[`${translation.source}-${translation.translation}`] ? 'bg-gray-400' : 'bg-[#FC5D5D]/80'} p-2 rounded-lg`}
                            disabled={addingItems[`${translation.source}-${translation.translation}`]}
                          >
                            {addingItems[`${translation.source}-${translation.translation}`] ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <FontAwesomeIcon icon={faPlus} size={getIconSize(16)} color="#fff" />
                            )}
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ))}
                  {/* Add "Save all in one flashcard" button */}
                  {(multipleTranslations.length > 1) && (
                    <View className="mt-1 pt-2">
                      <Pressable
                        onPress={handleAddAllTranslations}
                        className={`flex-row justify-center items-center p-2 rounded-lg ${
                          addingItems[`${word}-${multipleTranslations.map(t => t.translation).join(' / ')}`]
                            ? 'bg-gray-400'
                            : addedItems[`${word}-${multipleTranslations.map(t => t.translation).join(' / ')}`]
                            ? 'bg-green-500/80'
                            : 'bg-[#FC5D5D]/80'
                        }`}
                        disabled={addingItems[`${word}-${multipleTranslations.map(t => t.translation).join(' / ')}`] ||
                                addedItems[`${word}-${multipleTranslations.map(t => t.translation).join(' / ')}`]}
                      >
                        {addingItems[`${word}-${multipleTranslations.map(t => t.translation).join(' / ')}`] ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : addedItems[`${word}-${multipleTranslations.map(t => t.translation).join(' / ')}`] ? (
                          <FontAwesomeIcon icon={faCheck} size={getIconSize(16)} color="#fff" />
                        ) : (
                          <>
                            <Text 
                              style={getFontStyle('textMd')}
                              className="text-white font-medium"
                            >
                              Save all in one flashcard
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  )}
                </View>
              ),
              wordInfo?.pos === 'Verb' || wordInfo?.pos === 'Auxiliary'
                ? handleTranslateInfinitive
                : handleAllMeanings,
              'examples'
            )}

            {/* Translation section */}
            {!translation && renderSection(
              'Translation',
              isLoadingTranslation,
              null,
              handleFetchTranslation,
              'examples'
            )}

            {/* Context Sentence section */}
            {contextSentence && renderSection(
              'Translate Sentence',
              isLoadingContext,
              <View className="mt-2">
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 mr-3 render">
                    <Text 
                      style={getFontStyle('textLg')}
                      className={`${colorScheme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}
                    >
                      {contextSentence}
                    </Text>
                    {contextTranslation && (
                      <Text 
                        style={getFontStyle('textMd')}
                        className={`mt-1 ${colorScheme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
                      >
                        {contextTranslation}
                      </Text>
                    )}
                  </View>
                  {contextTranslation && (
                    <>
                      {addedItems[`${contextSentence}-${contextTranslation}`] ? (
                        <View className="bg-green-500/80 p-2 rounded-lg">
                          <FontAwesomeIcon icon={faCheck} size={getIconSize(16)} color="#fff" />
                        </View>
                      ) : (
                        <Pressable 
                          onPress={handleAddContextSentence}
                          className={`${addingItems[`${contextSentence}-${contextTranslation}`] ? 'bg-gray-400' : 'bg-[#FC5D5D]/80'} p-2 rounded-lg`}
                          disabled={addingItems[`${contextSentence}-${contextTranslation}`]}
                        >
                          {addingItems[`${contextSentence}-${contextTranslation}`] ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <FontAwesomeIcon icon={faPlus} size={getIconSize(16)} color="#fff" />
                          )}
                        </Pressable>
                      )}
                    </>
                  )}
                </View>
              </View>,
              handleTranslateContext,
              'context'
            )}

            {/* Examples section */}
            {renderSection(
              'Usage Examples',
              isLoadingExamples,
              showExamples && examples.length > 0 && (
                <View className="mt-2">
                  {examples.map((example, index) => renderExampleItem(example, index))}
                </View>
              ),
              handleFetchExamples,
              'examples'
            )}

            {/* Similar words section */}
            {renderSection(
              'Similar Words',
              isLoadingSimilar,
              showSimilar && similarWords.length > 0 && (
                <View className="mt-2">
                  {similarWords.map((similar, index) => (
                    <View key={index} className="mb-4 last:mb-0">
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1 mr-3 mb-3">
                          <Text 
                            style={getFontStyle('textLg')}
                            className={`${colorScheme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}
                          >
                            {similar.source}
                          </Text>
                          <Text 
                            style={getFontStyle('textMd')}
                            className={`mt-1 ${colorScheme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
                          >
                            {similar.translation}
                          </Text>
                        </View>
                        {addedItems[`${similar.source}-${similar.translation}`] ? (
                          <View className="bg-green-500/80 p-2 rounded-lg">
                            <FontAwesomeIcon icon={faCheck} size={getIconSize(16)} color="#fff" />
                          </View>
                        ) : (
                          <Pressable 
                            onPress={() => handleAddSimilarWord(similar)}
                            className={`${addingItems[`${similar.source}-${similar.translation}`] ? 'bg-gray-400' : 'bg-[#FC5D5D]/80'} p-2 rounded-lg`}
                            disabled={addingItems[`${similar.source}-${similar.translation}`]}
                          >
                            {addingItems[`${similar.source}-${similar.translation}`] ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <FontAwesomeIcon icon={faPlus} size={getIconSize(16)} color="#fff" />
                            )}
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ),
              handleFetchSimilar,
              'similar'
            )}

            {/* Definition section */}
            {renderSection(
              `Definition in ${capitalizeLanguage(language)}`,
              isLoadingDefinition,
              showDefinition && definition && (
                <View className="mt-2">
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1 mr-3 mb-3">
                      <Text 
                        style={getFontStyle('textLg')}
                        className={`${colorScheme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}
                      >
                        {definition}
                      </Text>
                    </View>
                  </View>
                </View>
              ),
              handleFetchDefinition,
              'definition'
            )}

            {/* Phrases section */}
            {renderSection(
              'Phrases',
              isLoadingPhrases,
              showPhrases && phrases.length > 0 && (
                <View className="mt-2">
                  {phrases.map((phrase, index) => (
                    <View key={index} className="mb-4 last:mb-0">
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1 mr-3 mb-3">
                          <Text 
                            style={getFontStyle('textLg')}
                            className={`${colorScheme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}
                          >
                            {phrase.source}
                          </Text>
                          <Text 
                            style={getFontStyle('textMd')}
                            className={`mt-1 ${colorScheme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
                          >
                            {phrase.translation}
                          </Text>
                        </View>
                        {addedItems[`${phrase.source}-${phrase.translation}`] ? (
                          <View className="bg-green-500/80 p-2 rounded-lg">
                            <FontAwesomeIcon icon={faCheck} size={getIconSize(16)} color="#fff" />
                          </View>
                        ) : (
                          <Pressable 
                            onPress={() => handleAddPhrase(phrase)}
                            className={`${addingItems[`${phrase.source}-${phrase.translation}`] ? 'bg-gray-400' : 'bg-[#FC5D5D]/80'} p-2 rounded-lg`}
                            disabled={addingItems[`${phrase.source}-${phrase.translation}`]}
                          >
                            {addingItems[`${phrase.source}-${phrase.translation}`] ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <FontAwesomeIcon icon={faPlus} size={getIconSize(16)} color="#fff" />
                            )}
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ),
              handleFetchPhrases,
              'phrases'
            )}
          </ScrollView>
        )}

        {/* Bottom action bar */}
        <View className={`flex-row p-2 border-t ${colorScheme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}>
          <View className="flex-row w-full">
            {isSuccess ? (
              <View className="w-2/3 items-center justify-center">
                <Text 
                  style={[getFontStyle('textMd'), { fontFamily: 'Lato-Bold' }]}
                  className="text-[#FC5D5D]/80"
                >
                  Added to vocabulary!
                </Text>
              </View>
            ) : (
              <View className="w-2/3 pr-2">
                <Pressable 
                  className={`flex-row items-center justify-center dark:bg-[#FC5D5D]/75 bg-[#FC5D5D]/80 p-4 rounded-xl ${(isLoading || isLoadingTranslation) ? 'opacity-70' : ''}`}
                  onPress={handleAddToVocab}
                  disabled={isLoading || isLoadingTranslation}
                >
                  {(isLoading || isLoadingTranslation) ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faPlus} size={getIconSize(18)} color="#fff" />
                      <Text 
                        style={[getFontStyle('textMd'), { fontFamily: 'Lato-Bold' }]}
                        className="text-white ml-2"
                      >
                        Add to Vocabulary
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
            <View className="w-1/3 items-center justify-center bg-[#767778]/50 rounded-xl">
              <Pressable 
                onPress={handlePlayAudio}
                disabled={isPlayingAudio}
              >
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                  <FontAwesomeIcon 
                    icon={faVolumeUp} 
                    size={getIconSize(30)} 
                    color={isPlayingAudio ? '#fff' : '#fff'} 
                  />
                </Animated.View>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </SlidingModal>
  );
}
