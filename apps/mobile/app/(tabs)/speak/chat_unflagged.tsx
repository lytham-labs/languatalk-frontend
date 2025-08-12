import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Modal, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, TouchableOpacity, Linking } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter, Stack, useNavigation, useFocusEffect } from 'expo-router';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faEllipsisVertical, faChevronLeft, } from '@fortawesome/free-solid-svg-icons';
import { faTriangleExclamation } from '@fortawesome/pro-solid-svg-icons';
import cx from 'classnames';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/constants/api';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import AudioPlayerService from '@/services/AudioPlayerService';
import { AlternativeResponseService } from '@/services/AlternativeResponseService';
import { TextCorrectionService } from '@/services/TextCorrectionService';
import { CorrectionExplanationService } from '@/services/CorrectionExplanationService';
import { SuggestedReplyService } from '@/services/SuggestedReplyService';
import { GuidedModeReplyService } from '@/services/GuidedModeReplyService';
import GuidedModeReplyModal from '@/components/speak/GuidedModeReplyModal';
import * as Haptics from 'expo-haptics';
import SuggestedRepliesModal from '@/components/SuggestedRepliesModal';
import ChatSettingsModal from '@/components/ChatSettingsModal';
import EndChatModal from '@/components/EndChatModal';
import { useWebSocket } from '@/contexts/ActionCableWebSocketContext';
import { GlobalFontStyleSheet, getIconSize } from '@/constants/Font';
import useDevice from '@/hooks/useDevice';
import ChatInputBar from '@/components/speak/ChatInputBar';
import LoadingDots from '@/components/LoadingDots';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';

import CorrectionModal from '@/components/speak/CorrectionModal';
import AlternativeResponseModal from '@/components/speak/AlternativeResponseModal';
import VocabWordModal from '@/components/speak/VocabWordModal';
import LimitReachedModal from '@/components/pricing/LimitReachedModal';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import MicrophonePermissionRequest from '@/components/speak/MicrophonePermissionRequest';
import { getTranscriptionModel } from '@/constants/TranscriptionOptions';
import TranslationModal from '@/components/speak/TranslationModal'; // Import TranslationModal
import UserPointsModal from '@/components/speak/UserPointsModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { openHelpScout } from '@/components/helpscout';
import useUserSettings from '@/services/api/useUserSettings';
import useUserSubscription from '@/services/api/useUserSubscription';
import { storeAudioUri } from '@/services/AsyncAudioStorageService';
import VoiceRecognition from '@/components/speak/VoiceRecognition';
import { AUTO_SEND_THRESHOLD } from '@/constants/Lists';
import { useFeatureFlag } from 'posthog-react-native';
import AudioRecorder, { AudioRecorderHandle } from '@/components/speak/AudioRecorder';
import BouncingDots from '@/components/BouncingDots';
import { ChatData, Message } from '@/types/chat';
// flagged chat items
import { MessageItemUnflagged as MessageItem } from '@/components/speak/MessageItem_unflagged';
import { usePollingUnflagged as usePolling } from '@/hooks/usePolling_unflagged';

import { ChatWordsService } from '@/services/ChatWordsService';
import { hasExceededCallLimit } from '@/services/CallTimeService';
import CallModeLimitReachedModal from '@/components/pricing/CallModeLimitReachedModal';

const triggerHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

interface PendingUserAudio {
  audioUri: string;
  timestamp: number;
}

interface PendingAssistantMessage {
  audio?: {
    audioUri: string;
    wordTimings: any;
  };
  message?: Message;
}

const { isTablet, isPhone } = useDevice();

function useConditionalKeepAwake(shouldKeepAwake: boolean) {
  const tag = 'chat_recording';
  
  useEffect(() => {
    if (shouldKeepAwake) {
      activateKeepAwakeAsync(tag);

      return () => {
        deactivateKeepAwake(tag);
      };
    }
  }, [shouldKeepAwake]);
}

// Add these helper functions at the top level
const STORAGE_KEY_PREFIX = 'chat_message_count_';
const LAST_SHOWN_DATE_KEY = 'lastPointsModalDate';


