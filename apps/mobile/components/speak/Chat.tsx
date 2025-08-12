import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Linking,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter, Stack, useNavigation, useFocusEffect } from "expo-router";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import {
  faEllipsisVertical,
  faChevronLeft,
} from "@fortawesome/free-solid-svg-icons";
import { faPhone } from "@fortawesome/pro-solid-svg-icons/faPhone";
import { faTriangleExclamation } from "@fortawesome/pro-solid-svg-icons";
import cx from "classnames";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useAuth } from "@/contexts/AuthContext";
import { API_URL } from "@/constants/api";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import AudioPlayerService from "@/services/AudioPlayerService";
import { AlternativeResponseService } from "@/services/AlternativeResponseService";
import { TextCorrectionService } from "@/services/TextCorrectionService";
import { CorrectionExplanationService } from "@/services/CorrectionExplanationService";
import { SuggestedReplyService } from "@/services/SuggestedReplyService";
import { GuidedModeReplyService } from "@/services/GuidedModeReplyService";
import GuidedModeReplyModal from "@/components/speak/GuidedModeReplyModal";
import * as Haptics from "expo-haptics";
import SuggestedRepliesModal from "@/components/SuggestedRepliesModal";
import ChatSettingsModal from "@/components/ChatSettingsModal";
import EndChatModal from "@/components/EndChatModal";
import { useWebSocket } from "@/contexts/ActionCableWebSocketContext";
import { GlobalFontStyleSheet, getIconSize } from "@/constants/Font";
import useDevice from "@/hooks/useDevice";
import ChatInputBar from "@/components/speak/ChatInputBar";
import LoadingDots from "@/components/LoadingDots";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { MessageItem } from "@/components/speak/MessageItem";
import CorrectionModal from "@/components/speak/CorrectionModal";
import AlternativeResponseModal from "@/components/speak/AlternativeResponseModal";
import VocabWordModal from "@/components/speak/VocabWordModal";
import LimitReachedModal from "@/components/pricing/LimitReachedModal";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import MicrophonePermissionRequest from "@/components/speak/MicrophonePermissionRequest";
import { getTranscriptionModel } from "@/constants/TranscriptionOptions";
import TranslationModal from "@/components/speak/TranslationModal"; // Import TranslationModal
import UserPointsModal from "@/components/speak/UserPointsModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { openHelpScout } from "@/components/helpscout";
import useUserSettings from "@/services/api/useUserSettings";
import useUserSubscription from "@/services/api/useUserSubscription";
import { storeAudioUri } from "@/services/AsyncAudioStorageService";
import VoiceRecognition from "@/components/speak/VoiceRecognition";
import { AUTO_SEND_THRESHOLD } from "@/constants/Lists";
import { useFeatureFlag } from "posthog-react-native";
import AudioRecorder, {
  AudioRecorderHandle,
} from "@/components/speak/AudioRecorder";
import BouncingDots from "@/components/BouncingDots";
import { usePolling } from "@/hooks/usePolling";
import { ChatData, Message, ProcessedMessage, HighlightMode } from "@/types/chat";
import { ChatWordsService } from "@/services/ChatWordsService";
import { hasExceededCallLimit } from "@/services/CallTimeService";
import CallModeLimitReachedModal from "@/components/pricing/CallModeLimitReachedModal";
import { processGenericContent } from "@/utils/textProcessingUtils";
// Context Consumers
import { useChatData } from "@/contexts/ChatDataContext";
import { useSelection } from "@/contexts/SelectionContext";
import { useReadingAid } from '@/contexts/ReadingAidContext';
import { useAlternativeResponse } from "@/contexts/AlternativeResponseContext";
import { useCorrection } from "@/contexts/CorrectionContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { useSuggestions } from "@/contexts/SuggestionsContext";

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
  const tag = "chat_recording";

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
const STORAGE_KEY_PREFIX = "chat_message_count_";
const LAST_SHOWN_DATE_KEY = "lastPointsModalDate";