export default function UnflaggedChatScreen() {
  const navigation = useNavigation();
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { token, user } = useAuth();
  const { subscriptionInfo, loading: subscriptionLoading } = useUserSubscription();
  const { chatId, initialData } = useLocalSearchParams();
  const [chatData, setChatData] = useState<ChatData | null>(initialData ? JSON.parse(initialData as string) : null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(!initialData);
  const [sending, setSending] = useState(false);
  const [selectedSentence, setSelectedSentence] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playingSlowAudioId, setPlayingSlowAudioId] = useState<string | null>(null);
  const audioPlayerService = useRef(new AudioPlayerService()).current;
  const audioChunksRef = useRef<string[]>([]);
  const wordTimingsRef = useRef<any>(null);
  const [currentPlayingMessageId, setCurrentPlayingMessageId] = useState<string | null>(null);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const pendingAssistantMessagesRef = useRef<Record<string, PendingAssistantMessage>>({});
  const [showLimitReachedUpgrade, setShowLimitReachedUpgrade] = useState(false);
  const [dismissedUpgradeModal, setDismissedUpgradeModal] = useState(false);
  const playedAudioMessagesRef = useRef<Set<string>>(new Set());
  const MAX_PLAYED_AUDIO_MESSAGES = 100;

  // Helper function to add to playedAudioMessagesRef with cleanup
  const addPlayedAudioMessage = (messageId: string) => {
    playedAudioMessagesRef.current.add(messageId);
    
    // Clean up if we exceed the limit
    if (playedAudioMessagesRef.current.size > MAX_PLAYED_AUDIO_MESSAGES) {
      const entries = Array.from(playedAudioMessagesRef.current);
      // Keep only the most recent messages
      playedAudioMessagesRef.current = new Set(entries.slice(-MAX_PLAYED_AUDIO_MESSAGES));
      console.log('[UNFLAGGED] Cleaned up playedAudioMessagesRef to', MAX_PLAYED_AUDIO_MESSAGES, 'entries');
    }
  };

  // Remove the recording state, only keep isRecording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const isLongPressRef = useRef(false);

  const textCorrectionService = new TextCorrectionService(token ?? '');
  const correctionExplanationService = new CorrectionExplanationService(token ?? '');
  const alternativeResponseService = new AlternativeResponseService(token ?? '');
  const suggestedReplyService = new SuggestedReplyService(token ?? ''); // Initialize the service
  const guidedModeReplyService = new GuidedModeReplyService(token ?? '');
  const chatWordsService = new ChatWordsService(token ?? ''); // Initialize the ChatWordsService

  const [isSuggestionsModalVisible, setIsSuggestionsModalVisible] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggestReplyPulsing, setIsSuggestReplyPulsing] = useState(false);

  const [isGuidedModeReplyVisible, setIsGuidedModeReplyVisible] = useState(false);
  const [guidedModeReply, setGuidedModeReply] = useState<{
    suggestion: string;
    translation: string;
  } | null>(null);
  const [isGuidedModeReplyLoading, setIsGuidedModeReplyLoading] = useState(false);
  const [isGuidedModeReplyLoadingTimeout, setIsGuidedModeReplyLoadingTimeout] = useState(false);
  
  const autoRecordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAddedMessageIdRef = useRef<string | null>(null);

  const autoRecordRef = useRef(false);
  const autoSendRef = useRef(false);
  const autoSendThresholdRef = useRef(AUTO_SEND_THRESHOLD.normal);
  const autoCorrectRef = useRef<boolean>(false);
  const guidedModeRef = useRef<boolean>(false);
  const autoTranslateRef = useRef<string>('off');
  const highlightModeRef = useRef('word');
  const transcriptionModeRef = useRef('v1');
  const transcriptionModelRef = useRef('whisper-1');
  const isInitializedRef = useRef(false);
  const lastMessageRef = useRef<{
    messageId: string;
    messageText: string;
  } | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showEndChatModal, setShowEndChatModal] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { connectWebSocket, closeWebSocket, closeAllWebSockets, onMessage, removeMessageListener, connectionStatus, retryCount, isConnected, waitForConnection } = useWebSocket();

  // Add new state for correction modal
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [selectedMessageForCorrection, setSelectedMessageForCorrection] = useState<Message | null>(null);

  // Add new state for correction loading
  const [isCorrectionLoading, setIsCorrectionLoading] = useState(false);

  // Add new state for alternative response modal
  const [showAlternativeModal, setShowAlternativeModal] = useState(false);
  const [selectedMessageForAlternative, setSelectedMessageForAlternative] = useState<Message | null>(null);
  const [isAlternativeLoading, setIsAlternativeLoading] = useState(false);
  // Add state for error type
  const [microphoneErrorType, setMicrophoneErrorType] = useState<'permission' | 'initialization' | 'connection' | 'generic'>('permission');

  // Add this with other state declarations at the top of ChatScreen
  const [showPermissionRequest, setShowPermissionRequest] = useState(false);
  const [showCallTimeLimitModal, setShowCallTimeLimitModal] = useState(false);

  const [isTranslationModalVisible, setIsTranslationModalVisible] = useState(false);
  const [currentTranslation, setCurrentTranslation] = useState<string | null>(null);
  const [currentOriginalText, setCurrentOriginalText] = useState<string | null>(null);

  // Add this state to track if the input has text
  const [hasText, setHasText] = useState(false);

  const [showPointsModal, setShowPointsModal] = useState(false);
  const messageCountRef = useRef(0);
  const userMessageCountRef = useRef<{[chatId: string]: number}>({});
  const hasShownTodayRef = useRef(false);
  const resumeAudioRef = useRef(true);

  // Add this state to track if we should delay the AI response
  const [delayAIResponse, setDelayAIResponse] = useState(false);
  const pendingAIResponseRef = useRef<Message | null>(null);

  // Add this state to track the currently playing message
  const [previousPlayingMessage, setPreviousPlayingMessage] = useState<{
    messageId: string;
    audioUrl: string;
    wordTimings: any;
    text: string;
    wasPlaying: boolean;
  } | null>(null);


  // Add this ref near other refs
  const willShowModalRef = useRef(false);

  // Add this ref to track if any modal is open
  const isModalOpenRef = useRef(false);
  
  // Add this ref to queue pending AI messages
  const pendingAudioMessagesRef = useRef<Message[]>([]);

  const { userSettings } = useUserSettings();

  const [pendingUserAudio, setPendingUserAudio] = useState<PendingUserAudio | null>(null);
  const pendingUserAudioRef = useRef<PendingUserAudio | null>(null);  // Add this ref

  const voiceRecognitionRef = useRef<any>(null);
  const useNewVADSystem = useFeatureFlag('new_auto_send_logic') && Platform.OS === 'ios';
  useConditionalKeepAwake(isRecording);
  const useTranscriptionCloudflareWorker = useFeatureFlag('use_transcription_cloudflare_worker');
  const usePollingSystem = useFeatureFlag('use_polling');

  const chatMessageIds = useRef<string[]>([]);
  // Add this constant for the storage key prefix
  const POINTS_MODAL_KEY_PREFIX = 'pointsModalShown_';

  // Add these functions to persist and retrieve message counts
  const saveMessageCount = async (chatId: string, count: number) => {
    try {
      if (!userSettings?.user?.id) {
        return;
      }

      await AsyncStorage.setItem(
        `${STORAGE_KEY_PREFIX}${userSettings.user.id}_${chatId}`,
        count.toString()
      );
    } catch (error) {
      console.error('Error saving message count:', error);
    }
  };

  const loadMessageCount = async (chatId: string) => {
    try {
      if (!userSettings?.user?.id) {
        return 0;
      }

      const count = await AsyncStorage.getItem(
        `${STORAGE_KEY_PREFIX}${userSettings.user.id}_${chatId}`
      );
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      console.error('Error loading message count:', error);
      return 0;
    }
  };

  // Add this helper function to reset all message counts
  const resetAllMessageCounts = async () => {
    try {
      if (!userSettings?.user?.id) {
        return;
      }

      const keys = await AsyncStorage.getAllKeys();
      const userMessageCountKeys = keys.filter(
        key => key.startsWith(STORAGE_KEY_PREFIX) && 
        key.includes(`_${userSettings.user.id}_`)
      );
      
      // Reset all message counts in AsyncStorage and in memory
      for (const key of userMessageCountKeys) {
        await AsyncStorage.removeItem(key);
      }
      
      console.log('Reset all message counts for user:', userSettings.user.id);
    } catch (error) {
      console.error('Error resetting message counts:', error);
      }
    };

  useEffect( () => {
    if (chatData?.message_limit_reached && !dismissedUpgradeModal && !showLimitReachedUpgrade && !subscriptionLoading) {
      handleShowUpgradeModal();
    }
  }, [chatData?.message_limit_reached, subscriptionLoading])

  // Update error message based on connection status with delay
  useEffect(() => {
    if (chatData?.chat.id) {
      const status = connectionStatus[chatData.chat.id];

      // Clear any existing timeout
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }

      switch (status) {
        case 'disconnected':
          // Only show error message if we've exhausted all retry attempts
          if (retryCount[chatData.chat.id] >= 3) {
            errorTimeoutRef.current = setTimeout(() => {
              setErrorMessage('Connection lost. Please check your network connection and try again.');
            }, 300);
          }
          break;
        case 'error':
          if (retryCount[chatData.chat.id] >= 3) {
            errorTimeoutRef.current = setTimeout(() => {
              setErrorMessage('Connection error. Please check your network connection.');
            }, 300);
          }
          break;
        case 'connected':
          setErrorMessage(prev =>
            prev?.includes('Connection') || prev?.includes('connection') ? null : prev
          );
          break;
      }

      return () => {
        if (errorTimeoutRef.current) {
          clearTimeout(errorTimeoutRef.current);
          errorTimeoutRef.current = null;
        }
      };
    }
  }, [connectionStatus, chatData?.chat.id, retryCount]);

  // Effect to initialize refs only when chatData is first loaded
  useEffect(() => {
    if (chatData?.chat && !isInitializedRef.current) {
      autoRecordRef.current = chatData.chat.auto_record || false;
      autoSendRef.current = chatData.chat.auto_send || false;
      autoSendThresholdRef.current = chatData.chat.auto_send_threshold || AUTO_SEND_THRESHOLD.normal;
      autoCorrectRef.current = chatData.chat.auto_correct || false;
      guidedModeRef.current = chatData.chat.guided_mode || false;
      autoTranslateRef.current = chatData.chat.auto_translate || 'off';
      transcriptionModeRef.current = chatData.chat.transcription_mode || 'v1';
      transcriptionModelRef.current = determineModel(chatData.chat.transcription_mode || 'whisper-1');
      highlightModeRef.current = chatData.chat.highlight_mode || 'word';
      isInitializedRef.current = true;
    }
  }, [chatData]);

  useEffect(() => {
    // Subscribe to event when component mounts
    audioPlayerService.on('firstPlaybackFinished', handleFirstPlaybackFinished);

    return () => {
      audioPlayerService.off('firstPlaybackFinished', handleFirstPlaybackFinished);
      if (autoRecordTimeoutRef.current) {
        clearTimeout(autoRecordTimeoutRef.current);
      }
    };
  }, []);

  const handleFirstPlaybackFinished = useCallback((chatMessageId: string) => {
    if (chatMessageId === lastAddedMessageIdRef.current) {
      handleAutoRecord();
    }
  }, []);
   
  // Move cleanup into a separate useEffect for screen unmount
  useEffect(() => {
    return () => {
      console.log('Screen unmounted - cleaning up...');
      if (isRecording) {
        cancelRecording();
      }

      if (audioPlayerService.isPlaying) {
        audioPlayerService.stopSound();
        setCurrentPlayingMessageId(null);
        setPlayingSlowAudioId(null);
      }

      closeAllWebSockets();
    };
  }, []); // Empty dependency array means this only runs on unmount

  // Use useFocusEffect only for focus/blur handling
  useFocusEffect(
    useCallback(() => {
      const onFocus = () => {
        // Handle any setup needed when screen gains focus
        console.log('Screen focused');
      };

      const onBlur = () => {
        // Handle cleanup only when navigating away
        console.log('Screen lost focus');
        audioPlayerService.stopSound();
        setCurrentPlayingMessageId(null);
        setPlayingSlowAudioId(null);
        closeAllWebSockets();
      };

      onFocus(); // Run focus handler immediately

      return onBlur; // This runs when screen loses focus
    }, [])
  );

  const handleAutoRecord = () => {
    if (autoRecordRef.current) {
      // Clear any existing timeout
      if (autoRecordTimeoutRef.current) {
        clearTimeout(autoRecordTimeoutRef.current);
      }

      // Set a new timeout to start recording after 2 seconds
      autoRecordTimeoutRef.current = setTimeout(() => {
        startRecording();
      }, 500);
    }
  };

  useEffect(() => {
    if (!initialData) {
      setIsWaitingForResponse(false);
      fetchChatData();
    } else {
      setChatData(JSON.parse(initialData as string));
      // Connect WebSocket and set up message handler
      const parsedData = JSON.parse(initialData as string);
      const chatId = parsedData.chat.id;

      // Connect WebSocket if not already connected
      if (!isConnected(chatId)) {
        connectWebSocket(chatId, {
          name: 'ChatChannel',
          params: { chat_id: chatId }
        });
      }

      // Monitor connection status changes
      const checkConnection = setInterval(() => {
        if (!isConnected(chatId)) {
          setErrorMessage('Connection lost.');
        } else if (errorMessage === 'Connection lost.') {
          setErrorMessage('');
        }
      }, 3000);

      if (chatData?.messages.length === 0) {
        waitForConnection(chatId).then(connected => {
          if (connected) {
            sendMessage('Hi');
          }
        });
      }

      const handleWebSocketMessage = (event: MessageEvent) => {
        // Handle both formats - direct data and wrapped in event.data.data
        let messageData = event.data?.data || event.data;
        const messageTypesToIgnore = ['correction', 'correction_explanation', 'alternative_response', 'slow_audio', 'guided_mode', 'suggested_reply', 'translation'];
        if (chatMessageIds.current.includes(messageData.chat_message_id) && !messageTypesToIgnore.includes(messageData.type)) {
          console.log("message already in chatMessageIds", messageData.chat_message_id);
          return;
        }
        // Return early if messageData is not an object
        if (!messageData) return;

        // Return early for ping messages
        if (messageData.type === 'ping') return;

        switch (messageData.type) {
          case 'error':
            setIsWaitingForResponse(false);
            if (messageData.error_type === 'message_limit_reached') {
              setChatData(prevData => ({
                ...prevData!,
                message_limit_reached: true
              }));
            } else {
              setErrorMessage("AI provider error. Try switching AI model & refreshing the page. If errors persist, start a new conversation & check our help doc.");
            }
            break;
          case 'user_chat_message':
            handleChatMessage(messageData.message);
            break;
          case 'translation':
            break;
          case 'suggested_reply':
            displaySuggestions(messageData);
            setIsSuggestReplyPulsing(false);
            break;
          case 'guided_mode':
            setGuidedModeReply({
              suggestion: messageData.suggestion,
              translation: messageData.translation,
            });
            setIsGuidedModeReplyVisible(true);
            setIsGuidedModeReplyLoading(false);
            break;
          case 'correction':
            if (displayCorrection.current) {
              displayCorrection.current(messageData);
            }
            break;
          case 'correction_explanation':
            if (displayCorrectionExplanation.current) {
              displayCorrectionExplanation.current(messageData);
            }
            break;
          case 'alternative_response':
            if (displayAlternativeResponse.current) {
              displayAlternativeResponse.current(messageData);
            }
            break;
          case 'slow_audio':
            handleSlowAudioMessage(messageData);
            break;
          case 'audio':
            handleAudioMessage(messageData);
            break;
          case 'final':
            console.log('[UNFLAGGED] Final audio message received:', messageData.chat_message_id);
            if (!chatMessageIds.current.includes(messageData.chat_message_id)) {                
              if (lastMessageRef.current?.messageText && autoTranslateRef.current === 'written') {
                handleTranslate(lastMessageRef.current?.messageText, lastMessageRef.current?.messageId, messageData.target_language);
              }  

              chatMessageIds.current.push(messageData.chat_message_id);
              handleFinalAudio(messageData);
            }
            else {
              console.log("message already in chatMessageIds", messageData.chat_message_id);
            }
            stopPolling();
            break;
          default:
            if (autoTranslateRef.current === 'written') {
              lastMessageRef.current = {
                messageId: messageData.message.chat_message_id,
                messageText: messageData.message.full_message,
              };
            }
            if (chatData?.chat.mode !== 'text_only') {
              handleChatMessage(messageData.message?.chat_message || messageData.chat_message);
            } else {
              setChatData(prevData => ({
                ...prevData!,
                messages: [...prevData!.messages, messageData.message?.chat_message || messageData.chat_message],
              }));
              setIsWaitingForResponse(false);
            }
        }
      };

      onMessage(chatId, handleWebSocketMessage);
      return () => {
        removeMessageListener(chatId, handleWebSocketMessage);
        clearInterval(checkConnection);
        closeWebSocket(chatId, 'ChatChannel');
        if (autoRecordTimeoutRef.current) {
          clearTimeout(autoRecordTimeoutRef.current);
        }
      };
    }
  }, [initialData]);


  const fetchChatData = async () => {
    if (!chatId) {
      router.replace('/(tabs)/speak');
    }

    try {
      const response = await fetch(`${API_URL}/api/v1/chats/${chatId}`, {
        headers: {
          'Authorization': `${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        if (
          response.status === 403 &&
          typeof data.error === 'string' &&
          data.error.toLowerCase().includes('call limit')
        ) {
          setShowCallTimeLimitModal(true);
          return;
        }
        throw new Error('Failed to fetch chat data');
      }

      const data: ChatData = await response.json();
      setChatData(data);

    } catch (error) {
      console.error('Error fetching chat data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add debounce to prevent multiple rapid sends
  const [isSending, setIsSending] = useState(false);

  // Add new state for tracking message send time - only used when usePollingSystem is true
  const [forcedTimeout, setForcedTimeout] = useState(false);
  const [showIntermediateTimeout, setShowIntermediateTimeout] = useState(false);

  const sendMessage = async (msg?: string) => {
    // Prevent multiple sends while one is in progress
    if (isSending || !chatData) return;
    
    // --- New code added here: Stop any playing audio ---
    if (audioPlayerService.isPlaying) {
      await audioPlayerService.pauseSound();
      setCurrentPlayingMessageId(null);
      setPlayingSlowAudioId(null);
    }
    // -------------------------------------------------------

    const messageToSend = msg || message;
    if (!messageToSend.trim()) return;

    try {
      setIsSending(true);
      setSending(true);
      setIsWaitingForResponse(true);
      
      if (usePollingSystem) {
        setShowResponseTimeout(false);
        setForcedTimeout(false);
        setShowIntermediateTimeout(false);


        // Clear any existing timeout and pending messages
        if (responseTimeoutRef.current) {
          clearTimeout(responseTimeoutRef.current);
        }    

        // Stop any active polling
        if (isPolling) {
          stopPolling();
        }

        // Set a new timeout for response - first 5 seconds just show loading dots
        responseTimeoutRef.current = setTimeout(() => {
          // After 5 seconds, start polling and show intermediate message
          setShowIntermediateTimeout(true);
          startPolling();

          // Set another timeout for the full timeout UI after 5 more seconds
          responseTimeoutRef.current = setTimeout(() => {
            setShowIntermediateTimeout(false);
            setForcedTimeout(true);
            setShowResponseTimeout(true);
            // Stop polling since we're showing the full timeout UI
            stopPolling();

            // Close the websocket when showing the full timeout UI
            if (chatData?.chat.id) {
              closeWebSocket(Number(chatData.chat.id), 'ChatChannel');
            }
          }, 5000); // 5 more seconds
        }, 10000); // First 5 seconds
      }

      // Try to ensure WebSocket connection, but don't return early if failed
      // This way, the user's message remains visible even if connection fails
      if (!await ensureWebSocketConnection()) {
        setErrorMessage('Please wait for connection to be established...');
        return;
      }

      const response = await fetch(`${API_URL}/api/v1/chats/${chatData.chat.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: messageToSend,
          subtopic: chatData.chat.subtopic_category,
          topic: chatData.chat.topic,
          subtopic_category: chatData.chat.subtopic_category,
          debug: false,
          client_provider: chatData.chat.client_provider,
          model: chatData.chat.model,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setIsWaitingForResponse(false);
    } finally {
      setSending(false);
      setMessage(msg ? '' : '');
      setHasText(false);
      // Add small delay before allowing next send
      setTimeout(() => {
        setIsSending(false);
      }, 1000);
    }
  };

  const handleChatMessage = useCallback((messageData: any) => {
    // Skip initial "Hi" message
    if (messageData.role === 'user' && messageData.content === 'Hi') {
      return;
    }

    // Only process user messages in the current chat
    if (messageData.role === 'user' && chatData?.chat.id) {
      const chatId = chatData.chat.id.toString();
      
      // Check the last shown date first
      hasShownModalToday().then(async ({ shown, isToday }) => {
        if (isToday) {
          userMessageCountRef.current[chatId] = 0;
          await saveMessageCount(chatId, 0);
          return;
        }

        // If not shown today, increment and check count
        const currentCount = (userMessageCountRef.current[chatId] || 0) + 1;
        userMessageCountRef.current[chatId] = currentCount;
        await saveMessageCount(chatId, currentCount);
        console.log('currentCount', currentCount);
        // Show modal at exactly 7 messages
        if (currentCount === 7) {
          // Set the ref BEFORE the async state update
          isModalOpenRef.current = true;
          setShowPointsModal(true);
          setDelayAIResponse(true);
          markModalShownToday();
          hasShownTodayRef.current = true;
          
          // Reset count after showing modal
          userMessageCountRef.current[chatId] = 0;
          await saveMessageCount(chatId, 0);
          return; // Return early to prevent processing the message
        }
      });
    }

    // If modal is open or AI response is delayed, store AI messages for later
    if ((showPointsModal || delayAIResponse) && messageData.role === 'assistant') {
      const newMessage: Message = {
        id: messageData.id,
        role: messageData.role,
        content: messageData.content,
        target_language: messageData.target_language,
        target_language_text: messageData.target_language_text,
        english_text: messageData.english_text,
        correction: messageData.correction,
        correction_explanation: messageData.correction_explanation,
        translation: messageData.translation,
        audio_url: messageData.audio_url,
        slow_audio_url: messageData.slow_audio_url,
        word_timings: messageData.word_timings,
        created_at: messageData.created_at,
        chat_message_id: messageData.chat_message_id,
        hide_text: messageData.hide_text,
        audio_only: messageData.audio_only,
        avatar_url: messageData.avatar_url,
        highlight_mode: messageData.highlight_mode,
      };
      pendingAIResponseRef.current = newMessage;
      return; // Don't process the AI message now
    }

    // Only process messages if modal is not open and AI response is not delayed
    if (!showPointsModal && !delayAIResponse) {
      const newMessage: Message = {
        id: messageData.id,
        role: messageData.role,
        content: messageData.content,
        target_language: messageData.target_language,
        target_language_text: messageData.target_language_text,
        english_text: messageData.english_text,
        correction: messageData.correction,
        correction_explanation: messageData.correction_explanation,
        translation: messageData.translation,
        audio_url: messageData.audio_url,
        slow_audio_url: messageData.slow_audio_url,
        word_timings: messageData.word_timings,
        created_at: messageData.created_at,
        chat_message_id: messageData.chat_message_id,
        hide_text: messageData.hide_text,
        audio_only: messageData.audio_only,
        avatar_url: messageData.avatar_url,
        highlight_mode: messageData.highlight_mode,
      };

      if (newMessage.role === 'user' && pendingUserAudioRef.current) {
        storeAudioUri(newMessage.chat_message_id, pendingUserAudioRef.current.audioUri)
         .catch(error => console.error('Error storing audio URI:', error));

        pendingUserAudioRef.current = null;

        setPendingUserAudio(null);
      }

      if (newMessage.role === 'user' || chatData?.chat.mode === 'text_only') {
        setChatData(prevData => {
          const updatedData = {
            ...prevData!,
            messages: [...prevData!.messages, newMessage],
          };

          // Only trigger auto-correction after the message has been added
          if (newMessage.role === 'user' && autoCorrectRef.current) {
            handleAutoCorrection(newMessage, updatedData);
          }

          return updatedData;
        });
      } else {
        console.log('[UNFLAGGED] Received assistant message:', messageData.chat_message_id, 'has audio:', !!pendingAssistantMessagesRef.current[messageData.chat_message_id]?.audio);
        pendingAssistantMessagesRef.current[messageData.chat_message_id] = {
          ...pendingAssistantMessagesRef.current[messageData.chat_message_id],
          message: newMessage
        };
        checkAndAddAssistantMessage(messageData.chat_message_id);
      }
      // // If it's a user message and auto-correct is enabled, trigger the correction
      // if (newMessage.role === 'user' && autoCorrectRef.current) {
      //   handleAutoCorrection(newMessage, chatData);
      // }
    }
  }, [chatData, showPointsModal, delayAIResponse, checkAndAddAssistantMessage]);

  const handleAutoCorrection = useCallback(async (message: Message, updatedChatData: ChatData) => {
    if (!updatedChatData) return;
  
    try {
      // Find the previous AI message for context
      const messageIndex = updatedChatData.messages.findIndex(msg => msg.chat_message_id === message.chat_message_id);
      const previousMessages = updatedChatData.messages.slice(0, messageIndex).reverse();
      const previousAIMessage = previousMessages.find(msg => msg.role === 'assistant');

      const response = await textCorrectionService.fetchCorrection(
        updatedChatData.chat.id,
        message.chat_message_id,
        message.content,
        updatedChatData.chat.language,
        previousAIMessage?.content || null, // Add immediate previous message as context
        updatedChatData.chat.client_provider,
        updatedChatData.chat.model
      );
      // The correction will be handled by the WebSocket in the `correction` case
    } catch (error) {
      console.error('Error fetching auto-correction:', error);
    }
  }, [textCorrectionService]);

  const handleWordPress = async (word: string, chatMessageId: string, sentence: string, isPhrase: boolean) => {
    triggerHaptic();

    // Store the currently playing message info before stopping it
    if (currentPlayingMessageId) {
      const playingMessage = chatData?.messages.find(
        msg => msg.chat_message_id === currentPlayingMessageId
      );
      if (playingMessage) {
        setPreviousPlayingMessage({
          messageId: playingMessage.chat_message_id,
          audioUrl: playingMessage.audio_url,
          wordTimings: playingMessage.word_timings,
          text: playingMessage.content,
          wasPlaying: audioPlayerService.isPlaying
        });
      }
    }

    // Stop the current audio
    if (audioPlayerService.isPlaying) {
      await audioPlayerService.pauseSound();
      setCurrentPlayingMessageId(null);
    }

    const cleanWord = word.replace(/^[.,!?¿¡;:()《》「」『』（）、。！？]+|[.,!?¿¡;:()《》「」『』（）、。！？]+$/g, '');
    setSelectedVocabWord(cleanWord);
    setSelectedSentence(sentence);
    setIsVocabModalVisible(true);
    setIsPhrase(isPhrase);

    // Cancel recording if active
    if (isRecording) {
      cancelRecording();
    }
  };

  const handleAudioMessage = (message: any) => {
    if (message.audio.normalizedAlignment) {
      wordTimingsRef.current = (() => {
        const prevTimings = wordTimingsRef.current || { chars: [], charStartTimesMs: [], charDurationsMs: [] };
        if (!prevTimings) {
          const initialTimings = message.audio.normalizedAlignment;
          return {
            ...initialTimings,
            charEndTimesMs: initialTimings.charStartTimesMs.map(
              (start: number, index: number) =>
                start + initialTimings.charDurationsMs[index]
            ),
          };
        }

        // Aggregate the new timings with the existing ones
        const newChars = [
          ...prevTimings.chars,
          ...message.audio.normalizedAlignment.chars,
        ];
        const newCharStartTimesMs = [
          ...prevTimings.charStartTimesMs,
          ...message.audio.normalizedAlignment.charStartTimesMs.map(
            (time: number) =>
              time +
              (prevTimings.charStartTimesMs[
                prevTimings.charStartTimesMs.length - 1
              ] || 0)
          ),
        ];
        const newCharDurationsMs = [
          ...prevTimings.charDurationsMs,
          ...message.audio.normalizedAlignment.charDurationsMs,
        ];

        const newCharEndTimesMs = newCharStartTimesMs.map(
          (start: number, index: number) =>
            start + newCharDurationsMs[index]
        );

        return {
          chars: newChars,
          charStartTimesMs: newCharStartTimesMs,
          charEndTimesMs: newCharEndTimesMs,
          charDurationsMs: newCharDurationsMs,
        };
      })();
    }
    if (message.audio.audioType.includes('mp3')) {
      audioChunksRef.current = [...audioChunksRef.current, atob(message.audio.audio)];
      // // Collect base64-encoded audio chunks without decoding
      // audioChunksRef.current.push(message.audio.audio);
    }
  };

  const processWordTimings = (timings: any) => {
    if (!timings) return null;

    let wordIndex = 0;
    let wordStartTime = timings.charStartTimesMs[0];
    let wordDuration = 0;

    let words: string[] = [];
    let wordStartTimesMs: number[] = [];
    let wordDurationsMs: number[] = [];

    timings.chars.forEach((char: string, i: number) => {
      wordDuration += timings.charDurationsMs[i];

      if ([' ', ',', '.', null].includes(char)) {
        const word = timings.chars.slice(wordIndex, i).join('');
        if (word !== '') {
          words.push(word);
          wordStartTimesMs.push(wordStartTime);
          wordDurationsMs.push(wordDuration);
        }

        wordIndex = i + 1;
        if (i + 1 < timings.charStartTimesMs.length) {
          wordStartTime = timings.charStartTimesMs[i + 1];
        }
        wordDuration = 0;
      }
    });

    return {
      words,
      word_start_times_ms: wordStartTimesMs,
      word_durations_ms: wordDurationsMs
    };
  };

  const handleFinalAudio = async (message: any) => {
    console.log('[UNFLAGGED] handleFinalAudio called with message:', message.chat_message_id, 'type:', message.type);
    if (chatData?.chat.mode === 'text_only') {
      // Ignore audio in text_only mode
      return;
    }

    const combinedAudioData = audioChunksRef.current.join("");
    const base64AudioData = btoa(combinedAudioData);

    // Generate a unique filename for the audio file
    const audioFilename = `${FileSystem.documentDirectory}audio_${message.chat_message_id}.mp3`;

    // Write the base64 audio data to a file
    await FileSystem.writeAsStringAsync(audioFilename, base64AudioData, {
      encoding: FileSystem.EncodingType.Base64
    });

    // Use the file URI as the audioUri
    const audioUri = audioFilename;

    const processedWordTimings = processWordTimings(wordTimingsRef.current);

    console.log('[UNFLAGGED] Received audio for message:', message.chat_message_id, 'has message:', !!pendingAssistantMessagesRef.current[message.chat_message_id]?.message);
    
    // Store the audio with the message ID (which might be null)
    pendingAssistantMessagesRef.current[message.chat_message_id] = {
      ...pendingAssistantMessagesRef.current[message.chat_message_id],
      audio: { audioUri, wordTimings: processedWordTimings },
    };

    // If the message ID is null, try to find a message waiting for audio
    if (message.chat_message_id === null || message.chat_message_id === undefined) {
      console.log('[UNFLAGGED] Audio has null ID, checking for messages waiting for audio');
      // Find the first message without audio
      for (const [msgId, pending] of Object.entries(pendingAssistantMessagesRef.current)) {
        if (msgId !== 'null' && msgId !== null && pending.message && !pending.audio) {
          console.log('[UNFLAGGED] Found message waiting for audio:', msgId);
          // Move the audio to this message
          pendingAssistantMessagesRef.current[msgId].audio = { audioUri, wordTimings: processedWordTimings };
          delete pendingAssistantMessagesRef.current[null];
          checkAndAddAssistantMessage(msgId);
          return;
        }
      }
    }

    checkAndAddAssistantMessage(message.chat_message_id);

    // Reset audio chunks and word timings for the next message
    audioChunksRef.current = [];
    wordTimingsRef.current = null;
  };


  const handlePlayAudio = async (
    audioUrl: string,
    wordTimings: any,
    chatMessageId: string,
    text: string
  ) => {
    try {
      // Don't play if any modal is open or audio is stopped
      if (isModalOpenRef.current) {
        console.log("Audio playback prevented - modal open or audio stopped");
        return;
      }

      // Stop recording if active
      if (isRecording) {
        await stopRecording();
      }

      // If same audio is playing, pause it
      if (currentPlayingMessageId === chatMessageId) {
        await audioPlayerService.pauseSound();
        setCurrentPlayingMessageId(null);
        return;
      }

      // Stop any currently playing audio before starting new one
      if (audioPlayerService.isPlaying) {
        await audioPlayerService.pauseSound();
      }

      const newSound = await audioPlayerService.playSound(
        audioUrl,
        wordTimings, 
        chatMessageId,
        false,
        highlightModeRef.current,
        text,
        (status) => {
          if (status.isLoaded) {
            if (status.didJustFinish) {
              setCurrentPlayingMessageId(null);
            } else if (status.isPlaying) {
              setCurrentPlayingMessageId(chatMessageId);
            } else {
              setCurrentPlayingMessageId(null);
            }
          }
        }
      );

      setSound(newSound);
    } catch (error) {
      console.error('Error playing audio:', error);
      setCurrentPlayingMessageId(null);
    }
  };


  // checkAndAddAssistantMessage will be defined after usePolling hook

  const handlePlaySlowAudio = async (item: Message, chatMessageId: string, slowAudioUrl: string | null, text: string) => {
    triggerHaptic();

    if (isRecording) {
      stopRecording();
    }

    try {
      if (slowAudioUrl) {
        // Handle existing slow audio
        if (playingSlowAudioId === chatMessageId) {
          // If it's already playing, pause it
          await audioPlayerService.pauseSound();
          setPlayingSlowAudioId(null);
        } else {
          const newSound = await audioPlayerService.playSound(
            slowAudioUrl,
            item.word_timings,
            chatMessageId,
            true, // isSlowAudio
            highlightModeRef.current,
            text,
            (status) => {
              if (status.isLoaded) {
                if (status.didJustFinish || !status.isPlaying) {
                  setPlayingSlowAudioId(null);
                } else if (status.isPlaying) {
                  setPlayingSlowAudioId(chatMessageId);
                }
              }
            }
          );
          setSound(newSound);
        }
      } else {
        // Request new slow audio
        if (!await ensureWebSocketConnection()) {
          setErrorMessage('Please wait for connection to be established...');
          return;
        }

        const response = await fetch(`${API_URL}/api/v1/slow_audio`, {
          method: 'POST',
          headers: {
            'Authorization': `${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content_type: 'Chat',
            audio_url: item.audio_url?.startsWith('file://') ? null : item.audio_url,
            content_id: chatData?.chat.id,
            chat_message_id: chatMessageId,
            speed: 0.75
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to request slow audio');
        }
      }
    } catch (error) {
      console.error('Error with slow audio:', error);
      setPlayingSlowAudioId(null);
    }
  };

  const handleTranslate = async (text: string, chatMessageId: string, target_language: string) => {
    triggerHaptic();
    try {
      // Cancel recording if active
      if (isRecording) {
        cancelRecording();
      }
      const response = await fetch('https://translation-worker.lythamlabs.workers.dev', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sentence: text,
          language: chatData?.chat.language,
          target_language: target_language,
          translation_type: 'sentence'
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();

      // Update the chat message with the translation
      setChatData(prevData => ({
        ...prevData!,
        messages: prevData!.messages.map(message =>
          message.chat_message_id === chatMessageId
            ? { ...message, translation: data.translation }
            : message
        ),
      }));

    } catch (error) {
      console.error('Error translating message:', error);
      // Optionally, you can show an error message to the user here
    }
  };

  const handleSlowAudioMessage = useCallback(async (message: any) => {
    const { chat_message_id, audio_url } = message;

    // Update chat data with new slow audio URL
    setChatData(prevData => ({
      ...prevData!,
      messages: prevData!.messages.map(msg =>
        msg.chat_message_id === chat_message_id
          ? { ...msg, slow_audio_url: audio_url }
          : msg
      ),
    }));

    try {
      // Find the message that received slow audio
      const targetMessage = chatData?.messages.find(msg => msg.chat_message_id === chat_message_id);

      // Create a minimal message object if target message not found
      const messageToUse = targetMessage || {
        chat_message_id,
        word_timings: null // or use message.word_timings if available in the WebSocket response
      };

      // Play the slow audio
      handlePlaySlowAudio(messageToUse, chat_message_id, audio_url, targetMessage?.content);

    } catch (error) {
      console.error('Error playing slow audio:', error);
    }
  }, [chatData, handlePlaySlowAudio]);

  const getItemType = useCallback((item: Message) => {
    return item.role;
  }, []);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(error => console.error('Error unloading sound:', error));
      }
    };
  }, [sound]);

  if (loading || !chatData) {
    return (
      <View className="flex-1">
        <ActivityIndicator size="large" color={Colors[colorScheme]?.tint} />
      </View>
    );
  }

  // Create a ref for displayAlternativeResponse similar to displayCorrection
  const displayAlternativeResponse = useRef<(response: { chat_message_id: string, text: string }) => void>();

  // Set up the default displayAlternativeResponse function
  useEffect(() => {
    displayAlternativeResponse.current = (response: { chat_message_id: string, text: string }) => {
      setIsAlternativeLoading(false);
      
      setChatData(prevData => {
        const updatedMessages = prevData!.messages.map(message =>
          message.chat_message_id === response.chat_message_id
            ? { ...message, alternative_response: response.text }
            : message
        );

        if (selectedMessageForAlternative?.chat_message_id === response.chat_message_id) {
          setSelectedMessageForAlternative(prev => 
            prev ? { ...prev, alternative_response: response.text } : null
          );
        }

        return {
          ...prevData!,
          messages: updatedMessages,
        };
      });
    };
  }, [selectedMessageForAlternative]);

  // Update handleAlternativeResponse to match the pattern we used for handleCorrection
  const handleAlternativeResponse = async (item: Message) => {
    triggerHaptic();
    
    if (isRecording) {
      cancelRecording();
    }

    // Show modal immediately with loading state
    setSelectedMessageForAlternative(item);
    
    // If we don't have an alternative response yet, fetch it
    if (!item.alternative_response) {
      setIsAlternativeLoading(true);
      setShowAlternativeModal(true);
      
      if (!await ensureWebSocketConnection()) {
        setErrorMessage('Please wait for connection to be established...');
        setIsAlternativeLoading(false);
        return;
      }
      
      if (!chatData) return;
      
      try {
        await alternativeResponseService.fetch(
          chatData.chat.id.toString(),
          item.chat_message_id,
          item.content,
          chatData.chat.language,
          null,
          chatData.chat.client_provider,
          chatData.chat.model
        );
      } catch (error) {
        console.error('Error fetching alternative response:', error);
        setIsAlternativeLoading(false);
        setErrorMessage('Failed to get alternative response. Please try again.');
        setShowAlternativeModal(false);
      }
    } else {
      // If we already have the alternative response, just show the modal
      setShowAlternativeModal(true);
    }
  };

  // Create a ref to hold the current displayCorrection function
  const displayCorrection = useRef<(correction: { chat_message_id: string, text: string }) => void>();

  // Set up the default displayCorrection function
  useEffect(() => {
    displayCorrection.current = (correction: { chat_message_id: string, text: string }) => {
      setIsCorrectionLoading(false);
      
      setChatData(prevData => {
        const updatedMessages = prevData!.messages.map(message =>
          message.chat_message_id === correction.chat_message_id
            ? { ...message, correction: correction.text }
            : message
        );

        if (selectedMessageForCorrection?.chat_message_id === correction.chat_message_id) {
          setSelectedMessageForCorrection(prev => 
            prev ? { ...prev, correction: correction.text } : null
          );
        }
        
        // Auto-open the CorrectionModal if the correction contains mistakes.
        const updatedMessage = updatedMessages.find(message => message.chat_message_id === correction.chat_message_id);
        if (updatedMessage && hasMistakes(updatedMessage.correction)) {
          if (!showCorrectionModal) {
            setSelectedMessageForCorrection(updatedMessage);
            setShowCorrectionModal(true);
          }
        }
        
        return {
          ...prevData!,
          messages: updatedMessages,
        };
      });
    };
  }, [selectedMessageForCorrection, showCorrectionModal]);

  // Add a new ref for displayCorrectionExplanation
  const displayCorrectionExplanation = useRef<(explanation: { chat_message_id: string, text: string }) => void>();

  // Set up the default displayCorrectionExplanation function
  useEffect(() => {
    displayCorrectionExplanation.current = (explanation: { chat_message_id: string, text: string }) => {
      setIsCorrectionLoading(false); // Make sure to stop loading
      
      setChatData(prevData => {
        const updatedMessages = prevData!.messages.map(message =>
          message.chat_message_id === explanation.chat_message_id
            ? { ...message, correction_explanation: explanation.text }
            : message
        );

        if (selectedMessageForCorrection?.chat_message_id === explanation.chat_message_id) {
          setSelectedMessageForCorrection(prev => 
            prev ? { ...prev, correction_explanation: explanation.text } : null
          );
        }

        return {
          ...prevData!,
          messages: updatedMessages,
        };
      });
    };
  }, [selectedMessageForCorrection]);

  const handleCorrectionExplanation = async (item: Message) => {
    triggerHaptic();
    
    // If we already have the explanation, no need to fetch
    if (item.correction_explanation) {
      return;
    }

    // Set loading state before fetching
    setIsCorrectionLoading(true);
    
    if (!await ensureWebSocketConnection()) {
      setErrorMessage('Please wait for connection to be established...');
      setIsCorrectionLoading(false);
      return;
    }
    
    if (!chatData) return;
    
    try {
      // Find the previous AI message for context
      const messageIndex = chatData.messages.findIndex(msg => msg.chat_message_id === item.chat_message_id);
      const previousMessages = chatData.messages.slice(0, messageIndex).reverse();
      const previousAIMessage = previousMessages.find(msg => msg.role === 'assistant');

      // Create a promise that will resolve when we receive the explanation
      const explanationPromise = new Promise((resolve, reject) => {
        // Set a timeout of 10 seconds
        const timeoutId = setTimeout(() => {
          reject(new Error('Explanation request timed out'));
        }, 10000);

        // Store the original displayCorrectionExplanation function
        const originalDisplayExplanation = displayCorrectionExplanation.current;

        // Create a one-time explanation handler
        const handleExplanation = (explanation: { chat_message_id: string, text: string }) => {
          if (explanation.chat_message_id === item.chat_message_id) {
            clearTimeout(timeoutId);
            resolve(explanation);
          }
        };

        // Override displayCorrectionExplanation to also call our handler
        displayCorrectionExplanation.current = (explanation: { chat_message_id: string, text: string }) => {
          if (originalDisplayExplanation) {
            originalDisplayExplanation(explanation);
          }
          handleExplanation(explanation);
        };
      });

      // Send the explanation request
      await correctionExplanationService.fetchExplanation(
        chatData.chat.id.toString(),
        item.chat_message_id,
        item.correction,
        previousAIMessage?.content || '',
        item.content,
        chatData.chat.language,
        chatData.chat.client_provider,
        chatData.chat.model
      );

      // Wait for the explanation to be received
      await explanationPromise;

    } catch (error) {
      console.error('Error fetching correction explanation:', error);
      setIsCorrectionLoading(false);
      setErrorMessage('Failed to get explanation. Please try again.');
    }
  };

  
    // Add function to determine model based on transcription mode
    const determineModel = useCallback((transcriptionMode: string) => {
      if (chatData?.chat_form_options?.transcription_model_options?.[transcriptionMode]) {
        return chatData.chat_form_options.transcription_model_options[transcriptionMode].model;
      }
  
      // Use the new helper function as fallback
      return getTranscriptionModel(transcriptionMode);
    }, [chatData?.chat_form_options?.transcription_model_options]);

  // Update the renderInputArea function
  const renderInputArea = () => {
    return (
      <ChatInputBar
        chatId={chatId}
        message={message}
        setMessage={setMessage}
        isRecording={isRecording}
        isTranscribing={isTranscribing}
        isWaitingForResponse={isWaitingForResponse}
        sending={sending}
        hasText={hasText}
        setHasText={setHasText}
        isSuggestReplyPulsing={isSuggestReplyPulsing}
        transcriptionText="" // Empty string since we no longer use this with AudioRecorder
        colorScheme={colorScheme}
        transcriptionMode={transcriptionModeRef.current}
        transcriptionModel={transcriptionModelRef.current}
        isDeepgramConnected={false} // Default to true since we no longer use Deepgram
        handleSuggestedReplies={handleSuggestedReplies}
        startRecording={startRecording}
        stopRecording={stopRecording}
        cancelRecording={cancelRecording}
        sendMessage={() => sendMessage()}
        triggerHaptic={triggerHaptic}
        language={chatData?.chat.language || ""} // Add the required language prop
      />
    );
  };

  const handleUpgrade = () => {
    setShowLimitReachedUpgrade(true);
  }

  const handleSuggestedReplies = async () => {
    if (isSuggestReplyPulsing) return;

    triggerHaptic();
    if (!await ensureWebSocketConnection()) {
      setErrorMessage('Please wait for connection to be established...');
      return;
    }

    if (!chatData) return;

    if (isRecording) {
      stopRecording();
    }

    setSuggestions([]);
    setIsSuggestReplyPulsing(true);
    setIsSuggestionsLoading(true);
    setIsSuggestionsModalVisible(true);

    try {
      // Set the number of messages to retrieve: current + previous ones
      const n = 2; // Current message + 1 previous message

      // Get the last n messages (or fewer if not enough available)
      const lastMessages = chatData.messages.slice(-n);

      // The current message is always the last one
      const currentMessage = lastMessages[lastMessages.length - 1].content;
      const messageId = lastMessages[lastMessages.length - 1].chat_message_id;

      // Previous messages (if any) joined with a separator
      const previousMessage = lastMessages
        .slice(0, -1)
        .map(msg => msg.content)
        .join('\n');

      const response = await suggestedReplyService.fetch(
        chatData.chat.id,
        messageId,
        currentMessage,
        chatData.chat.language,
        previousMessage
      );
    } catch (error) {
      console.error('Error fetching suggested replies:', error);
    } finally {
      setIsSuggestReplyPulsing(false);
      setIsSuggestionsLoading(false);
    }
  };

  // Create a ref to track the last message we've seen
  const lastProcessedMessageRef = useRef<string | null>(null);

  // Effect to trigger guided mode reply when a new assistant message is added
  useEffect(() => {

    // Skip if no chat data, no messages, or guided mode is disabled
    if (!chatData || !chatData.messages.length || !guidedModeRef.current) return;
    // Get the most recent message
    const latestMessage = chatData.messages[chatData.messages.length - 1];
    // Skip if no message or it's not from assistant or we've already processed it
    if (!latestMessage || 
        latestMessage.role !== 'assistant' ) {
      return;
    }
    // Update the last processed message
    lastProcessedMessageRef.current = latestMessage.chat_message_id;
    
    // Skip if waiting for response or modals are open
    if (isWaitingForResponse) return;
    
    // Set a timeout to allow the audio to start playing first
    const timer = setTimeout(() => {
      handleGuidedModeReply();
    }, 6000);
    
    return () => clearTimeout(timer);
  }, [chatData?.messages[chatData.messages.length - 1]?.id, guidedModeRef.current, isWaitingForResponse]);

  const handleGuidedModeReply = async () => {

    triggerHaptic();
    if (!await ensureWebSocketConnection()) {
      setErrorMessage('Please wait for connection to be established...');
      return;
    }

    if (!chatData) return;

    if (isRecording) {
      stopRecording();
    }

    setGuidedModeReply([]);
    
    setIsGuidedModeReplyLoading(true);

    try {
      // Set the number of messages to retrieve: current + previous ones
      const n = 2; // Current message + 1 previous message

      // Get the last n messages (or fewer if not enough available)
      const lastMessages = chatData.messages.slice(-n);
      
      // Safety check to make sure we have at least one message
      if (lastMessages.length === 0) {
        console.error('No messages available for guided mode reply');
        return;
      }

      // The current message is always the last one
      const currentMessage = lastMessages[lastMessages.length - 1].content;
      const messageId = lastMessages[lastMessages.length - 1].chat_message_id;

      // Previous messages (if any) joined with a separator
      const previousMessage = lastMessages
        .slice(0, -1)
        .map(msg => msg.content)
        .join('\n');
      
      const response = await guidedModeReplyService.fetch(
        chatData.chat.id,
        messageId,
        currentMessage,
        chatData.chat.language,
        previousMessage
      );

    } catch (error) {
      console.error('Error fetching guided mode reply:', error);
    }
  };

  useEffect(() => {
    if (isGuidedModeReplyLoading) {
      setTimeout(() => {
        setIsGuidedModeReplyLoading(false);
        // Only set timeout warning if the guided modal is not visible
        if (!isGuidedModeReplyVisible) {
          setIsGuidedModeReplyLoadingTimeout(true);
          setTimeout(() => {
            setIsGuidedModeReplyLoadingTimeout(false);
          }, 300);
        }
      }, 6000);
    }
    else {
      setIsGuidedModeReplyLoadingTimeout(false);
    }
  }, [isGuidedModeReplyLoading, isGuidedModeReplyVisible]);

  const displaySuggestions = (response: { suggestions: string[] }) => {
    setSuggestions(response.suggestions);
    setIsSuggestionsModalVisible(true);
  }

  const handleSuggestionSelect = (suggestion: string) => {
    triggerHaptic();
    setIsSuggestionsModalVisible(false);
    sendMessage(suggestion);
  };

  const handleTranslator = () => {
    triggerHaptic();
    // Implement the logic to open the translator service
  };

  // Add this state to control the visibility of the dropdown menu
  const [showMenu, setShowMenu] = useState(false);

  const handleChatSettings = () => {
    triggerHaptic();

    // Stop any playing audio using AudioPlayerService
    if (audioPlayerService.isPlaying) {
      audioPlayerService.stopSound();
      setCurrentPlayingMessageId(null);
      setPlayingSlowAudioId(null);
    }

    // Cancel recording if active
    if (isRecording) {
      cancelRecording();
    }

    setShowSettings(true);
    setShowMenu(false);
  };

  const handleEndChat = () => {
    triggerHaptic();

    // Stop any playing audio using AudioPlayerService
    if (audioPlayerService.isPlaying) {
      audioPlayerService.stopSound();
      setCurrentPlayingMessageId(null);
      setPlayingSlowAudioId(null);
    }

    // Cancel recording if active
    if (isRecording) {
      cancelRecording();
    }

    setShowEndChatModal(true);
    setShowMenu(false);
  };

  const handleSettingsChange = useCallback(async (setting: string, value: string | boolean | number) => {
    try {
      const response = await fetch(`${API_URL}/api/v1/chat_settings/${chatData?.chat.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat: {
            [setting]: value
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update chat settings');
      }

      const updatedChat = await response.json();

      console.log(`${setting} setting before update:`, chatData?.chat[setting]);
      console.log(`New ${setting} value:`, value);

      // Update the chat data in the state
      setChatData(prevData => ({
        ...prevData!,
        chat: {
          ...prevData!.chat,
          [setting]: value
        }
      }));

      // // Handle transcription mode changes
      // if (setting === 'transcription_mode') {
      //   if (value === 'v7') {
      //     // Setup Deepgram when switching to v2
      //     await setupDeepgram();
      //   } else {
      //     // Cleanup Deepgram when switching away from v2
      //     if (deepgramService) {
      //       deepgramService.disconnect();
      //       setDeepgramService(null);
      //       setIsDeepgramConnected(false);
      //     }
      //   }
      // }

      // Update the local refs
      switch (setting) {
        case 'auto_record':
          autoRecordRef.current = value as boolean;
          break;
        case 'auto_send':
          autoSendRef.current = value as boolean;
          break;
        case 'auto_send_threshold':
          autoSendThresholdRef.current = value as number;
          break;
        case 'auto_correct':
          autoCorrectRef.current = value as boolean;
          break;
        case 'transcription_mode':
          transcriptionModeRef.current = value as string;
          transcriptionModelRef.current = getTranscriptionModel(value as string);
          break;
        case 'highlight_mode':
          highlightModeRef.current = value as string;
          audioPlayerService.setHighlightMode(highlightModeRef.current);
          break;
        case 'guided_mode':
          guidedModeRef.current = value as boolean;
          if (!guidedModeRef.current) {
            setIsGuidedModeReplyVisible(false);
          }
          break;
      }

      console.log(`${setting} setting after update:`, value);
      console.log('Updated local refs:', {
        auto_record: autoRecordRef.current,
        auto_send: autoSendRef.current,
        auto_send_threshold: autoSendThresholdRef.current,
        auto_correct: autoCorrectRef.current,
        transcription_mode: transcriptionModeRef.current,
        transcription_model: transcriptionModelRef.current,
        highlight_mode: highlightModeRef.current
      });

    } catch (error) {
      console.error('Error updating chat settings:', error);
    }
  }, [chatData, token, API_URL]);

  // Add a helper function to check connection before actions
  const ensureWebSocketConnection = async (): Promise<boolean> => {
    if (!chatData?.chat.id) return false;

    if (!isConnected(chatData.chat.id)) {
      connectWebSocket(chatData.chat.id, {
        name: 'ChatChannel',
        params: { chat_id: chatData.chat.id }
      });
      return await waitForConnection(chatData.chat.id);
    }
    return true;
  };

  useEffect(() => {
    // If we can't go back, add a manual back button
    if (!navigation.canGoBack()) {
      navigation.setOptions({
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.push('/speak')}
          >
            <FontAwesomeIcon
              icon={faChevronLeft}
              size={getIconSize(24)}
              color={Colors[colorScheme ?? 'light'].text}
            />
          </TouchableOpacity>
        ),
      });
    }
  }, [navigation]);

  const handleShowUpgradeModal = () => {
    setShowLimitReachedUpgrade(true);
  };
    
  // Add this handler function
  const handleRequestPermission = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (granted) {
        setShowPermissionRequest(false);
        startRecording();
      } else {
        // If permission is still not granted, keep the modal visible
        setMicrophoneErrorType('permission');
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      setMicrophoneErrorType('generic');
    }
  };

  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  
  // Calculate dynamic keyboard offset
  const keyboardOffset = Platform.select({
    ios: headerHeight,
    android: insets.bottom + 10, // small buffer
    default: 0
  });

  const handleCorrection = async (item: Message, previousMessage: Message | undefined) => {
    triggerHaptic();
    
    if (isRecording) {
      cancelRecording();
    }

    // Show modal immediately with loading state
    setSelectedMessageForCorrection(item);
    // Immediately set the flag so no new audio plays
    isModalOpenRef.current = true;
    
    // If we don't have a correction yet, fetch it
    if (!item.correction) {
      setIsCorrectionLoading(true);
      setShowCorrectionModal(true);
      
      if (!await ensureWebSocketConnection()) {
        setErrorMessage('Please wait for connection to be established...');
        setIsCorrectionLoading(false);
        return;
      }
      
      if (!chatData) return;
      
      try {
        await textCorrectionService.fetchCorrection(
          chatData.chat.id.toString(),
          item.chat_message_id,
          item.content,
          chatData.chat.language,
          previousMessage?.content || null, // Add previous message context
          chatData.chat.client_provider,
          chatData.chat.model
        );
      } catch (error) {
        console.error('Error fetching correction:', error);
        setIsCorrectionLoading(false);
        setErrorMessage('Failed to get correction. Please try again.');
        setShowCorrectionModal(false);
      }
    } else {
      // If we already have the correction, just show the modal
      setShowCorrectionModal(true);
    }
  };

  // Add these states near the top of the ChatScreen component
  const [isVocabModalVisible, setIsVocabModalVisible] = useState(false);
  const [selectedVocabWord, setSelectedVocabWord] = useState<string | null>(null);

  

  const handleTranslationModalOpen = (translation: string, originalText: string) => {
    // Store playing state when storing message info
    if (currentPlayingMessageId) {
      const playingMessage = chatData?.messages.find(
        msg => msg.chat_message_id === currentPlayingMessageId
      );
      if (playingMessage) {
        setPreviousPlayingMessage({
          messageId: playingMessage.chat_message_id,
          audioUrl: playingMessage.audio_url,
          wordTimings: playingMessage.word_timings,
          text: playingMessage.content,
          wasPlaying: audioPlayerService.isPlaying
        });
      }
    }
    // Stop the current audio
    if (audioPlayerService.isPlaying) {
      audioPlayerService.pauseSound();
      setCurrentPlayingMessageId(null);
    }
    
    setCurrentTranslation(translation);
    setCurrentOriginalText(originalText);
    setIsTranslationModalVisible(true);
  };

  // Add this function to check if we've shown the modal today
  const hasShownModalToday = async () => {
    try {
      if (!userSettings?.user?.id) {
        return { shown: false, isToday: false };
      }

      const lastShown = await AsyncStorage.getItem(
        `${POINTS_MODAL_KEY_PREFIX}${userSettings.user.id}`
      );
      const today = new Date().toDateString();
      
      if (!lastShown) {
        return { shown: false, isToday: false };
      }
      
      const isToday = lastShown === today;
      
      return { shown: true, isToday };
    } catch (error) {
      console.error('Error checking modal date:', error);
      return { shown: false, isToday: false };
    }
  };

  // Add this function to mark that we've shown the modal today
  const markModalShownToday = async () => {
    try {
      if (!userSettings?.user?.id) {
        return;
      }

      const today = new Date().toDateString();
      await AsyncStorage.setItem(
        `${POINTS_MODAL_KEY_PREFIX}${userSettings.user.id}`,
        today
      );
    } catch (error) {
      console.error('Error saving modal date:', error);
    }
  };

  // Add this effect to initialize the daily check when component mounts
  useEffect(() => {
    hasShownModalToday().then(shown => {
      hasShownTodayRef.current = shown;
    });
  }, []);

  // Add this effect to reset message counts when chat changes
  useEffect(() => {
    if (chatData?.chat.id) {
      // Only initialize the current chat if it doesn't exist
      const chatId = chatData.chat.id.toString();
      if (!userMessageCountRef.current[chatId]) {
        userMessageCountRef.current[chatId] = 0;
      }
    }
  }, [chatData?.chat.id]);

  // Modify the effect that initializes message counts
  useEffect(() => {
    if (chatData?.chat.id) {
      const chatId = chatData.chat.id.toString();
      
      // Load the saved message count when chat changes
      loadMessageCount(chatId).then(count => {
        userMessageCountRef.current[chatId] = count;
        console.log('Loaded message count for chat', chatId, ':', count);
      });
    }
  }, [chatData?.chat.id]);

  // Add this effect to initialize all counts when component mounts
  useEffect(() => {
    const initializeMessageCounts = async () => {
      try {
        // Get all keys from AsyncStorage
        const keys = await AsyncStorage.getAllKeys();
        const messageCountKeys = keys.filter(key => key.startsWith(STORAGE_KEY_PREFIX));
        
        // Load all message counts
        for (const key of messageCountKeys) {
          const chatId = key.replace(STORAGE_KEY_PREFIX, '');
          const count = await loadMessageCount(chatId);
          userMessageCountRef.current[chatId] = count;
        }
        
        // Check if modal was shown today
        const shown = await hasShownModalToday();
        hasShownTodayRef.current = shown;
      } catch (error) {
        console.error('Error initializing message counts:', error);
      }
    };

    initializeMessageCounts();
  }, []);

  useEffect(() => {
    if (isSending) {
      setIsGuidedModeReplyVisible(false);
    }
  }, [isSending])


  // Update the menu press handler in the Stack.Screen options
  const handleMenuPress = () => {
    // Store playing state when storing message info
    if (currentPlayingMessageId) {
      const playingMessage = chatData?.messages.find(
        msg => msg.chat_message_id === currentPlayingMessageId
      );
      if (playingMessage) {
        setPreviousPlayingMessage({
          messageId: playingMessage.chat_message_id,
          audioUrl: playingMessage.audio_url,
          wordTimings: playingMessage.word_timings,
          text: playingMessage.content,
          wasPlaying: audioPlayerService.isPlaying
        });
      }
    }

    // Stop any playing audio
    if (audioPlayerService.isPlaying) {
      audioPlayerService.pauseSound();
      setCurrentPlayingMessageId(null);
      setPlayingSlowAudioId(null);
    }

    // Cancel recording if active
    if (isRecording) {
      cancelRecording();
    }

    setShowMenu(true);
  };

  // Add cleanup effect for audio resources
  useEffect(() => {
    return () => {
      // Cleanup audio player
      if (audioPlayerService.isPlaying) {
        audioPlayerService.stopSound();
      }
      setCurrentPlayingMessageId(null);
      setPlayingSlowAudioId(null);

      // Cleanup recording
      if (isRecording) {
        cancelRecording();
      }

      // Clear all pending messages
      pendingAssistantMessagesRef.current = {};
      pendingAudioMessagesRef.current = [];
      pendingAIResponseRef.current = null;
    };
  }, []);

  // Add this effect to clean up previousPlayingMessage when component unmounts
  useEffect(() => {
    return () => {
      setPreviousPlayingMessage(null);
    };
  }, []);

  // Add the helper function to check for mistakes in the correction text.
  const hasMistakes = (correctionText: string) => {
    if (!correctionText) return false;
    return correctionText.includes('→') || correctionText.includes('<del>') || correctionText.includes('<ins>') || correctionText.includes('<b>');
  };

  // Add AudioRecorder ref
  const audioRecorderRef = useRef<AudioRecorderHandle>(null);

  // Add handler functions for AudioRecorder
  const handleRecordingStateChange = useCallback((isRecording: boolean) => {
    setIsRecording(isRecording);
  }, []);
  
  const handleTranscriptionStateChange = useCallback((isTranscribing: boolean) => {
    setIsTranscribing(isTranscribing);
  }, []);
  
  const handleMicrophoneError = useCallback((errorType: 'permission' | 'initialization' | 'connection' | 'generic', showModal: boolean) => {
    if (showModal) {
      setMicrophoneErrorType(errorType);
      setShowPermissionRequest(true);
    }
  }, []);
  
  const handleTranscriptionResult = useCallback((text: string, sendImmediately: boolean) => {
    if (sendImmediately) {
      const newMessage = message.length > 0 ? `${message} ${text}` : text;
      sendMessage(newMessage);
    } else {
      setMessage(prevMessage => {
        const newMessage = prevMessage.length > 0 ? `${prevMessage} ${text}` : text;
        setHasText(newMessage.trim().length > 0);
        return newMessage;
      });
    }
  }, [message, sendMessage]);

  const handlePendingUserAudioChange = useCallback((audio: PendingUserAudio | null) => {
    pendingUserAudioRef.current = audio;
    setPendingUserAudio(audio);
  }, []);

  // Simplified startRecording function
  const startRecording = async (isLongPress?: boolean) => {
    isLongPressRef.current = isLongPress || false;
    triggerHaptic();
    await audioRecorderRef.current?.startRecording();
  };

  // Simplified stopRecording function
  const stopRecording = async (send: boolean = false) => {
    // DEBUG: Check if ChatInputBar is in debug timeout mode
    const DEBUG_SIMULATE_TIMEOUT = false; // Should match ChatInputBar setting
    
    if (DEBUG_SIMULATE_TIMEOUT) {
      console.log('[DEBUG] Parent stopRecording: Skipping actual stop due to debug mode');
      triggerHaptic();
      isLongPressRef.current = false;
      // Don't call the actual stopRecording when in debug mode
      // But we need to notify ChatInputBar that recording stopped
      setIsRecording(false);
      setIsTranscribing(true); // Simulate transcription state
      return;
    }
    
    triggerHaptic();
    isLongPressRef.current = false;
    await audioRecorderRef.current?.stopRecording(send);
  };

  // Simplified cancelRecording function
  const cancelRecording = async () => {
    isLongPressRef.current = false;
    setIsTranscribing(false); // Reset transcribing state when cancelling
    await audioRecorderRef.current?.cancelRecording();
  };
  // Add a new ref to track processed user message IDs as a semaphore

  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRefreshingRef = useRef(false);

  // Tracking previous message count to detect new messages
  const previousMessagesCountRef = useRef<number>(chatData?.messages?.length || 0);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  // Update previous message count and new message state whenever messages change
  useEffect(() => {
    if (chatData?.messages) {
      // Check if we have new messages
      if (chatData.messages.length > previousMessagesCountRef.current) {
        setHasNewMessage(true);
        // Clear the new message flag after a short delay
        const timer = setTimeout(() => {
          setHasNewMessage(false);
        }, 100);
        
        // Update the ref after setting the state
        previousMessagesCountRef.current = chatData.messages.length;
        
        return () => clearTimeout(timer);
      } else {
        previousMessagesCountRef.current = chatData.messages.length;
      }
    }
  }, [chatData?.messages]);

  // Add a ref to track if we're polling after a refresh
  const pollingAfterRefreshRef = useRef(false);

  // Replace polling-related code with the hook
  const {
    showResponseTimeout,
    isPolling,
    pendingMessageIds,
    handleRefreshChat,
    startPolling,
    stopPolling,
    setShowResponseTimeout,
    responseTimeoutRef
  } = usePolling({
    chatData,
    token,
    handlePlayAudio: (audioUrl: string, wordTimings: any, chatMessageId: string, text: string) => {
      // Mark as played before calling handlePlayAudio to prevent duplicates
      if (!playedAudioMessagesRef.current.has(chatMessageId)) {
        addPlayedAudioMessage(chatMessageId);
        handlePlayAudio(audioUrl, wordTimings, chatMessageId, text);
      } else {
        console.log('[UNFLAGGED] Polling tried to play audio for already-played message:', chatMessageId);
      }
    },
    usePollingSystem: !!usePollingSystem, // Make sure this variable exists in your component
    setIsWaitingForResponse,
    setChatData
  });

  // Wrap handleRefreshChat to also clear local timeout states
  const handleRefreshChatWithClear = useCallback(() => {
    console.log('[UNFLAGGED] Refresh pressed, clearing timeout states');
    setForcedTimeout(false);
    setShowIntermediateTimeout(false);
    if (handleRefreshChat) {
      handleRefreshChat();
    }
  }, [handleRefreshChat]);

  const checkAndAddAssistantMessage = useCallback(async (chatMessageId: string) => {
    let pendingMessage = pendingAssistantMessagesRef.current[chatMessageId];
    console.log('[UNFLAGGED] checkAndAddAssistantMessage called for:', chatMessageId, 'has audio:', !!pendingMessage?.audio, 'has message:', !!pendingMessage?.message);
    
    // Check if we have a message but no audio, and there's orphaned audio with null ID
    if (pendingMessage?.message && !pendingMessage?.audio && pendingAssistantMessagesRef.current[null]?.audio) {
      console.log('[UNFLAGGED] Found orphaned audio with null ID, combining with message:', chatMessageId);
      // Combine the orphaned audio with this message
      pendingMessage.audio = pendingAssistantMessagesRef.current[null].audio;
      delete pendingAssistantMessagesRef.current[null];
    }
    
    // Also check if we're in a timeout state and have a message without audio
    // Always add the message if we have it but no audio after some time
    if (pendingMessage?.message && !pendingMessage?.audio) {
      console.log('[UNFLAGGED] Message without audio detected, checking if we should add it');
      
      // Check if enough time has passed or we're in timeout
      const isInTimeout = forcedTimeout || showResponseTimeout || showIntermediateTimeout;
      
      if (isInTimeout) {
        console.log('[UNFLAGGED] Timeout state detected, adding message without audio');
        // Add the message without audio to unblock the UI
        const newMessage = {
          ...pendingMessage.message,
          audio_url: null,
          word_timings: null,
        };
        
        console.log('[UNFLAGGED] Adding message to chat data:', newMessage.chat_message_id, 'content:', newMessage.content?.substring(0, 50));
        setChatData(prevData => {
          const newData = {
            ...prevData!,
            messages: [...prevData!.messages, newMessage],
          };
          console.log('[UNFLAGGED] New messages count:', newData.messages.length);
          return newData;
        });
        
        // Clear the pending message and states
        delete pendingAssistantMessagesRef.current[chatMessageId];
        
        console.log('[UNFLAGGED] checkAndAddAssistantMessage - clearing states');
        console.log('[UNFLAGGED] Before clearing - forcedTimeout:', forcedTimeout, 'showResponseTimeout:', showResponseTimeout);
        
        // Clear the response timeout to prevent polling from starting
        if (responseTimeoutRef.current) {
          console.log('[UNFLAGGED] Clearing response timeout to prevent polling');
          clearTimeout(responseTimeoutRef.current);
          responseTimeoutRef.current = null;
        }
        
        setIsWaitingForResponse(false);
        setForcedTimeout(false);
        setShowIntermediateTimeout(false);
        setShowResponseTimeout(false);
        
        console.log('[UNFLAGGED] After clearing - states should be false now');
        return;
      }
    }
    
    if (pendingMessage && pendingMessage.audio && pendingMessage.message) {
      // Both audio and message are ready
      const newMessage = {
        ...pendingMessage.message,
        audio_url: pendingMessage.audio.audioUri,
        word_timings: pendingMessage.audio.wordTimings,
      };

      console.log('[UNFLAGGED] Adding message to chat data:', newMessage.chat_message_id, 'content:', newMessage.content?.substring(0, 50));
      setChatData(prevData => {
        const newData = {
          ...prevData!,
          messages: [...prevData!.messages, newMessage],
        };
        console.log('[UNFLAGGED] New messages count:', newData.messages.length);
        return newData;
      });

      // Remove the message from pending messages
      delete pendingAssistantMessagesRef.current[chatMessageId];

      setIsWaitingForResponse(false);
      
      // Clear timeout states when message arrives
      setForcedTimeout(false);
      setShowIntermediateTimeout(false);
      setShowResponseTimeout(false);
      
      // Clear the response timeout to prevent polling from starting
      // Do this AFTER clearing states to ensure proper cleanup order
      if (responseTimeoutRef.current) {
        console.log('[UNFLAGGED] Clearing response timeout to prevent polling (audio+message ready)');
        clearTimeout(responseTimeoutRef.current);
        responseTimeoutRef.current = null;
      }

      // Update the ref instead of state
      lastAddedMessageIdRef.current = chatMessageId;

      // Add a small delay before playing audio to ensure UI is updated
      setTimeout(() => {
        console.log('[UNFLAGGED] Audio playback check:', {
          isModalOpen: isModalOpenRef.current,
          isPlaying: audioPlayerService.isPlaying,
          resumeAudio: resumeAudioRef.current,
          audioUrl: newMessage.audio_url,
          alreadyPlayed: playedAudioMessagesRef.current.has(chatMessageId)
        });
        
        // Only play if no modal is open and audio isn't already playing
        if (!isModalOpenRef.current && !audioPlayerService.isPlaying && resumeAudioRef.current) {
          console.log('[UNFLAGGED] Playing audio for message:', chatMessageId);
          addPlayedAudioMessage(chatMessageId);
          handlePlayAudio(
            newMessage.audio_url,
            newMessage.word_timings,
            chatMessageId,
            newMessage.content
          );
        } else {
          console.log('[UNFLAGGED] Queueing audio for later playback');
          // Queue the message for later playback
          pendingAudioMessagesRef.current.push(newMessage);
        }
      }, 100);
    }
  }, [chatData, handlePlayAudio, forcedTimeout, showResponseTimeout, showIntermediateTimeout]);

  const handleWordTranslated = (word: string, translation: string) => {
    if (!chatData?.chat) return;
    
    // Update the chat data in the database
    if (chatData?.chat?.id) {
      chatWordsService.addToTranslatedChats(chatData.chat.id, word, translation)
        .then(() => {
          // Update local state after successful API call
          if (chatData?.chat) {
            const updatedChat: ChatData['chat'] = {
              ...chatData.chat,
              translated_vocabulary: [...(chatData.chat.translated_vocabulary || []), word]
            };
            setChatData({
              ...chatData,
              chat: updatedChat
            });
          }
        })
        .catch(error => {
          console.error('Error updating translated words:', error);
        });
    }
  };

  const handleWordSaved = (word: string, translation: string) => {
    if (!chatData?.chat) return;    
    
    // Update the chat data in the database
    if (chatData?.chat?.id) {
      chatWordsService.addToSavedChats(chatData.chat.id, word, translation)
        .then(() => {
          // Update local state after successful API call
          if (chatData?.chat) {
            const updatedChat: ChatData['chat'] = {
              ...chatData.chat,
              saved_vocabulary: [...(chatData.chat.saved_vocabulary || []), word]
            };
            setChatData({
              ...chatData,
              chat: updatedChat
            });
          }
        })
        .catch(error => {
          console.error('Error updating saved words:', error);
        });
    }
  };

  // Add state for isPhrase
  const [isPhrase, setIsPhrase] = useState(false);
  const [activePhraseSelectionMessageId, setActivePhraseSelectionMessageId] = useState<string | null>(null);

  return (
    <>
      <Stack.Screen
        options={
          {headerTitle: () => (
            <View className="flex-row items-center">
              {/* <TouchableOpacity onPress={resetForTesting}>
                <Text>Reset</Text>
              </TouchableOpacity> */}
            </View>
          ),
          headerRight: () => (
            <Pressable 
              onPress={handleMenuPress} 
              style={{ paddingRight: 16 }} 
              hitSlop={20}
            >
              <FontAwesomeIcon 
                icon={faEllipsisVertical} 
                size={getIconSize(24)} 
                color={Colors[colorScheme]?.text} 
              />
            </Pressable>
          ),
          contentStyle: { backgroundColor: "#fff" }
        }}
      />

      <AudioRecorder
        ref={audioRecorderRef}
        token={token}
        chatData={chatData}
        onRecordingStateChange={handleRecordingStateChange}
        onTranscriptionStateChange={handleTranscriptionStateChange}
        onMicrophoneError={handleMicrophoneError}
        onTranscriptionResult={handleTranscriptionResult}
        useNewVADSystem={useNewVADSystem}
        voiceRecognitionRef={voiceRecognitionRef}
        transcriptionMode={transcriptionModeRef.current}
        transcriptionModel={transcriptionModelRef.current}
        useTranscriptionCloudflareWorker={useTranscriptionCloudflareWorker}
        onPendingUserAudioChange={handlePendingUserAudioChange}
        autoSend={autoSendRef.current && !isLongPressRef.current}
        autoSendThreshold={autoSendThresholdRef.current}
        audioPlayerService={audioPlayerService}
      />

      {/* NEW VAD SYSTEM START */}
      {useNewVADSystem && (
        <View style={{ position: 'absolute', top: -1000, left: -1000 }}>
          <VoiceRecognition
            ref={voiceRecognitionRef}
            onSilenceDetected={() => {
              console.log("Silence detected via VoiceRecognition");
              stopRecording(autoSendRef.current && !isLongPressRef.current);
            }}
            silenceThreshold={autoSendRef.current && !isLongPressRef.current ? autoSendThresholdRef.current * 1000 : 20000}
            onTextResult={() => {}}
          />
        </View>
      )}
      {/* NEW VAD SYSTEM END */}

      {/* The rest of your component */}
      <KeyboardAvoidingView
        className={cx('flex-1 bg-white dark:bg-[#181C20] rounded-b-3xl')} // Updated to add dark mode background
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardOffset}
      >
        {errorMessage && (
          <View className="bg-red-500 p-4 rounded-md mb-4">
            <Text style={GlobalFontStyleSheet.textMd} className="text-gray-200 font-bold">
              {errorMessage}
            </Text>
            {errorMessage.includes('Connection') || errorMessage.includes('connection') ? (
              <TouchableOpacity
                onPress={() => {
                  if (chatData?.chat.id) {
                    connectWebSocket(chatData.chat.id, {
                      name: 'ChatChannel',
                      params: { chat_id: chatData.chat.id }
                    });
                  }
                }}
                className="mt-2"
              >
                <Text style={GlobalFontStyleSheet.textMd} className="text-gray-800 underline">
                  Retry Connection
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setErrorMessage(null)} className="mt-2">
                <Text style={GlobalFontStyleSheet.textMd} className="text-gray-200 underline">
                  Close
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <FlashList
          estimatedItemSize={150}
          data={chatData?.messages?.slice().reverse()}
          renderItem={({ item }) => (
            <MessageItem
              item={item}
              colorScheme={colorScheme}
              onWordPress={handleWordPress}
              onPlayAudio={handlePlayAudio}
              onPlaySlowAudio={handlePlaySlowAudio}
              onTranslate={handleTranslate}
              playingAudioId={currentPlayingMessageId}
              playingSlowAudioId={playingSlowAudioId}
              audioPlayerService={audioPlayerService}
              onTextCorrection={(message) => {
                // Find the previous AI message for context
                const messageIndex = chatData?.messages.findIndex(msg => msg.chat_message_id === message.chat_message_id) || 0;
                const previousMessages = chatData?.messages.slice(0, messageIndex).reverse() || [];
                const previousAIMessage = previousMessages.find(msg => msg.role === 'assistant');

                handleCorrection(message, previousAIMessage);
              }}
              onCorrectionExplanation={handleCorrectionExplanation}
              handleAlternativeResponse={handleAlternativeResponse}
              selectedSentence={selectedSentence}
              chatMode={chatData?.chat.mode || ''}
              highlightMode={highlightModeRef.current as 'word' | 'sentence' | 'off'}
              chatData={chatData}
              autoCorrectEnabled={autoCorrectRef.current}
              setCurrentPlayingMessageId={setCurrentPlayingMessageId}
              setPlayingSlowAudioId={setPlayingSlowAudioId}
              setChatData={setChatData}
              selectedWord={selectedVocabWord}
              onTranslationModalOpen={handleTranslationModalOpen} // Pass the handler
              isRecording={isRecording}
              cancelRecording={cancelRecording}
              isNew={lastMessageRef.current?.messageId === item.chat_message_id}
              targetLanguage={userSettings?.team.langua_native_language || 'english'}
              isPhrase={isPhrase}
              activePhraseSelectionMessageId={activePhraseSelectionMessageId}
              onPhraseSelectionStart={setActivePhraseSelectionMessageId}
            />
          )}
          getItemType={getItemType}
          inverted
          className="flex-1"
          contentContainerStyle={styles.messageList}
          ListHeaderComponent={isWaitingForResponse ? (
            <>
              {console.log('[UNFLAGGED] Rendering LoadingDots - showResponseTimeout:', showResponseTimeout, 'forcedTimeout:', forcedTimeout, 'showIntermediateTimeout:', showIntermediateTimeout, 'isWaitingForResponse:', isWaitingForResponse, 'usePollingSystem:', usePollingSystem)}
              <LoadingDots 
                avatarUrl={chatData?.chat.avatar_url} 
                showTimeout={usePollingSystem && (showResponseTimeout || forcedTimeout)}
                showIntermediateTimeout={usePollingSystem && showIntermediateTimeout}
                onRefresh={usePollingSystem ? handleRefreshChatWithClear : undefined}
                newMessageArrived={pendingMessageIds.size > 0 || hasNewMessage}
                onDismiss={usePollingSystem ? () => {
                  console.log('[UNFLAGGED] Dismiss button pressed - clearing timeout states');
                  setShowResponseTimeout(false);
                  setForcedTimeout(false);
                  setShowIntermediateTimeout(false);
                  setIsWaitingForResponse(false);
                } : undefined}
              />
            </>
          ) : null}
        />

        <SuggestedRepliesModal
          isVisible={isSuggestionsModalVisible}
          onClose={() => setIsSuggestionsModalVisible(false)}
          suggestions={suggestions}
          onSuggestionSelect={handleSuggestionSelect}
          language={chatData?.chat.language || ''}
          targetLanguage={userSettings?.team.langua_native_language || 'english'}
          voice={chatData?.chat.voice || ''}
          voice_provider={chatData?.chat.voice_provider || ''}
          token={token || ''}
          audioPlayerService={audioPlayerService}
          isLoading={isSuggestionsLoading}
          onWordTranslated={handleWordTranslated}
          onWordSaved={handleWordSaved}
        />
        
        <View className="justify-center items-center">
        {isGuidedModeReplyLoading && !isGuidedModeReplyLoadingTimeout && (
          <BouncingDots delay={0} size={5} color="#0000ff" />
        )}
        {isGuidedModeReplyLoadingTimeout && !isGuidedModeReplyLoading && !isGuidedModeReplyVisible && (
          <FontAwesomeIcon icon={faTriangleExclamation} size={20} color="#F87171" />
        )}
        </View>
        <GuidedModeReplyModal
          isVisible={isGuidedModeReplyVisible}
          onClose={() => setIsGuidedModeReplyVisible(false)}
          reply={guidedModeReply?.suggestion || ''}
          translation={guidedModeReply?.translation || ''}
          language={chatData?.chat.language || ''}
          voice={chatData?.chat.voice || ''}
          voice_provider={chatData?.chat.voice_provider || ''}
          token={token || ''}
          audioPlayerService={audioPlayerService}
          onReplySelect={sendMessage}
          isRecording={isRecording}
          cancelRecording={cancelRecording}
          onWordTranslated={handleWordTranslated}
          onWordSaved={handleWordSaved}
          chatContextFlag={false}
          japaneseReadingAidFlag={false}
        />
        <LimitReachedModal
          hasHitLimit={showLimitReachedUpgrade}
          onClose={() => {
            setShowLimitReachedUpgrade(false);
            setDismissedUpgradeModal(true);
          }}
        />
        {chatData?.message_limit_reached && subscriptionInfo && !subscriptionLoading ? (
          <View className="bg-yellow-500 text-black p-4 mb-4 rounded-md">
            <View className="items-center">
              {subscriptionInfo?.plan?.id === 'free' ? (
                <Text className="text-center">You've hit your message limit for this week.</Text>
              ) : (
                <Text className="text-center">You've hit your message limit for today - great effort!</Text>
              )}
              <View className="h-2" />
              <View className="flex-row justify-center">
                <Text>Want to keep going?</Text>
                <TouchableOpacity onPress={() => router.push('/subscription')}>
                  {subscriptionInfo?.plan?.id === 'free' ? (
                    <Text className="font-bold text-blue-500">
                      {Platform.OS === 'android' 
                        ? ' Try Pro risk-free for 30 days'
                        : ' Unlock Pro Access'}
                    </Text>
                  ) : (
                    <Text className="font-bold text-blue-500"> Upgrade to Unlimited</Text>
                  )}
                </TouchableOpacity>
                {subscriptionInfo?.plan?.id !== 'free' && (
                  <Text> for faster </Text>
                )}
              </View>
              {subscriptionInfo?.plan?.id !== 'free' && (
                <>
                  <View className="flex-row justify-center">
                    <Text>progress or </Text>
                    <TouchableOpacity
                      onPress={() => Linking.openURL('https://support.languatalk.com/article/144-why-is-there-a-limit-on-communicate-ai-chat')}
                    >
                      <Text className="text-blue-500">see our tips </Text>
                    </TouchableOpacity>
                    <Text>on making conversations last </Text>
                  </View>
                  <Text className="text-center">longer.</Text>
                </>
              )}
            </View>
          </View>
        ) : (
          renderInputArea()  // ChatInputBar is rendered here
        )}

        {/* Add the dropdown menu */}
        {showMenu && (
          <Modal 
            transparent={true} 
            animationType="fade" 
            onRequestClose={() => {
              setShowMenu(false);
              // Only resume if audio was playing before modal opened
              if (previousPlayingMessage?.wasPlaying) {
                handlePlayAudio(
                  previousPlayingMessage.audioUrl,
                  previousPlayingMessage.wordTimings,
                  previousPlayingMessage.messageId,
                  previousPlayingMessage.text
                );
                setPreviousPlayingMessage(null);
              }
            }}
          >
            <TouchableWithoutFeedback onPress={() => {
              setShowMenu(false);
              // Only resume if audio was playing before modal opened
              if (previousPlayingMessage?.wasPlaying) {
                handlePlayAudio(
                  previousPlayingMessage.audioUrl,
                  previousPlayingMessage.wordTimings,
                  previousPlayingMessage.messageId,
                  previousPlayingMessage.text
                );
                setPreviousPlayingMessage(null);
              }
            }}>
              <View style={styles.modalOverlay}>
                <View style={styles.menuContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowMenu(false);
                      handleChatSettings();
                    }}
                    style={styles.menuItem}
                  >
                    <Text style={[GlobalFontStyleSheet.textMd, styles.menuItemText]}>Settings</Text>
                  </TouchableOpacity>

                  {Platform.OS === 'ios' ? (
                    <TouchableOpacity
                      onPress={() => {
                        openHelpScout(userSettings?.user);
                      }}
                      style={styles.menuItem}
                    >
                      <Text style={[GlobalFontStyleSheet.textMd, styles.menuItemText]}>Help Articles</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => {
                        setShowMenu(false);
                        router.push('/help');
                      }}
                      style={styles.menuItem}
                    >
                      <Text style={[GlobalFontStyleSheet.textMd, styles.menuItemText]}>Help Articles</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={async () => {
                      setShowMenu(false);
                      
                      try {
                        // First, fetch the chat data to trigger server-side call limit check
                        const response = await fetch(`${API_URL}/api/v1/chats/${chatData?.chat.id}?call_mode=true`, {
                          headers: {
                            'Authorization': `${token}`,
                            'Content-Type': 'application/json',
                          },
                        });

                        if (!response.ok) {
                          const data = await response.json();
                          if (
                            response.status === 403 &&
                            typeof data.error === 'string' &&
                            data.error.toLowerCase().includes('call limit')
                          ) {
                            setShowCallTimeLimitModal(true);
                            return;
                          }
                          throw new Error('Failed to fetch chat data');
                        }

                        // If server allows it, also do client-side check as backup
                        if (user?.id) {
                          const limitExceeded = await hasExceededCallLimit(
                            user.id.toString(), 
                            subscriptionInfo?.plan?.id, 
                            subscriptionInfo?.plan?.name, 
                            subscriptionInfo?.plan?.product_id
                          );
                          
                          if (limitExceeded) {
                            setShowCallTimeLimitModal(true);
                            return;
                          }
                        }
                        
                        // Navigate to call mode if both checks pass
                        router.replace({
                          pathname: '/(tabs)/speak/call',
                          params: { chatId: chatData?.chat.id }
                        });
                      } catch (error) {
                        console.error('Error in Continue call mode:', error);
                      }
                    }}
                    style={styles.menuItem}
                  >
                    <Text
                      style={[GlobalFontStyleSheet.textMd, styles.menuItemText]}
                    >
                      Continue in call mode
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setShowMenu(false);
                      handleEndChat();
                    }}
                    style={styles.menuItem}
                  >
                    <Text style={[GlobalFontStyleSheet.textMd, styles.menuItemText]}>End Chat & Get Feedback</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        )}
      </KeyboardAvoidingView>
      
      <ChatSettingsModal
        isVisible={showSettings}
        onClose={() => setShowSettings(false)}
        chatSettings={chatData?.chat}
        chatOptions={chatData?.chat_form_options}
        onSettingChange={handleSettingsChange}
        disableGuidedMode={chatData?.chat.topic_category === 'vocab' || chatData?.chat.topic_category === 'grammar'}
      />
      <EndChatModal
        isVisible={showEndChatModal}
        onClose={() => setShowEndChatModal(false)}
        userMessagesCount={chatData?.messages.filter(m => m.role === 'user').length || 0}
        chatId={chatData?.chat.id || 0}
      />
      <CorrectionModal
        isVisible={showCorrectionModal && !showPointsModal}
        onClose={() => {
          isModalOpenRef.current = false; // Reset the ref when modal closes
          setShowCorrectionModal(false);
          setSelectedMessageForCorrection(null);
          setIsCorrectionLoading(false);
          
          // Only resume if audio was playing before modal opened
          if (previousPlayingMessage?.wasPlaying) {
            handlePlayAudio(
              previousPlayingMessage.audioUrl,
              previousPlayingMessage.wordTimings,
              previousPlayingMessage.messageId,
              previousPlayingMessage.text
            );
            setPreviousPlayingMessage(null);
          }
          
          // Flush any pending audio messages queued while the modal was open
          pendingAudioMessagesRef.current.forEach((msg) => {
            if (msg.audio_url) {
              handlePlayAudio(
                msg.audio_url,
                msg.word_timings,
                msg.chat_message_id,
                msg.content
              );
            }
          });
          pendingAudioMessagesRef.current = [];
        }}
        onOpen={() => {
          isModalOpenRef.current = true; // Set the ref when modal opens
          // Store playing state when storing message info
          if (currentPlayingMessageId) {
            const playingMessage = chatData?.messages.find(
              msg => msg.chat_message_id === currentPlayingMessageId
            );
            if (playingMessage) {
              setPreviousPlayingMessage({
                messageId: playingMessage.chat_message_id,
                audioUrl: playingMessage.audio_url,
                wordTimings: playingMessage.word_timings,
                text: playingMessage.content,
                wasPlaying: audioPlayerService.isPlaying
              });
            }
          }
          // Stop the current audio
          if (audioPlayerService.isPlaying) {
            audioPlayerService.pauseSound();
            setCurrentPlayingMessageId(null);
          }
        }}
        correction={selectedMessageForCorrection?.correction || ''}
        correctionExplanation={selectedMessageForCorrection?.correction_explanation}
        onRequestExplanation={() => {
          if (selectedMessageForCorrection) {
            handleCorrectionExplanation(selectedMessageForCorrection);
          }
        }}
        isLoading={isCorrectionLoading}
        language={chatData?.chat.language}
        targetLanguage={userSettings?.team.langua_native_language || 'english'}
        onWordTranslated={handleWordTranslated}
        onWordSaved={handleWordSaved}
      />
      <AlternativeResponseModal
        languageCode={chatData?.chat.language}
        targetLanguage={userSettings?.team.langua_native_language || 'english'}
        isVisible={showAlternativeModal}
        voice={chatData?.chat.voice || ''}
        voice_provider={chatData?.chat.voice_provider || ''}
        onClose={() => {
          isModalOpenRef.current = false; // Reset the ref when modal closes
          setShowAlternativeModal(false);
          setSelectedMessageForAlternative(null);
          setIsAlternativeLoading(false);
          
          // Only resume if audio was playing before modal opened
          if (previousPlayingMessage?.wasPlaying) {
            handlePlayAudio(
              previousPlayingMessage.audioUrl,
              previousPlayingMessage.wordTimings,
              previousPlayingMessage.messageId,
              previousPlayingMessage.text
            );
            setPreviousPlayingMessage(null);
          }
        }}
        onOpen={() => {
          isModalOpenRef.current = true; // Set the ref when modal opens
          // Store playing state when storing message info
          if (currentPlayingMessageId) {
            const playingMessage = chatData?.messages.find(
              msg => msg.chat_message_id === currentPlayingMessageId
            );
            if (playingMessage) {
              setPreviousPlayingMessage({
                messageId: playingMessage.chat_message_id,
                audioUrl: playingMessage.audio_url,
                wordTimings: playingMessage.word_timings,
                text: playingMessage.content,
                wasPlaying: audioPlayerService.isPlaying
              });
            }
          }
          // Stop the current audio
          if (audioPlayerService.isPlaying) {
            audioPlayerService.pauseSound();
            setCurrentPlayingMessageId(null);
          }
        }}
        alternativeResponse={selectedMessageForAlternative?.alternative_response || ''}
        isLoading={isAlternativeLoading}
        voice={chatData?.chat.voice || ''}
        onWordTranslated={handleWordTranslated}
        onWordSaved={handleWordSaved}
      />
      <VocabWordModal
        visible={isVocabModalVisible}
        onClose={() => {
          setIsVocabModalVisible(false);
          setSelectedVocabWord(null);
          setSelectedSentence(null);
          setIsPhrase(false);
          
          // When closing the modal, resume the previously playing audio if it was playing before the modal opened
          if (previousPlayingMessage && previousPlayingMessage.wasPlaying) {
            handlePlayAudio(
              previousPlayingMessage.audioUrl,
              previousPlayingMessage.wordTimings,
              previousPlayingMessage.messageId,
              previousPlayingMessage.text
            );
            setPreviousPlayingMessage(null);
          }
        }}
        onOpen={() => {
          // When the modal opens, check if any audio is currently playing and store it (then pause it)
          if (audioPlayerService.isPlaying && currentPlayingMessageId) {
            const playingMessage = chatData?.messages.find(
              (msg) => msg.chat_message_id === currentPlayingMessageId
            );
            if (playingMessage) {
              setPreviousPlayingMessage({
                messageId: playingMessage.chat_message_id,
                audioUrl: playingMessage.audio_url,
                wordTimings: playingMessage.word_timings,
                text: playingMessage.content,
                wasPlaying: audioPlayerService.isPlaying
              });
            }
          }
          // Pause the current audio if it's playing
          if (audioPlayerService.isPlaying) {
            audioPlayerService.pauseSound();
            setCurrentPlayingMessageId(null);
          }
        }}
        word={selectedVocabWord || ''}
        language={chatData?.chat.language}
        targetLanguage={userSettings?.team.langua_native_language || 'english'}
        contextSentence={selectedSentence || ''}
        isPhrase={isPhrase}
        onWordTranslated={handleWordTranslated}
        onWordSaved={handleWordSaved}
      />
      
      {showPermissionRequest && (
        <MicrophonePermissionRequest 
          onRequestPermission={handleRequestPermission}
          errorType={microphoneErrorType}
        />
      )}
      <TranslationModal
        visible={isTranslationModalVisible}
        onClose={() => {
          setIsTranslationModalVisible(false);
          // Only resume if audio was playing before modal opened
          if (previousPlayingMessage?.wasPlaying) {
            handlePlayAudio(
              previousPlayingMessage.audioUrl,
              previousPlayingMessage.wordTimings,
              previousPlayingMessage.messageId,
              previousPlayingMessage.text
            );
            setPreviousPlayingMessage(null);
          }
        }}
        onOpen={() => {
          // Store playing state when storing message info
          if (currentPlayingMessageId) {
            const playingMessage = chatData?.messages.find(
              msg => msg.chat_message_id === currentPlayingMessageId
            );
            if (playingMessage) {
              setPreviousPlayingMessage({
                messageId: playingMessage.chat_message_id,
                audioUrl: playingMessage.audio_url,
                wordTimings: playingMessage.word_timings,
                text: playingMessage.content,
                wasPlaying: audioPlayerService.isPlaying
              });
            }
          }
          // Stop the current audio
          if (audioPlayerService.isPlaying) {
            audioPlayerService.pauseSound();
            setCurrentPlayingMessageId(null);
          }
        }}
        translation={currentTranslation || ''}
        originalText={currentOriginalText || ''}
      />
      <UserPointsModal
        isVisible={showPointsModal}
        onClose={async (resumeAudio: boolean) => { // updated to accept resumeAudio flag
          await resetAllMessageCounts();

          // Reset the in-memory counts
          userMessageCountRef.current = {};
          isModalOpenRef.current = false;
          setShowPointsModal(false);

          resumeAudioRef.current = resumeAudio;
          // Only resume pending audio if the user is staying in chat.
          if (resumeAudio) {
            // Increase the timeout delay from 300ms to 600ms to allow state to settle.
            setTimeout(() => {
              if (pendingAIResponseRef.current) {
                const messageToAdd = pendingAIResponseRef.current;
                pendingAIResponseRef.current = null;
                setDelayAIResponse(false);

                setChatData(prevData => ({
                  ...prevData!,
                  messages: [...prevData!.messages, messageToAdd],
                }));

                if (messageToAdd.audio_url) {
                  handlePlayAudio(
                    messageToAdd.audio_url,
                    messageToAdd.word_timings,
                    messageToAdd.chat_message_id,
                    messageToAdd.content
                  );
                }
              }

              pendingAudioMessagesRef.current.forEach(msg => {
                if (msg.audio_url) {
                  handlePlayAudio(
                    msg.audio_url,
                    msg.word_timings,
                    msg.chat_message_id,
                    msg.content
                  );
                }
              });
              pendingAudioMessagesRef.current = [];
            }, 600); // increased delay
          }
        }}
        token={token}
        colorScheme={colorScheme}
        chatId={chatData?.chat.id || null}
      />
      <CallModeLimitReachedModal
        isVisible={showCallTimeLimitModal}
        onClose={() => setShowCallTimeLimitModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  messageList: {
    paddingVertical: 16,
  },
  messageWrapper: {
    marginBottom: 24,
    marginHorizontal: isTablet ? 64 : 5,
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
    borderRadius: isTablet ? 30 : 20,
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
  hiddenText: {
    backgroundColor: 'rgba(61, 71, 82, 0.1)',
    color: 'transparent',
  },
  aiTranslationText: {
    marginLeft: 20,
    marginTop: 4,
  },
  userTranslationText: {
    marginTop: 4,
    color: '#4B5563', // Changed from white to a darker gray
    opacity: 0.9,
  },
  correctionText: {
    marginTop: 4,
    color: '#4B5563', // Changed from white to a darker gray
    fontWeight: '400',
  },
  correctionExplanationText: {
    marginTop: 4,
    color: '#4B5563', // Changed from white to a darker gray
    fontWeight: '400',
  },
  alternativeResponseText: {
    marginTop: 4,
    color: '#fff',
    fontWeight: '400',
  },
  avatarContainer: {
    position: 'absolute',
    bottom: -10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userAvatarContainer: {
    right: -10,
  },
  aiAvatarContainer: {
    left: -10,
  },
  messageActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 5,
    marginLeft: 30, // Align with the message bubble
  },
  userMessageActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    marginRight: 8,
    gap: 8,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#00448f', // Keep the action buttons blue
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
  },
  correctionOuterContainer: {
    marginTop: 8,
    marginBottom: 4,
    marginLeft: 40, // Indent from the left to align with message content
  },
  correctionOuterContainerLight: {
    backgroundColor: 'transparent',
  },
  correctionOuterContainerDark: {
    backgroundColor: 'transparent',
  },
  correctionInnerContainer: {
    borderLeftWidth: 2,
    borderLeftColor: '#059669', // Green accent
    paddingLeft: 12,
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
  menuItemText: {
    // Remove color here and use className instead
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
    marginLeft: 'auto', // This will push the button to the right
    backgroundColor: '#00488f',
    borderRadius: 4,
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
    marginBottom: 0, // Keep actions close to user message
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
  greenCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
});