export function Chat({ isChatFlagged, isUsingJapanesePronunciation }: { isChatFlagged: boolean, isUsingJapanesePronunciation: boolean }) {
  const navigation = useNavigation();
  const { readingAidService, isJapaneseReadingAidEnabledAndReady, setChatLanguage, isJapaneseReadingAidLoading } = useReadingAid();
  const readingAidRef = useRef({ readingAidService, isJapaneseReadingAidEnabledAndReady });
  // Update ref whenever values change
  readingAidRef.current = { readingAidService, isJapaneseReadingAidEnabledAndReady };

  const colorScheme = useColorScheme() ?? "light";
  const router = useRouter();
  const { token } = useAuth();
  const { subscriptionInfo, loading: subscriptionLoading } =
    useUserSubscription();
  // const { initialData } = useLocalSearchParams();
  // state from the ChatContext
  const { state: chatDataState, dispatch: chatDataDispatch, addMessage, updateMessages, updateChatSetting } = useChatData();
  // destructure the state from the ChatContext
  const { chat, messages, displayMessages, user, message_limit_reached, chat_form_options } =
    chatDataState || {};

  // temporary variable for chat id
  const chatId = chat?.id;

  const [loading, setLoading] = useState(!!chat);

  // const [chatData, setChatData] = useState<ChatData | null>(initialData ? JSON.parse(initialData as string) : null);

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playingSlowAudioId, setPlayingSlowAudioId] = useState<string | null>(
    null
  );
  const audioPlayerService = useRef(new AudioPlayerService()).current;
  const audioChunksRef = useRef<string[]>([]);
  const wordTimingsRef = useRef<any>(null);
  const [currentPlayingMessageId, setCurrentPlayingMessageId] = useState<
    string | null
  >(null);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const pendingAssistantMessagesRef = useRef<
    Record<string, PendingAssistantMessage>
  >({});
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
      console.log('[FLAGGED] Cleaned up playedAudioMessagesRef to', MAX_PLAYED_AUDIO_MESSAGES, 'entries');
    }
  };

  // Remove the recording state, only keep isRecording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const isLongPressRef = useRef(false);


  const alternativeResponseService = new AlternativeResponseService(
    token ?? ""
  );
  const suggestedReplyService = new SuggestedReplyService(token ?? ""); // Initialize the service
  const guidedModeReplyService = new GuidedModeReplyService(token ?? "");
  const chatWordsService = new ChatWordsService(token ?? ""); // Initialize the ChatWordsService

  const [isSuggestReplyPulsing, setIsSuggestReplyPulsing] = useState(false);

  const [isGuidedModeReplyVisible, setIsGuidedModeReplyVisible] =
    useState(false);
  const [guidedModeReply, setGuidedModeReply] = useState<{
    suggestion: string | ProcessedMessage;
    translation: string;
  } | null>(null);
  const [isGuidedModeReplyLoading, setIsGuidedModeReplyLoading] =
    useState(false);
  const [isGuidedModeReplyLoadingTimeout, setIsGuidedModeReplyLoadingTimeout] =
    useState(false);

  const autoRecordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAddedMessageIdRef = useRef<string | null>(null);

  const {
    selectedVocabWord,
    selectedSentence,
    isPhrase,
    activePhraseSelectionMessageId,
    setSelectedVocabWord,
    setSelectedSentence,
    setIsPhrase,
    setActivePhraseSelectionMessageId,
} = useSelection();


  // autoRecordRef.current = chat.auto_record || false;
  // autoSendRef.current = chat.auto_send || false;
  // autoSendThresholdRef.current = chat.auto_send_threshold || AUTO_SEND_THRESHOLD.normal;
  // autoCorrectRef.current = chat.auto_correct || false;
  // guidedModeRef.current = chat.guided_mode || false;
  // autoTranslateRef.current = chat.auto_translate || "off";
  // transcriptionModeRef.current = chat.transcription_mode || "v1";
  // transcriptionModelRef.current = determineModel(
  //   chat.transcription_mode || "whisper-1"
  // );
  // highlightModeRef.current = chat.highlight_mode || "word";
  // isInitializedRef.current = true;

  // const autoRecordRef = useRef(false);
  // const autoSendRef = useRef(false);
  // const autoSendThresholdRef = useRef(AUTO_SEND_THRESHOLD.normal);
  // const autoCorrectRef = useRef<boolean>(false);
  // const guidedModeRef = useRef<boolean>(false);
  // const autoTranslateRef = useRef<string>("off");
  // const highlightModeRef = useRef("word");
  // const transcriptionModeRef = useRef("v1");
  // const transcriptionModelRef = useRef("whisper-1");
  // const isInitializedRef = useRef(false);

  const lastMessageRef = useRef<{
    messageId: string;
    messageText: string;
  } | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showEndChatModal, setShowEndChatModal] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const {
    connectWebSocket,
    closeWebSocket,
    closeAllWebSockets,
    onMessage,
    removeMessageListener,
    connectionStatus,
    retryCount,
    isConnected,
    waitForConnection,
  } = useWebSocket();

  // Use correction context
  const { 
    selectedMessage: selectedMessageForCorrection, 
    processedCorrection,
    isVisible: showCorrectionModal, 
    isLoading: isCorrectionLoading, 
    fetchAndShowCorrection, 
    handleWebSocketCorrection, 
    handleWebSocketCorrectionExplanation, 
    requestCorrectionExplanation, 
    hideCorrectionModal 
  } = useCorrection();

  // Use alternative response context
  const { alternativeResponse, setAndProcessAlternativeResponse, fetchAndShowAlternativeResponse, handleWebSocketAlternativeResponse, isVisible: showAlternativeModal, hideAlternativeModal, isLoading: isAlternativeLoading } = useAlternativeResponse();
  // Add state for error type
  const [microphoneErrorType, setMicrophoneErrorType] = useState<
    "permission" | "initialization" | "connection" | "generic"
  >("permission");

  // Add this with other state declarations at the top of ChatScreen
  const [showPermissionRequest, setShowPermissionRequest] = useState(false);
  const [showCallTimeLimitModal, setShowCallTimeLimitModal] = useState(false);

  // Use translation context
  const { 
    showTranslationModal, 
    hideTranslationModal, 
    isVisible: isTranslationModalVisible,
    currentTranslation,
    currentOriginalText,
    processedOriginalText,
  } = useTranslation();

  // Use suggestions context
  const {
    suggestions,
    processedSuggestions,
    isVisible: isSuggestionsModalVisible,
    isLoading: isSuggestionsLoading,
    showSuggestionsModal,
    hideSuggestionsModal,
    handleWebSocketSuggestions,
  } = useSuggestions();

  // Add this state to track if the input has text
  const [hasText, setHasText] = useState(false);


  const [showPointsModal, setShowPointsModal] = useState(false);
  const messageCountRef = useRef(0);
  const userMessageCountRef = useRef<{ [chatId: string]: number }>({});
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

  const [pendingUserAudio, setPendingUserAudio] =
    useState<PendingUserAudio | null>(null);
  const pendingUserAudioRef = useRef<PendingUserAudio | null>(null); // Add this ref

  const voiceRecognitionRef = useRef<any>(null);
  const useNewVADSystem =
    useFeatureFlag("new_auto_send_logic") && Platform.OS === "ios";
  useConditionalKeepAwake(isRecording);
  const useTranscriptionCloudflareWorker = useFeatureFlag(
    "use_transcription_cloudflare_worker"
  );
  const guidedModeFlag = useFeatureFlag("guided_mode");
  const usePollingSystem = useFeatureFlag("use_polling");

  const chatMessageIds = useRef<string[]>([]);
  // Add this constant for the storage key prefix
  const POINTS_MODAL_KEY_PREFIX = "pointsModalShown_";

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
      console.error("Error saving message count:", error);
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
      console.error("Error loading message count:", error);
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
        (key) =>
          key.startsWith(STORAGE_KEY_PREFIX) &&
          key.includes(`_${userSettings.user.id}_`)
      );

      // Reset all message counts in AsyncStorage and in memory
      for (const key of userMessageCountKeys) {
        await AsyncStorage.removeItem(key);
      }

      console.log("Reset all message counts for user:", userSettings.user.id);
    } catch (error) {
      console.error("Error resetting message counts:", error);
    }
  };
  // Add function to determine model based on transcription mode
  const determineModel = useCallback(
    (transcriptionMode: string) => {
      if (chat_form_options?.transcription_model_options?.[transcriptionMode]) {
        return chat_form_options.transcription_model_options[transcriptionMode]
          .model;
      }

      // Use the new helper function as fallback
      return getTranscriptionModel(transcriptionMode);
    },
    [chat_form_options?.transcription_model_options]
  );

  // Add a helper function to check connection before actions
  const ensureWebSocketConnection = async (): Promise<boolean> => {
    if (!chat?.id) return false;

    if (!isConnected(chat.id)) {
      connectWebSocket(chat.id, {
        name: "ChatChannel",
        params: { chat_id: chat.id },
      });
      return await waitForConnection(chat.id);
    }
    return true;
  };

  const handleFirstPlaybackFinished = useCallback((chatMessageId: string) => {
    if (chatMessageId === lastAddedMessageIdRef.current) {
      handleAutoRecord();
    }
  }, []);

  const handleAutoRecord = () => {
    if (chat?.auto_record) {
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

  // Add debounce to prevent multiple rapid sends
  const [isSending, setIsSending] = useState(false);

  // Add new state for tracking message send time - only used when usePollingSystem is true
  const [forcedTimeout, setForcedTimeout] = useState(false);
  const [showIntermediateTimeout, setShowIntermediateTimeout] = useState(false);

  const sendMessage = async (msg?: string) => {
    // Prevent multiple sends while one is in progress
    if (isSending || !chat) return;

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
            if (chat?.id) {
              closeWebSocket(Number(chat.id), "ChatChannel");
            }
          }, 5000); // 5 more seconds
        }, 10000); // First 5 seconds
      }

      // Try to ensure WebSocket connection, but don't return early if failed
      // This way, the user's message remains visible even if connection fails
      if (!(await ensureWebSocketConnection())) {
        setErrorMessage("Please wait for connection to be established...");
        return;
      }

      const response = await fetch(`${API_URL}/api/v1/chats/${chat.id}`, {
        method: "PUT",
        headers: {
          Authorization: `${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: messageToSend,
          subtopic: chat.subtopic_category,
          topic: chat.topic,
          subtopic_category: chat.subtopic_category,
          debug: false,
          client_provider: chat.client_provider,
          model: chat.model,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setIsWaitingForResponse(false);
    } finally {
      setSending(false);
      setMessage(msg ? "" : "");
      setHasText(false);
      // Add small delay before allowing next send
      setTimeout(() => {
        setIsSending(false);
      }, 1000);
    }
  };

  const handleChatMessage = useCallback(
    (messageData: any) => {
      // Skip initial "Hi" message
      if (messageData.role === "user" && messageData.content === "Hi") {
        return;
      }

      // Only process user messages in the current chat
      if (messageData.role === "user" && chat?.id) {
        const chatId = chat.id.toString();

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
          console.log("currentCount", currentCount);
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
      if (
        (showPointsModal || delayAIResponse) &&
        messageData.role === "assistant"
      ) {
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

        if (newMessage.role === "user" && pendingUserAudioRef.current) {
          storeAudioUri(
            newMessage.chat_message_id,
            pendingUserAudioRef.current.audioUri
          ).catch((error) => console.error("Error storing audio URI:", error));

          pendingUserAudioRef.current = null;

          setPendingUserAudio(null);
        }

        if (newMessage.role === "user" || chat?.mode === "text_only") {
          // chatDataDispatch({ type: "addMessage", payload: newMessage });
          // TODO: how do we trigger auto-correction? without the updatedData?

          // update the chat data in the context
          addMessage(newMessage);

          // Only trigger auto-correction after the message has been added
          if (newMessage.role === 'user' && chat?.auto_correct) {
            handleAutoCorrection(newMessage);
          }
        } else {
          pendingAssistantMessagesRef.current[messageData.chat_message_id] = {
            ...pendingAssistantMessagesRef.current[messageData.chat_message_id],
            message: newMessage,
          };
          checkAndAddAssistantMessage(messageData.chat_message_id);
        }
      }
    },
    [chat, showPointsModal, delayAIResponse, checkAndAddAssistantMessage]
  );

  const handleAutoCorrection = useCallback(
    async (message: Message) => {
      if (!chat) return;

      try {
        // Find the previous AI message for context
        const previousAIMessage = displayMessages?.find(
          (msg) => msg.role === "assistant"
        );

        // Use the context to fetch correction
        await fetchAndShowCorrection(message, previousAIMessage, chat, ensureWebSocketConnection);
        // The correction will be handled by the WebSocket in the `correction` case
      } catch (error) {
        console.error("Error fetching auto-correction:", error);
      }
    },
    [chat, fetchAndShowCorrection, ensureWebSocketConnection]
  );

  const handleWordPress = async (
    word: string,
    chatMessageId: string,
    sentence: string,
    isPhrase: boolean
  ) => {
    triggerHaptic();

    // Store the currently playing message info before stopping it
    if (currentPlayingMessageId) {
      const playingMessage = messages?.find(
        (msg) => msg.chat_message_id === currentPlayingMessageId
      );
      if (playingMessage) {
        setPreviousPlayingMessage({
          messageId: playingMessage.chat_message_id,
          audioUrl: playingMessage.audio_url,
          wordTimings: playingMessage.word_timings,
          text: playingMessage.content,
          wasPlaying: audioPlayerService.isPlaying,
        });
      }
    }

    // Stop the current audio
    if (audioPlayerService.isPlaying) {
      await audioPlayerService.pauseSound();
      setCurrentPlayingMessageId(null);
    }

    const cleanWord = word.replace(
      /^[.,!?¿¡;:()《》「」『』（）、。！？]+|[.,!?¿¡;:()《》「」『』（）、。！？]+$/g,
      ""
    );
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
        const prevTimings = wordTimingsRef.current || {
          chars: [],
          charStartTimesMs: [],
          charDurationsMs: [],
        };
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
          (start: number, index: number) => start + newCharDurationsMs[index]
        );

        return {
          chars: newChars,
          charStartTimesMs: newCharStartTimesMs,
          charEndTimesMs: newCharEndTimesMs,
          charDurationsMs: newCharDurationsMs,
        };
      })();
    }
    if (message.audio.audioType.includes("mp3")) {
      audioChunksRef.current = [
        ...audioChunksRef.current,
        atob(message.audio.audio),
      ];
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

      if ([" ", ",", ".", null].includes(char)) {
        const word = timings.chars.slice(wordIndex, i).join("");
        if (word !== "") {
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
      word_durations_ms: wordDurationsMs,
    };
  };

  const handleFinalAudio = async (message: any) => {
    if (chat?.mode === "text_only") {
      // Ignore audio in text_only mode
      return;
    }

    const combinedAudioData = audioChunksRef.current.join("");
    const base64AudioData = btoa(combinedAudioData);

    // Generate a unique filename for the audio file
    const audioFilename = `${FileSystem.documentDirectory}audio_${message.chat_message_id}.mp3`;

    // Write the base64 audio data to a file
    await FileSystem.writeAsStringAsync(audioFilename, base64AudioData, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Use the file URI as the audioUri
    const audioUri = audioFilename;

    const processedWordTimings = processWordTimings(wordTimingsRef.current);

    pendingAssistantMessagesRef.current[message.chat_message_id] = {
      ...pendingAssistantMessagesRef.current[message.chat_message_id],
      audio: { audioUri, wordTimings: processedWordTimings },
    };

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
        chat?.highlight_mode || "word",
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
      console.error("Error playing audio:", error);
      setCurrentPlayingMessageId(null);
    }
  };

  const checkAndAddAssistantMessage = useCallback(
    async (chatMessageId: string) => {
      const pendingMessage = pendingAssistantMessagesRef.current[chatMessageId];
      if (pendingMessage && pendingMessage.audio && pendingMessage.message) {
        // Both audio and message are ready
        const newMessage = {
          ...pendingMessage.message,
          audio_url: pendingMessage.audio.audioUri,
          word_timings: pendingMessage.audio.wordTimings,
        };

        // update the chat data in the context
        addMessage(newMessage);
        // chatDataDispatch({ type: "addMessage", payload: newMessage });
        // setChatData(prevData => ({
        //   ...prevData!,
        //   messages: [...prevData!.messages, newMessage],
        // }));

        // Remove the message from pending messages
        delete pendingAssistantMessagesRef.current[chatMessageId];

        // Clear the response timeout to prevent polling from starting
        if (responseTimeoutRef.current) {
          console.log('[FLAGGED] Clearing response timeout to prevent polling');
          clearTimeout(responseTimeoutRef.current);
          responseTimeoutRef.current = null;
        }

        setIsWaitingForResponse(false);
        
        // Clear timeout states when message arrives
        setForcedTimeout(false);
        setShowIntermediateTimeout(false);
        setShowResponseTimeout(false);

        // Update the ref instead of state
        lastAddedMessageIdRef.current = chatMessageId;

        // Add a small delay before playing audio to ensure UI is updated
        setTimeout(() => {
          // Check if audio was already played for this message
          if (playedAudioMessagesRef.current.has(chatMessageId)) {
            console.log('[FLAGGED] Audio already played for message:', chatMessageId, '- skipping');
            return;
          }
          
          // Only play if no modal is open and audio isn't already playing
          if (
            !isModalOpenRef.current &&
            !audioPlayerService.isPlaying &&
            resumeAudioRef.current
          ) {
            console.log('[FLAGGED] Playing audio for message:', chatMessageId);
            addPlayedAudioMessage(chatMessageId);
            handlePlayAudio(
              newMessage.audio_url,
              newMessage.word_timings,
              chatMessageId,
              newMessage.content
            );
          } else {
            // Queue the message for later playback
            pendingAudioMessagesRef.current.push(newMessage);
          }
        }, 100);
      }
    },
    [chat, handlePlayAudio, isModalOpenRef.current]
  );

  const handlePlaySlowAudio = async (
    item: Partial<ProcessedMessage>,
    chatMessageId: string,
    slowAudioUrl: string | null,
    text: string
  ) => {
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
            chat?.highlight_mode || "word",
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
        if (!(await ensureWebSocketConnection())) {
          setErrorMessage("Please wait for connection to be established...");
          return;
        }

        const response = await fetch(`${API_URL}/api/v1/slow_audio`, {
          method: "POST",
          headers: {
            Authorization: `${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content_type: "Chat",
            audio_url: item.audio_url?.startsWith("file://")
              ? null
              : item.audio_url,
            content_id: chat?.id,
            chat_message_id: chatMessageId,
            speed: 0.75,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to request slow audio");
        }
      }
    } catch (error) {
      console.error("Error with slow audio:", error);
      setPlayingSlowAudioId(null);
    }
  };

  const handleTranslate = async (
    text: string,
    chatMessageId: string,
    target_language: string
  ) => {
    triggerHaptic();
    try {
      // Cancel recording if active
      if (isRecording) {
        cancelRecording();
      }
      const response = await fetch(
        "https://translation-worker.lythamlabs.workers.dev",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sentence: text,
            language: chat?.language,
            target_language: target_language,
            translation_type: "sentence",
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await response.json();
      console.log(data);
      // Update the chat message with the translation
      chatDataDispatch({
        type: "updateMessageProp",
        payload: {
          id: parseInt(chatMessageId, 10),
          translation: data.translation,
        }
      });
      // setChatData(prevData => ({
      //   ...prevData!,
      //   messages: prevData!.messages.map((message: Message) =>
      //     message.chat_message_id === chatMessageId
      //       ? { id: message.id, translation: data.translation, key: 'translation' }
      //       : message
      //   ),
      // }));
    } catch (error) {
      console.error("Error translating message:", error);
      // Optionally, you can show an error message to the user here
    }
  };

  const handleSlowAudioMessage = useCallback(
    async (message: any) => {
      const { chat_message_id, audio_url } = message;

      // Update chat data with new slow audio URL
      // Update the chat message with the translation
      chatDataDispatch({
        type: "updateMessageProp",
        payload: {
          id: parseInt(chat_message_id, 10),
          slow_audio_url: audio_url,
        }
      });
      // setChatData(prevData => ({
      //   ...prevData!,
      //   messages: prevData!.messages.map(msg =>
      //     msg.chat_message_id === chat_message_id
      //       ? { ...msg, slow_audio_url: audio_url }
      //       : msg
      //   ),
      // }));

      try {
        // Find the message that received slow audio
        const targetMessage = messages?.find(
          (msg) => msg.chat_message_id === chat_message_id
        );

        // Create a minimal message object if target message not found
        const messageToUse = targetMessage || {
          chat_message_id,
          word_timings: null, // or use message.word_timings if available in the WebSocket response
        };

        // Play the slow audio
        handlePlaySlowAudio(
          messageToUse,
          chat_message_id,
          audio_url,
          targetMessage?.content || ""
        );
      } catch (error) {
        console.error("Error playing slow audio:", error);
      }
    },
    [messages, handlePlaySlowAudio]
  );

  const getItemType = useCallback((item: Message) => {
    return item.role;
  }, []);

  // if (loading || !chat) {
  //   return (
  //     <View className="flex-1">
  //       <ActivityIndicator size="large" color={Colors[colorScheme]?.tint} />
  //     </View>
  //   );
  // }

  // Create a ref for displayAlternativeResponse similar to displayCorrection
  const displayAlternativeResponse =
    useRef<(response: { chat_message_id: string; text: string }) => void>();

  // Update handleAlternativeResponse to match the pattern we used for handleCorrection
  const handleAlternativeResponse = async (item: Message) => {
    triggerHaptic();

    if (isRecording) {
      cancelRecording();
    }
    
    // Use the context to handle alternative response
    await fetchAndShowAlternativeResponse(item, chat, ensureWebSocketConnection);
  };



  const handleCorrectionExplanation = async (item: Message) => {
    triggerHaptic();
    await requestCorrectionExplanation(item, chat);
  };

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
        transcriptionMode={chat?.transcription_mode || "v1"}
        transcriptionModel={chat?.transcription_model || "whisper-1"}
        isDeepgramConnected={false} // Default to true since we no longer use Deepgram
        handleSuggestedReplies={handleSuggestedReplies}
        startRecording={startRecording}
        stopRecording={stopRecording}
        cancelRecording={cancelRecording}
        sendMessage={() => sendMessage()}
        triggerHaptic={triggerHaptic}
        language={chat?.language || ""} // Add the required language prop
      />
    );
  };

  const handleUpgrade = () => {
    setShowLimitReachedUpgrade(true);
  };

  const handleSuggestedReplies = async () => {
    if (isSuggestReplyPulsing) return;

    triggerHaptic();
    if (!(await ensureWebSocketConnection())) {
      setErrorMessage("Please wait for connection to be established...");
      return;
    }

    if (!chat) return;

    if (isRecording) {
      stopRecording();
    }

    setIsSuggestReplyPulsing(true);
    showSuggestionsModal();

    try {
      // Set the number of messages to retrieve: current + previous ones
      const n = 2; // Current message + 1 previous message

      // Get the last n messages (or fewer if not enough available)
      const lastMessages = messages?.slice(-n);

      // The current message is always the last one
      const currentMessage = lastMessages?.[lastMessages.length - 1]?.content;
      const messageId =
        lastMessages?.[lastMessages.length - 1]?.chat_message_id;

      // Previous messages (if any) joined with a separator
      const previousMessage = lastMessages
        ?.slice(0, -1)
        ?.map((msg) => msg.content)
        ?.join("\n");

      const response = await suggestedReplyService.fetch(
        chat?.id,
        messageId,
        currentMessage,
        chat?.language,
        previousMessage
      );
    } catch (error) {
      console.error("Error fetching suggested replies:", error);
    } finally {
      setIsSuggestReplyPulsing(false);
      // Loading state managed by context
    }
  };

  // Create a ref to track the last message we've seen
  const lastProcessedMessageRef = useRef<string | null>(null);

  const handleGuidedModeReply = async () => {
    triggerHaptic();
    if (!(await ensureWebSocketConnection())) {
      setErrorMessage("Please wait for connection to be established...");
      return;
    }

    if (!chat) return;

    if (isRecording) {
      stopRecording();
    }

    setGuidedModeReply([]);

    setIsGuidedModeReplyLoading(true);

    try {
      // Set the number of messages to retrieve: current + previous ones
      const n = 2; // Current message + 1 previous message

      // Get the last n messages (or fewer if not enough available)
      const lastMessages = messages?.slice(-n);

      // Safety check to make sure we have at least one message
      if (lastMessages?.length === 0) {
        console.error("No messages available for guided mode reply");
        return;
      }

      // The current message is always the last one
      const currentMessage = lastMessages?.[lastMessages.length - 1]?.content;
      const messageId =
        lastMessages?.[lastMessages.length - 1]?.chat_message_id;

      // Previous messages (if any) joined with a separator
      const previousMessage = lastMessages
        ?.slice(0, -1)
        ?.map((msg) => msg.content)
        ?.join("\n");

      const response = await guidedModeReplyService.fetch(
        chat?.id,
        messageId,
        currentMessage || "",
        chat?.language || "",
        previousMessage || ""
      );
    } catch (error) {
      console.error("Error fetching guided mode reply:", error);
    }
  };

  const displaySuggestions = (response: { suggestions: string[] }) => {
    handleWebSocketSuggestions(response, chat?.language || 'english');
    showSuggestionsModal();
  };

  const handleSuggestionSelect = (suggestion: string) => {
    triggerHaptic();
    hideSuggestionsModal();
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

  const handleSettingsChange = async (setting: string, value: string | boolean | number) => {
    // move this api asyc call to ChatSettingsModal, and use handleSettingsChange as the response handler to update audioPlayerService with highlight mode
    // also, audioPlayerService might be moved to it's own AudioPlayerContext - and then the highlight mode will be set in the AudioPlayerContext from the Modal
    const success = await updateChatSetting(setting, value);
    
    if (!success) {
      // Handle error - maybe show a toast
      console.error(`Failed to update ${setting}`);
    }
    
    // Additional logic like updating AudioPlayerService highlight mode
    if (setting === "highlight_mode" && success) {
      audioPlayerService.setHighlightMode(value as HighlightMode, chat?.language);
    }
  };

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
        setMicrophoneErrorType("permission");
      }
    } catch (error) {
      console.error("Error requesting permission:", error);
      setMicrophoneErrorType("generic");
    }
  };

  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  // Calculate dynamic keyboard offset
  const keyboardOffset = Platform.select({
    ios: headerHeight,
    android: insets.bottom + 10, // small buffer
    default: 0,
  });

  const handleCorrection = async (
    item: Message,
    previousMessage: Message | undefined
  ) => {
    triggerHaptic();

    if (isRecording) {
      cancelRecording();
    }

    // Immediately set the flag so no new audio plays
    isModalOpenRef.current = true;

    await fetchAndShowCorrection(item, previousMessage, chat, ensureWebSocketConnection);
  };

  // Add these states near the top of the ChatScreen component
  const [isVocabModalVisible, setIsVocabModalVisible] = useState(false);

  const handleTranslationModalOpen = async (
    translation: string,
    originalText: string
  ) => {
    // Store playing state when storing message info
    if (currentPlayingMessageId) {
      const playingMessage = messages?.find(
        (msg) => msg.chat_message_id === currentPlayingMessageId
      );
      if (playingMessage) {
        setPreviousPlayingMessage({
          messageId: playingMessage.chat_message_id,
          audioUrl: playingMessage.audio_url,
          wordTimings: playingMessage.word_timings,
          text: playingMessage.content,
          wasPlaying: audioPlayerService.isPlaying,
        });
      }
    }
    // Stop the current audio
    if (audioPlayerService.isPlaying) {
      audioPlayerService.pauseSound();
      setCurrentPlayingMessageId(null);
    }

    // Use the translation context to show the modal and get the processed text
    await showTranslationModal(translation, originalText, chat?.language, isChatFlagged, isUsingJapanesePronunciation);
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
      console.error("Error checking modal date:", error);
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
      console.error("Error saving modal date:", error);
    }
  };

  // Update the menu press handler in the Stack.Screen options
  const handleMenuPress = () => {
    // Store playing state when storing message info
    if (currentPlayingMessageId) {
      const playingMessage = messages?.find(
        (msg) => msg.chat_message_id === currentPlayingMessageId
      );
      if (playingMessage) {
        setPreviousPlayingMessage({
          messageId: playingMessage.chat_message_id,
          audioUrl: playingMessage.audio_url,
          wordTimings: playingMessage.word_timings,
          text: playingMessage.content,
          wasPlaying: audioPlayerService.isPlaying,
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

  // Add the helper function to check for mistakes in the correction text.
  const hasMistakes = (correctionText: string) => {
    if (!correctionText) return false;
    return (
      correctionText.includes("→") ||
      correctionText.includes("<del>") ||
      correctionText.includes("<ins>") ||
      correctionText.includes("<b>")
    );
  };

  // Add AudioRecorder ref
  const audioRecorderRef = useRef<AudioRecorderHandle>(null);

  // Add handler functions for AudioRecorder
  const handleRecordingStateChange = useCallback((isRecording: boolean) => {
    setIsRecording(isRecording);
  }, []);

  const handleTranscriptionStateChange = useCallback(
    (isTranscribing: boolean) => {
      setIsTranscribing(isTranscribing);
    },
    []
  );

  const handleMicrophoneError = useCallback(
    (
      errorType: "permission" | "initialization" | "connection" | "generic",
      showModal: boolean
    ) => {
      if (showModal) {
        setMicrophoneErrorType(errorType);
        setShowPermissionRequest(true);
      }
    },
    []
  );

  const handleTranscriptionResult = useCallback(
    (text: string, sendImmediately: boolean) => {
      if (sendImmediately) {
        const newMessage = message.length > 0 ? `${message} ${text}` : text;
        sendMessage(newMessage);
      } else {
        setMessage((prevMessage) => {
          const newMessage =
            prevMessage.length > 0 ? `${prevMessage} ${text}` : text;
          setHasText(newMessage.trim().length > 0);
          return newMessage;
        });
      }
    },
    [message, sendMessage]
  );

  const handlePendingUserAudioChange = useCallback(
    (audio: PendingUserAudio | null) => {
      pendingUserAudioRef.current = audio;
      setPendingUserAudio(audio);
    },
    []
  );

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
  const previousMessagesCountRef = useRef<number>(messages?.length || 0);
  const [hasNewMessage, setHasNewMessage] = useState(false);

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
    responseTimeoutRef,
  } = usePolling({
    token,
    handlePlayAudio,
    usePollingSystem: !!usePollingSystem, // Make sure this variable exists in your component
    setIsWaitingForResponse,
    setIsRefreshing,
  });

  const handleWordTranslated = (word: string, translation: string) => {
    if (!chat) return;

    // Update the chat data in the database
    if (chat?.id) {
      chatWordsService
        .addToTranslatedChats(chat.id, word, translation)
        .then(() => {
          // Update local state after successful API call
          if (chat) {
            const updatedChat = {
              translated_vocabulary: [
                ...(chat.translated_vocabulary || []),
                word,
              ],
            };
            chatDataDispatch({
              type: "updateChatSetting",
              payload: updatedChat,
            });
          }
        })
        .catch((error) => {
          console.error("Error updating translated words:", error);
        });
    }
  };

  const handleWordSaved = (word: string, translation: string) => {
    if (!chat) return;

    // Update the chat data in the database
    if (chat?.id) {
      chatWordsService
        .addToSavedChats(chat.id, word, translation)
        .then(() => {
          // Update local state after successful API call
          if (chat) {
            const updatedChat = {
              saved_vocabulary: [...(chat.saved_vocabulary || []), word],
            };
            chatDataDispatch({
              type: "updateChatSetting",
              payload: updatedChat,
            });
          }
        })
        .catch((error) => {
          console.error("Error updating saved words:", error);
        });
    }
  };

  // ADD UseEffects below this line
  useEffect(() => {
    console.log('isJapaneseReadingAidEnabledAndReady', isJapaneseReadingAidEnabledAndReady);
  }, [isJapaneseReadingAidEnabledAndReady]);

  useEffect(() => {
    if (chat?.language) {
      console.log('********************* SETTING CHAT LANGUAGE *********************', chat.language);
      setChatLanguage(chat.language);
    }
  }, [chat?.language]);


  useEffect(() => {
    if (
      message_limit_reached &&
      !dismissedUpgradeModal &&
      !showLimitReachedUpgrade &&
      !subscriptionLoading
    ) {
      handleShowUpgradeModal();
    }
  }, [message_limit_reached, subscriptionLoading]);

  // Update error message based on connection status with delay
  useEffect(() => {
    if (chat?.id) {
      const status = connectionStatus[chat.id];

      // Clear any existing timeout
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }

      switch (status) {
        case "disconnected":
          // Only show error message if we've exhausted all retry attempts
          if (retryCount[chat.id] >= 3) {
            errorTimeoutRef.current = setTimeout(() => {
              setErrorMessage(
                "Connection lost. Please check your network connection and try again."
              );
            }, 300);
          }
          break;
        case "error":
          if (retryCount[chat.id] >= 3) {
            errorTimeoutRef.current = setTimeout(() => {
              setErrorMessage(
                "Connection error. Please check your network connection."
              );
            }, 300);
          }
          break;
        case "connected":
          setErrorMessage((prev) =>
            prev?.includes("Connection") || prev?.includes("connection")
              ? null
              : prev
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
  }, [connectionStatus, chat?.id, retryCount]);


  useEffect(() => {
    // Subscribe to event when component mounts
    audioPlayerService.on("firstPlaybackFinished", handleFirstPlaybackFinished);

    return () => {
      audioPlayerService.off(
        "firstPlaybackFinished",
        handleFirstPlaybackFinished
      );
      if (autoRecordTimeoutRef.current) {
        clearTimeout(autoRecordTimeoutRef.current);
      }
    };
  }, []);

  // Move cleanup into a separate useEffect for screen unmount
  useEffect(() => {
    return () => {
      console.log("Screen unmounted - cleaning up...");
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
        console.log("Screen focused");
      };

      const onBlur = () => {
        // Handle cleanup only when navigating away
        console.log("Screen lost focus");
        audioPlayerService.stopSound();
        setCurrentPlayingMessageId(null);
        setPlayingSlowAudioId(null);
        closeAllWebSockets();
      };

      onFocus(); // Run focus handler immediately

      return onBlur; // This runs when screen loses focus
    }, [])
  );

  useEffect(() => {
    // Only set up WebSocket when we have chat data
    if (chat?.id) {
      setLoading(false);
      const chatId = chat.id;

      // Connect WebSocket if not already connected
      if (!isConnected(chatId)) {
        connectWebSocket(chatId, {
          name: "ChatChannel",
          params: { chat_id: chatId },
        });
      }

      // Monitor connection status changes
      const checkConnection = setInterval(() => {
        if (!isConnected(chatId)) {
          setErrorMessage("Connection lost.");
        } else if (errorMessage === "Connection lost.") {
          setErrorMessage("");
        }
      }, 3000);

      if (messages?.length === 0) {
        waitForConnection(chatId).then((connected) => {
          if (connected) {
            sendMessage("Hi");
          }
        });
      }

      const handleWebSocketMessage = async (event: MessageEvent) => {
        // Handle both formats - direct data and wrapped in event.data.data
        let messageData = event.data?.data || event.data;
        const messageTypesToIgnore = [
          "correction",
          "correction_explanation",
          "alternative_response",
          "slow_audio",
          "guided_mode",
          "suggested_reply",
          "translation",
        ];
        if (
          chatMessageIds.current.includes(messageData.chat_message_id) &&
          !messageTypesToIgnore.includes(messageData.type)
        ) {
          console.log(
            "message already in chatMessageIds",
            messageData.chat_message_id
          );
          return;
        }
        // Return early if messageData is not an object
        if (!messageData) return;

        // Return early for ping messages
        if (messageData.type === "ping") return;

        switch (messageData.type) {
          case "error":
            setIsWaitingForResponse(false);
            if (messageData.error_type === "message_limit_reached") {
              // update the chat data in the context
              chatDataDispatch({
                type: "updateMessageLimitReached",
                payload: true,
              });
            } else {
              setErrorMessage(
                "AI provider error. Try switching AI model & refreshing the page. If errors persist, start a new conversation & check our help doc."
              );
            }
            break;
          case "user_chat_message":
            handleChatMessage(messageData.message);
            break;
          case "translation":
            break;
          case "suggested_reply":
            displaySuggestions(messageData);
            setIsSuggestReplyPulsing(false);
            break;
          case "guided_mode":
            const { readingAidService: currentService, isJapaneseReadingAidEnabledAndReady: currentReady } = readingAidRef.current;
            // process suggestions
            let processedMessage = messageData.suggestion;
            try {
              processedMessage = await processGenericContent(chat.language, messageData.suggestion, currentService);
            } catch (error) {
              console.error("Error processing message:", error);
              processedMessage = "Error processing message:";
            }

            setGuidedModeReply({
              suggestion: processedMessage,
              translation: messageData.translation,
            });
            setIsGuidedModeReplyVisible(true);
            setIsGuidedModeReplyLoading(false);
            break;
          case "correction":
            handleWebSocketCorrection(messageData, chat.language);
            break;
          case "correction_explanation":
            handleWebSocketCorrectionExplanation(messageData, chat.language);
            break;
          case "alternative_response":
              handleWebSocketAlternativeResponse(messageData, chat.language);
              break;
          case "slow_audio":
            handleSlowAudioMessage(messageData);
            break;
          case "audio":
            handleAudioMessage(messageData);
            break;
          case "final":
            if (!chatMessageIds.current.includes(messageData.chat_message_id)) {
              if (
                lastMessageRef.current?.messageText &&
                chat?.auto_translate === "written"
              ) {
                handleTranslate(
                  lastMessageRef.current?.messageText,
                  lastMessageRef.current?.messageId,
                  messageData.target_language
                );
              }

              chatMessageIds.current.push(messageData.chat_message_id);
              handleFinalAudio(messageData);
            } else {
              console.log(
                "message already in chatMessageIds",
                messageData.chat_message_id
              );
            }
            stopPolling();
            break;
          default:
            if (chat?.auto_translate === "written") {
              lastMessageRef.current = {
                messageId: messageData.message.chat_message_id,
                messageText: messageData.message.full_message,
              };
            }
            if (chat?.mode !== "text_only") {
              handleChatMessage(
                messageData.message?.chat_message || messageData.chat_message
              );
            } else {
              // update the chat data in the context
              addMessage(messageData.message?.chat_message || messageData.chat_message);
              setIsWaitingForResponse(false);
            }
        }
      };

      onMessage(chatId, handleWebSocketMessage);
      return () => {
        removeMessageListener(chatId, handleWebSocketMessage);
        clearInterval(checkConnection);
        closeWebSocket(chatId, "ChatChannel");
        if (autoRecordTimeoutRef.current) {
          clearTimeout(autoRecordTimeoutRef.current);
        }
      };
    }
  }, [chat]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound
          .unloadAsync()
          .catch((error) => console.error("Error unloading sound:", error));
      }
    };
  }, [sound]);



  // Effect to trigger guided mode reply when a new assistant message is added
  useEffect(() => {
    if (!guidedModeFlag) return;

    // Skip if no chat data, no messages, or guided mode is disabled
    if (!chat || !messages?.length || !chat?.guided_mode) return;
    // Get the most recent message
    const latestMessage = messages[messages.length - 1];
    // Skip if no message or it's not from assistant or we've already processed it
    if (!latestMessage || latestMessage.role !== "assistant") {
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
  }, [
    messages?.[messages.length - 1]?.id,
    chat?.guided_mode,
    isWaitingForResponse,
  ]);

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
    } else {
      setIsGuidedModeReplyLoadingTimeout(false);
    }
  }, [isGuidedModeReplyLoading, isGuidedModeReplyVisible]);

  useEffect(() => {
    // If we can't go back, add a manual back button
    if (!navigation.canGoBack()) {
      navigation.setOptions({
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.push("/speak")}>
            <FontAwesomeIcon
              icon={faChevronLeft}
              size={getIconSize(24)}
              color={Colors[colorScheme ?? "light"].text}
            />
          </TouchableOpacity>
        ),
      });
    }
  }, [navigation]);

  // Add this effect to initialize the daily check when component mounts
  useEffect(() => {
    hasShownModalToday().then((shown) => {
      hasShownTodayRef.current = shown;
    });
  }, []);

  // Add this effect to reset message counts when chat changes
  useEffect(() => {
    if (chat?.id) {
      // Only initialize the current chat if it doesn't exist
      const chatId = chat.id.toString();
      if (!userMessageCountRef.current[chatId]) {
        userMessageCountRef.current[chatId] = 0;
      }
    }
  }, [chat?.id]);

  // Modify the effect that initializes message counts
  useEffect(() => {
    if (chat?.id) {
      const chatId = chat.id.toString();

      // Load the saved message count when chat changes
      loadMessageCount(chatId).then((count) => {
        userMessageCountRef.current[chatId] = count;
        console.log("Loaded message count for chat", chatId, ":", count);
      });
    }
  }, [chat?.id]);

  // Add this effect to initialize all counts when component mounts
  useEffect(() => {
    const initializeMessageCounts = async () => {
      try {
        // Get all keys from AsyncStorage
        const keys = await AsyncStorage.getAllKeys();
        const messageCountKeys = keys.filter((key) =>
          key.startsWith(STORAGE_KEY_PREFIX)
        );

        // Load all message counts
        for (const key of messageCountKeys) {
          const chatId = key.replace(STORAGE_KEY_PREFIX, "");
          const count = await loadMessageCount(chatId);
          userMessageCountRef.current[chatId] = count;
        }

        // Check if modal was shown today
        const shown = await hasShownModalToday();
        hasShownTodayRef.current = shown;
      } catch (error) {
        console.error("Error initializing message counts:", error);
      }
    };

    initializeMessageCounts();
  }, []);

  useEffect(() => {
    if (isSending) {
      setIsGuidedModeReplyVisible(false);
    }
  }, [isSending]);
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

  // Update previous message count and new message state whenever messages change
  useEffect(() => {
    if (messages) {
      // Check if we have new messages
      if (messages.length > previousMessagesCountRef.current) {
        setHasNewMessage(true);
        // Clear the new message flag after a short delay
        const timer = setTimeout(() => {
          setHasNewMessage(false);
        }, 100);
        
        // Update the ref after setting the state
        previousMessagesCountRef.current = messages.length;
        
        return () => clearTimeout(timer);
      } else {
        previousMessagesCountRef.current = messages.length;
      }
    }
  }, [messages]);

  if (isJapaneseReadingAidLoading) {
    return (
      <View className={cx('bg-white dark:bg-[#181C20] flex-1 justify-center items-center')}>
        <Text className={cx('text-black dark:text-white')}>Loading Japanese Reading Aids and Dictionary...</Text>
      </View>
    );
  }
  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
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
          contentStyle: { backgroundColor: "#fff" },
        }}
      />

      <AudioRecorder
        ref={audioRecorderRef}
        token={token}
        chatData={chatDataState}
        onRecordingStateChange={handleRecordingStateChange}
        onTranscriptionStateChange={handleTranscriptionStateChange}
        onMicrophoneError={handleMicrophoneError}
        onTranscriptionResult={handleTranscriptionResult}
        useNewVADSystem={useNewVADSystem}
        voiceRecognitionRef={voiceRecognitionRef}
        transcriptionMode={chat?.transcription_mode || "v1"}
        transcriptionModel={chat?.transcription_model || "whisper-1"}
        useTranscriptionCloudflareWorker={useTranscriptionCloudflareWorker}
        onPendingUserAudioChange={handlePendingUserAudioChange}
        autoSend={Boolean(chat?.auto_send) && !isLongPressRef.current}
        autoSendThreshold={chat?.auto_send_threshold || 2000}
        audioPlayerService={audioPlayerService}
      />

      {/* NEW VAD SYSTEM START */}
      {useNewVADSystem && (
        <View style={{ position: "absolute", top: -1000, left: -1000 }}>
          <VoiceRecognition
            ref={voiceRecognitionRef}
            onSilenceDetected={() => {
              console.log("Silence detected via VoiceRecognition");
              stopRecording(chat?.auto_send && !isLongPressRef.current);
            }}
            silenceThreshold={
              chat?.auto_send && !isLongPressRef.current
                ? (chat?.auto_send_threshold || 0) * 1000
                : 20000
            }
            onTextResult={() => {}}
          />
        </View>
      )}
      {/* NEW VAD SYSTEM END */}

      {/* The rest of your component */}
      <KeyboardAvoidingView
        className={cx("flex-1 bg-white dark:bg-[#181C20] rounded-b-3xl")} // Updated to add dark mode background
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardOffset}
      >
        {errorMessage && (
          <View className="bg-red-500 p-4 rounded-md mb-4">
            <Text
              style={GlobalFontStyleSheet.textMd}
              className="text-gray-200 font-bold"
            >
              {errorMessage}
            </Text>
            {errorMessage.includes("Connection") ||
            errorMessage.includes("connection") ? (
              <TouchableOpacity
                onPress={() => {
                  if (chat?.id) {
                    connectWebSocket(chat.id, {
                      name: "ChatChannel",
                      params: { chat_id: chat.id },
                    });
                  }
                }}
                className="mt-2"
              >
                <Text
                  style={GlobalFontStyleSheet.textMd}
                  className="text-gray-800 underline"
                >
                  Retry Connection
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => setErrorMessage(null)}
                className="mt-2"
              >
                <Text
                  style={GlobalFontStyleSheet.textMd}
                  className="text-gray-200 underline"
                >
                  Close
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <FlashList
          estimatedItemSize={150}
          data={ displayMessages }
          renderItem={({ item, index }) => (
            <MessageItem
              key={index.toString()}
              flashItemkey={index.toString()}
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
                const messageIndex =
                  messages?.findIndex(
                    (msg) => msg.chat_message_id === message.chat_message_id
                  ) || 0;
                const previousMessages =
                  messages?.slice(0, messageIndex).reverse() || [];
                const previousAIMessage = previousMessages.find(
                  (msg) => msg.role === "assistant"
                );

                handleCorrection(message, previousAIMessage);
              }}
              onCorrectionExplanation={handleCorrectionExplanation}
              handleAlternativeResponse={handleAlternativeResponse}
              
              chatMode={chat?.mode || ""}
              chatData={chatDataState}
              setCurrentPlayingMessageId={setCurrentPlayingMessageId}
              setPlayingSlowAudioId={setPlayingSlowAudioId}
              // setChatData={setChatData}
              onTranslationModalOpen={handleTranslationModalOpen} // Pass the handler
              isRecording={isRecording}
              cancelRecording={cancelRecording}
              isNew={lastMessageRef.current?.messageId === item.chat_message_id}
              targetLanguage={
                userSettings?.team.langua_native_language || "english"
              }
            />
          )}
          getItemType={getItemType}
          inverted
          className="flex-1"
          contentContainerStyle={styles.messageList}
          ListHeaderComponent={
            isWaitingForResponse ? (
              <>
                <LoadingDots
                  avatarUrl={chat?.avatar_url}
                  showTimeout={
                    usePollingSystem && (showResponseTimeout || forcedTimeout)
                  }
                  showIntermediateTimeout={
                    usePollingSystem && showIntermediateTimeout
                  }
                  onRefresh={usePollingSystem ? handleRefreshChat : undefined}
                  newMessageArrived={
                    pendingMessageIds.size > 0 || hasNewMessage
                  }
                  isRefreshing={isRefreshing}
                  onDismiss={usePollingSystem ? () => {
                    console.log('[FLAGGED] Dismiss button pressed - clearing timeout states');
                    setShowResponseTimeout(false);
                    setForcedTimeout(false);
                    setShowIntermediateTimeout(false);
                    setIsWaitingForResponse(false);
                  } : undefined}
                />
              </>
            ) : null
          }
        />

        <SuggestedRepliesModal
          isVisible={isSuggestionsModalVisible}
          onClose={hideSuggestionsModal}
          suggestions={suggestions}
          processedSuggestions={processedSuggestions}
          onSuggestionSelect={handleSuggestionSelect}
          language={chat?.language || ""}
          targetLanguage={
            userSettings?.team.langua_native_language || "english"
          }
          voice={chat?.voice || ""}
          voice_provider={chat?.voice_provider || ""}
          token={token || ""}
          audioPlayerService={audioPlayerService}
          isLoading={isSuggestionsLoading}
          isChatFlagged={isChatFlagged}
          isUsingJapanesePronunciation={isUsingJapanesePronunciation}
          onWordTranslated={handleWordTranslated}
          onWordSaved={handleWordSaved}
        />

        <View className="justify-center items-center">
          {isGuidedModeReplyLoading && !isGuidedModeReplyLoadingTimeout && (
            <BouncingDots delay={0} size={5} color="#0000ff" />
          )}
          {isGuidedModeReplyLoadingTimeout &&
            !isGuidedModeReplyLoading &&
            !isGuidedModeReplyVisible && (
              <FontAwesomeIcon
                icon={faTriangleExclamation}
                size={20}
                color="#F87171"
              />
            )}
        </View>
        <GuidedModeReplyModal
          isVisible={isGuidedModeReplyVisible}
          onClose={() => setIsGuidedModeReplyVisible(false)}
          reply={guidedModeReply?.suggestion || ""}
          translation={guidedModeReply?.translation || ""}
          language={chat?.language || ""}
          voice={chat?.voice || ""}
          voice_provider={chat?.voice_provider || ""}
          token={token || ""}
          audioPlayerService={audioPlayerService}
          onReplySelect={sendMessage}
          isRecording={isRecording}
          cancelRecording={cancelRecording}
          onWordTranslated={handleWordTranslated}
          onWordSaved={handleWordSaved}
          chatContextFlag={isChatFlagged}
          japaneseReadingAidFlag={isUsingJapanesePronunciation}
        />
        <LimitReachedModal
          hasHitLimit={showLimitReachedUpgrade}
          onClose={() => {
            setShowLimitReachedUpgrade(false);
            setDismissedUpgradeModal(true);
          }}
        />
        {message_limit_reached && subscriptionInfo && !subscriptionLoading ? (
          <View className="bg-yellow-500 text-black p-4 mb-4 rounded-md">
            <View className="items-center">
              {subscriptionInfo?.plan?.id === "free" ? (
                <Text className="text-center">
                  You've hit your message limit for this week.
                </Text>
              ) : (
                <Text className="text-center">
                  You've hit your message limit for today - great effort!
                </Text>
              )}
              <View className="h-2" />
              <View className="flex-row justify-center">
                <Text>Want to keep going?</Text>
                <TouchableOpacity onPress={() => router.push("/subscription")}>
                  {subscriptionInfo?.plan?.id === "free" ? (
                    <Text className="font-bold text-blue-500">
                      {Platform.OS === "android"
                        ? " Try Pro risk-free for 30 days"
                        : " Unlock Pro Access"}
                    </Text>
                  ) : (
                    <Text className="font-bold text-blue-500">
                      {" "}
                      Upgrade to Unlimited
                    </Text>
                  )}
                </TouchableOpacity>
                {subscriptionInfo?.plan?.id !== "free" && (
                  <Text> for faster </Text>
                )}
              </View>
              {subscriptionInfo?.plan?.id !== "free" && (
                <>
                  <View className="flex-row justify-center">
                    <Text>progress or </Text>
                    <TouchableOpacity
                      onPress={() =>
                        Linking.openURL(
                          "https://support.languatalk.com/article/144-why-is-there-a-limit-on-communicate-ai-chat"
                        )
                      }
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
          renderInputArea() // ChatInputBar is rendered here
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
            <TouchableWithoutFeedback
              onPress={() => {
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
              <View style={styles.modalOverlay}>
                <View style={styles.menuContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowMenu(false);
                      handleChatSettings();
                    }}
                    style={styles.menuItem}
                  >
                    <Text
                      style={[GlobalFontStyleSheet.textMd, styles.menuItemText]}
                    >
                      Settings
                    </Text>
                  </TouchableOpacity>

                  {Platform.OS === "ios" ? (
                    <TouchableOpacity
                      onPress={() => {
                        openHelpScout(userSettings?.user);
                      }}
                      style={styles.menuItem}
                    >
                      <Text
                        style={[
                          GlobalFontStyleSheet.textMd,
                          styles.menuItemText,
                        ]}
                      >
                        Help Articles
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => {
                        setShowMenu(false);
                        router.push("/help");
                      }}
                      style={styles.menuItem}
                    >
                      <Text
                        style={[
                          GlobalFontStyleSheet.textMd,
                          styles.menuItemText,
                        ]}
                      >
                        Help Articles
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={async () => {
                      setShowMenu(false);
                      
                      try {
                        // First, check server-side call limit
                        const response = await fetch(`${API_URL}/api/v1/chats/${chat?.id}?call_mode=true`, {
                          headers: {
                            Authorization: `${token}`,
                            "Content-Type": "application/json",
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
                          throw new Error('Failed to verify call mode access');
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
                        
                        // Add delay to ensure modal is fully dismissed before navigation
                        setTimeout(() => {
                          router.replace({
                            pathname: '/(tabs)/speak/call',
                            params: { chatId: chat?.id }
                          });
                        }, 100);
                      } catch (error) {
                        console.error('Error checking call mode access:', error);
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
                    <Text
                      style={[GlobalFontStyleSheet.textMd, styles.menuItemText]}
                    >
                      End Chat & Get Feedback
                    </Text>
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
        chatSettings={chat}
        chatOptions={chat_form_options}
        onSettingChange={handleSettingsChange}
        disableGuidedMode={
          chat?.topic_category === "vocab" || chat?.topic_category === "grammar"
          }
        isJapaneseReadingAidFlagged={isUsingJapanesePronunciation}
        />
      <EndChatModal
        isVisible={showEndChatModal}
        onClose={() => setShowEndChatModal(false)}
        userMessagesCount={
          messages?.filter((m) => m.role === "user").length || 0
        }
        chatId={chat?.id || 0}
      />
      <CorrectionModal
        isVisible={showCorrectionModal && !showPointsModal}
        onClose={() => {
          isModalOpenRef.current = false; // Reset the ref when modal closes
          hideCorrectionModal();

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
            const playingMessage = messages?.find(
              (msg) => msg.chat_message_id === currentPlayingMessageId
            );
            if (playingMessage) {
              setPreviousPlayingMessage({
                messageId: playingMessage.chat_message_id,
                audioUrl: playingMessage.audio_url,
                wordTimings: playingMessage.word_timings,
                text: playingMessage.content,
                wasPlaying: audioPlayerService.isPlaying,
              });
            }
          }
          // Stop the current audio
          if (audioPlayerService.isPlaying) {
            audioPlayerService.pauseSound();
            setCurrentPlayingMessageId(null);
          }
        }}
        correction={selectedMessageForCorrection?.correction || ""}
        processedCorrection={processedCorrection}
        correctionExplanation={
          selectedMessageForCorrection?.correction_explanation
        }
        onRequestExplanation={() => {
          if (selectedMessageForCorrection) {
            handleCorrectionExplanation(selectedMessageForCorrection);
          }
        }}
        isLoading={isCorrectionLoading}
        language={chat?.language || ""}
        targetLanguage={userSettings?.team.langua_native_language || "english"}
        onWordTranslated={handleWordTranslated}
        onWordSaved={handleWordSaved}
        chatContextFlag={isChatFlagged}
        japaneseReadingAidFlag={isUsingJapanesePronunciation}
      />
      <AlternativeResponseModal
        alternativeResponse={alternativeResponse}
        languageCode={chat?.language || ""}
        targetLanguage={userSettings?.team.langua_native_language || "english"}
        isVisible={showAlternativeModal}
        voice={chat?.voice || ""}
        voice_provider={chat?.voice_provider || ""}
        onClose={() => {
          isModalOpenRef.current = false; // Reset the ref when modal closes
          hideAlternativeModal();

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
            const playingMessage = messages?.find(
              (msg) => msg.chat_message_id === currentPlayingMessageId
            );
            if (playingMessage) {
              setPreviousPlayingMessage({
                messageId: playingMessage.chat_message_id,
                audioUrl: playingMessage.audio_url,
                wordTimings: playingMessage.word_timings,
                text: playingMessage.content,
                wasPlaying: audioPlayerService.isPlaying,
              });
            }
          }
          // Stop the current audio
          if (audioPlayerService.isPlaying) {
            audioPlayerService.pauseSound();
            setCurrentPlayingMessageId(null);
          }
        }}
        isLoading={isAlternativeLoading}
        voice={chat?.voice || ""}
        onWordTranslated={handleWordTranslated}
        onWordSaved={handleWordSaved}
        chatContextFlag={isChatFlagged}
        japaneseReadingAidFlag={isUsingJapanesePronunciation}
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
            const playingMessage = messages?.find(
              (msg) => msg.chat_message_id === currentPlayingMessageId
            );
            if (playingMessage) {
              setPreviousPlayingMessage({
                messageId: playingMessage.chat_message_id,
                audioUrl: playingMessage.audio_url,
                wordTimings: playingMessage.word_timings,
                text: playingMessage.content,
                wasPlaying: audioPlayerService.isPlaying,
              });
            }
          }
          // Pause the current audio if it's playing
          if (audioPlayerService.isPlaying) {
            audioPlayerService.pauseSound();
            setCurrentPlayingMessageId(null);
          }
        }}
        word={selectedVocabWord || ""}
        language={chat?.language || ""}
        targetLanguage={userSettings?.team.langua_native_language || "english"}
        contextSentence={selectedSentence || ""}
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
          hideTranslationModal();
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
        translation={currentTranslation || ""}
        originalText={currentOriginalText || ""}
        processedOriginalText={processedOriginalText}
        language={chat?.language}
        targetLanguage={userSettings?.team.langua_native_language || 'english'}
        onWordTranslated={handleWordTranslated}
        onWordSaved={handleWordSaved}
        chatContextFlag={isChatFlagged}
        japaneseReadingAidFlag={isUsingJapanesePronunciation}
      />
      <UserPointsModal
        isVisible={showPointsModal}
        onClose={async (resumeAudio: boolean) => {
          // updated to accept resumeAudio flag
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

                // dispatchChatData with addMessage
                addMessage(messageToAdd);

                if (messageToAdd.audio_url) {
                  handlePlayAudio(
                    messageToAdd.audio_url,
                    messageToAdd.word_timings,
                    messageToAdd.chat_message_id,
                    messageToAdd.content
                  );
                }
              }

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
            }, 600); // increased delay
          }
        }}
        token={token}
        colorScheme={colorScheme}
        chatId={chat?.id || null}
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
    alignItems: "flex-end",
  },
  aiMessageWrapper: {
    alignItems: "flex-start",
  },
  messageContentWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    position: "relative",
  },
  messageContainer: {
    borderRadius: isTablet ? 30 : 20,
    maxWidth: Platform.select({
      android: "85%",
      default: "95%",
    }),
    marginTop: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    marginHorizontal: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  aiMessageContainer: {
    maxWidth: Platform.select({
      android: "85%",
      default: "100%",
    }),
    paddingVertical: 2,
    marginHorizontal: 4,
    backgroundColor: "transparent",
  },
  aiMessageContent: {
    paddingLeft: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  userMessageContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: 24,
    alignSelf: "flex-start",
    flexShrink: 1,
    paddingBottom: 4,
  },
  hiddenText: {
    backgroundColor: "rgba(61, 71, 82, 0.1)",
    color: "transparent",
  },
  aiTranslationText: {
    marginLeft: 20,
    marginTop: 4,
  },
  userTranslationText: {
    marginTop: 4,
    color: "#4B5563", // Changed from white to a darker gray
    opacity: 0.9,
  },
  correctionText: {
    marginTop: 4,
    color: "#4B5563", // Changed from white to a darker gray
    fontWeight: "400",
  },
  correctionExplanationText: {
    marginTop: 4,
    color: "#4B5563", // Changed from white to a darker gray
    fontWeight: "400",
  },
  alternativeResponseText: {
    marginTop: 4,
    color: "#fff",
    fontWeight: "400",
  },
  avatarContainer: {
    position: "absolute",
    bottom: -10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
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
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: 5,
    marginLeft: 30, // Align with the message bubble
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#00448f", // Keep the action buttons blue
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
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
    backgroundColor: "transparent",
  },
  correctionOuterContainerDark: {
    backgroundColor: "transparent",
  },
  correctionInnerContainer: {
    borderLeftWidth: 2,
    borderLeftColor: "#059669", // Green accent
    paddingLeft: 12,
  },

  textContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    alignSelf: "flex-start",
    flexShrink: 1,
  },
  wordContainer: {
    marginRight: 2,
    marginVertical: 2,
    alignItems: "center",
  },
  deletedText: {
    textDecorationLine: "line-through",
    color: "#ff6b6b",
    opacity: 0.7,
    textDecorationStyle: Platform.OS === "ios" ? "solid" : undefined,
  },
  insertedText: {
    textDecorationLine: "underline",
    color: "#51cf66",
    textDecorationStyle: Platform.OS === "ios" ? "solid" : undefined,
    fontWeight: "500",
  },
  boldText: {
    fontWeight: "700",
  },
  correctionWord: {
    textAlignVertical: Platform.OS === "android" ? "center" : undefined,
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 80 : 60,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    elevation: 5,
    paddingVertical: 8,
    minWidth: 150,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  menuItem: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    // Remove color here and use className instead
  },
  optionButton: {
    backgroundColor: "#fff",
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    borderColor: "#00448f",
    borderWidth: 2,
  },
  selectSuggestionButton: {
    padding: 8,
    marginLeft: "auto", // This will push the button to the right
    backgroundColor: "#00488f",
    borderRadius: 4,
  },
  lineContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  userMessageActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
    marginRight: 8,
    gap: 8,
    marginBottom: 0, // Keep actions close to user message
  },

  translationWrapper: {
    width: "100%",
    alignSelf: "flex-start",
    flexDirection: "column",
  },

  translationContainer: {
    alignSelf: "flex-start",
    flexShrink: 1,
    width: "100%",
  },

  translationText: {
    alignSelf: "flex-start",
    flexShrink: 1,
  },
  greenCheck: {
    position: "absolute",
    top: 4,
    right: 4,
  },
});
