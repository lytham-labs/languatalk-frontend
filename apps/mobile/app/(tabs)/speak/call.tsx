import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View, Text, KeyboardAvoidingView, Platform, Pressable, TouchableOpacity, ActivityIndicator, BackHandler, TouchableWithoutFeedback, AppState, AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { router, useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { TranscriptionTile, TranscriptionMessage as TileTranscriptionMessage } from '@/components/speak/TranscriptionTile';
import { useVoiceAssistant, useLocalParticipant } from "@livekit/components-react";
import { LiveKitRoom, registerGlobals } from '@livekit/react-native';
import { KrispNoiseFilter } from '@livekit/react-native-krisp-noise-filter';
import * as Haptics from 'expo-haptics';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { getIconSize } from '@/constants/Font';
import cx from 'classnames';
import { CallSettingsMenu } from '@/components/speak/CallSettingsMenu';
import CallSettingsModal from '@/components/CallSettingsModal';
import EndChatModal from '@/components/EndChatModal';
import { openHelpScout } from '@/components/helpscout';
import useUserSettings from '@/services/api/useUserSettings';
import { CallModeBar } from '@/components/speak/CallModeBar';
import { AvatarVisualizerWithTranscript, TranscriptionMessage as VisualizerTranscriptionMessage } from '@/components/speak/AvatarVisualizerWithTranscript';
import { AvatarVisualizer } from '@/components/speak/AvatarVisualizer';
import * as KeepAwake from 'expo-keep-awake';
import { getAvatarUrl } from '@/constants/AvatarUrls';
import { useAudioRouting } from '@/hooks/useAudioRouting';
import CallModeTimeoutModal from '@/components/speak/CallModeTimeoutModal';
import { useCallTimeout } from '@/hooks/useCallTimeout';
import BackgroundAudioService from '@/services/BackgroundAudioService';
import * as Notifications from 'expo-notifications';
import useUserSubscription from '@/services/api/useUserSubscription';
import { startCallSession, endCallSession, hasExceededCallLimit } from '@/services/CallTimeService';
import { useCallTimeMonitoring } from '@/hooks/useCallTimeMonitoring';
import CallModeLimitReachedModal from '@/components/pricing/CallModeLimitReachedModal';
import { CallModeLimitWarningModal } from '@/components/speak/CallModeTimeoutModal';

// registerGlobals must be called prior to using LiveKit.
registerGlobals();

interface Message {
  id: number;
  role: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface ChatData {
  chat: {
    id: number;
    language: string;
    language_code: string;
    mode: string;
    voice: string;
    voice_provider: string;
    speed: string;
    streaming_enabled: boolean;
    auto_send: boolean;
    auto_record: boolean;
    auto_correct: boolean;
    topic: string;
    subtopic_category: string;
    topic_category: string;
    client_provider: string;
    model: string;
    transcription_mode: string;
    ai_model: string;
    dialect_code: string;
    avatar_url: string;
    created_at: string;
    updated_at: string;
    highlight_mode: string;
    name: string;
    chat_type: string;
    openai_voice: string;
    openai_temperature: string;
    openai_max_tokens: string;
    openai_turn_detection_type: string;
    openai_vad_threshold: string;
    openai_silence_duration_ms: string;
    openai_model: string;
    openai_transcription_model: string;
    gemini_voice: string;
    gemini_temperature: string;
    cartesia_voice: string;
    keep_screen_on: boolean;
    speed_multiplier: number;
  };
  messages: Message[];
  user: {
    id: number;
    name: string;
    avatar_url: string;
  };
  message_limit_reached: boolean;
  chat_form_options: {
    mode_options: { [key: string]: string };
    voice_options: { [key: string]: string };
    ai_model_options: [string, string][];
    transcription_mode_options: [string, string][];
    speed_options: [string, string][];
    transcription_model_options: {
      [key: string]: {
        label: string;
        value: string;
        model: string;
      }
    };
  };
}

const RoomView = ({
  showTranscription,
  isMuted,
  settingsChanged,
  chatData,
  onSettingsNotified,
  onTranscriptionMessagesChange,
  currentAvatarUrl
}: {
  showTranscription: boolean,
  isMuted: boolean,
  settingsChanged: Record<string, string | boolean> | null,
  chatData: ChatData | null,
  onSettingsNotified: () => void,
  onTranscriptionMessagesChange: (messages: TileTranscriptionMessage[]) => void,
  currentAvatarUrl?: string
}) => {
  const voiceAssistant = useVoiceAssistant();
  const { localParticipant, microphoneTrack } = useLocalParticipant();
  const { audioTrack, state } = voiceAssistant;
  const colorScheme = useColorScheme();

  // Create Krisp noise filter instance
  const krisp = useMemo(() => KrispNoiseFilter(), []);

  // Get avatar URL based on language and voice, using currentAvatarUrl if available
  const avatarUrl = currentAvatarUrl || (chatData ? getAvatarUrl(
    chatData.chat.language,
    chatData.chat.voice,
    chatData.chat.voice_provider
  ) : undefined);

  // Effect to apply Krisp noise filter to microphone track
  useEffect(() => {
    const localAudioTrack = microphoneTrack?.audioTrack;
    if (!localAudioTrack) {
      return;
    }
    // Cast to LocalAudioTrack since we know this is from microphoneTrack
    const localTrack = localAudioTrack as any;
    if (localTrack.setProcessor && typeof localTrack.setProcessor === 'function') {
      try {
        localTrack.setProcessor(krisp);
      } catch (error) {
        console.warn('Failed to apply Krisp noise filter:', error);
      }
    }
  }, [microphoneTrack, krisp]);

  // Effect to handle mute/unmute
  useEffect(() => {
    if (localParticipant) {
      localParticipant.setMicrophoneEnabled(!isMuted, undefined, undefined);
    }
  }, [isMuted, localParticipant, audioTrack]);

  // Effect to notify about settings changes with optimized metadata
  useEffect(() => {
    if (settingsChanged && localParticipant && chatData) {
      // Combine existing settings with changes based on provider
      const currentProvider = chatData.chat.voice_provider;
      const allSettings: Record<string, any> = {
        // Common required fields
        voice_provider: currentProvider,
        language: chatData.chat.language,
        language_code: chatData.chat.language_code,
        voice: chatData.chat.voice || '',
        speed_multiplier: chatData.chat.speed_multiplier || 1.0,
      };

      // Add provider-specific settings
      switch (currentProvider) {
        case 'openai':
          Object.assign(allSettings, {
            voice: chatData.chat.voice || 'alloy',
            temperature: chatData.chat.openai_temperature || '0.8',
            max_tokens: chatData.chat.openai_max_tokens || '2048',
            turn_detection_type: chatData.chat.openai_turn_detection_type || 'server_vad',
            vad_threshold: chatData.chat.openai_vad_threshold || '0.7',
            silence_duration_ms: chatData.chat.openai_silence_duration_ms || '1500',
            model: chatData.chat.openai_model || 'gpt-4o-mini-realtime-preview-2024-12-17',
            transcription_model: chatData.chat.openai_transcription_model || 'gpt-4o-transcribe',
          });
          break;
        case 'gemini':
          Object.assign(allSettings, {
            voice: chatData.chat.gemini_voice || 'Puck',
            temperature: chatData.chat.gemini_temperature || '0.8',
          });
          break;
        case 'cartesia':
          Object.assign(allSettings, {
            voice: chatData.chat.cartesia_voice || '',
          });
          break;
      }

      // Include any newly changed settings (these will override defaults)
      Object.assign(allSettings, settingsChanged);

      // Send the metadata_changed message
      const message = {
        type: "metadata_changed",
        metadata: allSettings
      };

      localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message))
      );

      // Notify parent that we've sent the message
      onSettingsNotified();
    }
  }, [settingsChanged, localParticipant, chatData, onSettingsNotified]);

  return (
    <View style={styles.container}>
      {audioTrack && chatData ? (
        <>
          <View style={{ 
            paddingTop: 40,
            position: 'absolute', 
            width: '100%', 
            height: '100%', 
            opacity: showTranscription ? 1 : 0,
            zIndex: showTranscription ? 1 : 0,
            paddingBottom: 80,
          }} pointerEvents="box-none">
            <AvatarVisualizerWithTranscript
              state={state}
              trackRef={audioTrack}
              avatarUrl={avatarUrl}
              style={{
                width: '100%',
                height: '100%',
              }}
              borderColor={Colors[colorScheme ?? 'light']?.tint}
              size={180}
              colorScheme={colorScheme ?? 'light'}
              chatData={chatData}
              onTranscriptionMessagesChange={onTranscriptionMessagesChange as (messages: VisualizerTranscriptionMessage[]) => void}
              isMuted={isMuted}
            />
          </View>
          <View style={{ 
            position: 'absolute', 
            width: '100%', 
            height: '100%',
            opacity: showTranscription ? 0 : 1,
            zIndex: showTranscription ? 0 : 1,
            paddingBottom: 80,
          }} pointerEvents="box-none">
            <View style={styles.visualizerContainer}>
              <AvatarVisualizer
                state={state}
                trackRef={audioTrack}
                avatarUrl={avatarUrl}
                style={{
                  width: '100%',
                  height: 200,
                }}
                borderColor={Colors[colorScheme ?? 'light']?.tint}
                size={180}
                isMuted={isMuted}
              />
            </View>
          </View>
        </>
      ) : (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light']?.tint} />
        </View>
      )}
    </View>
  );
};

// Create a dedicated LiveKitRoomContainer component
const LiveKitRoomContainer = ({ 
  roomConfig,
  chatData,
  showTranscription,
  isMuted,
  onDisconnect,
  onRoomConnect,
  settingsChanged,
  onSettingsNotified,
  onTranscriptionMessagesChange,
  currentAvatarUrl
}: {
  roomConfig: { url: string; token: string; name: string; };
  chatData: ChatData | null;
  showTranscription: boolean;
  isMuted: boolean;
  onDisconnect?: () => void;
  onRoomConnect?: () => void;
  settingsChanged: Record<string, string | boolean> | null;
  onSettingsNotified: () => void;
  onTranscriptionMessagesChange: (messages: TileTranscriptionMessage[]) => void;
  currentAvatarUrl?: string;
}) => {
  useEffect(() => {
    return () => {
      if (onDisconnect) onDisconnect();
    };
  }, [onDisconnect]);

  const handleRoomConnected = useCallback(() => {
    console.log('LiveKit room connected, starting audio routing...');
    if (onRoomConnect) onRoomConnect();
  }, [onRoomConnect]);

  return (
    <LiveKitRoom
      serverUrl={roomConfig.url}
      token={roomConfig.token}
      connect={true}
      options={{
        adaptiveStream: { pixelDensity: 'screen' },
      }}
      audio={true}
      video={false}
      onConnected={handleRoomConnected}
      onDisconnected={onDisconnect}
    >
      <View style={{ flex: 1, position: 'relative' }}>
        <RoomView
          showTranscription={showTranscription}
          isMuted={isMuted}
          settingsChanged={settingsChanged}
          chatData={chatData}
          onSettingsNotified={onSettingsNotified}
          onTranscriptionMessagesChange={onTranscriptionMessagesChange}
          currentAvatarUrl={currentAvatarUrl}
        />
      </View>
    </LiveKitRoom>
  );
};

export default function CallScreen() {
  const { chatId } = useLocalSearchParams();
  const { token, user } = useAuth();
  const colorScheme = useColorScheme();
  const navigation = useNavigation();
  const [roomConfig, setRoomConfig] = useState<{
    url: string;
    token: string;
    name: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEndChatModal, setShowEndChatModal] = useState(false);
  const { userSettings } = useUserSettings();
  const [isMuted, setIsMuted] = useState(false);
  const [showTranscription, setShowTranscription] = useState(true);
  const [settingsChanged, setSettingsChanged] = useState<Record<string, string | boolean> | null>(null);
  const [roomKey, setRoomKey] = useState(Date.now());
  const [transcriptionMessages, setTranscriptionMessages] = useState<TileTranscriptionMessage[]>([]);
  const [keepScreenOn, setKeepScreenOn] = useState(true);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | undefined>(undefined);
  const { subscriptionInfo, loading: subscriptionLoading, error: subscriptionError } = useUserSubscription();
  const [showCallTimeLimitModal, setShowCallTimeLimitModal] = useState(false);
  const [callHasStarted, setCallHasStarted] = useState(false);
  const [callEndedDueToLimit, setCallEndedDueToLimit] = useState(false);

  // Audio routing hook
  const { startAudioRouting, stopAudioRouting } = useAudioRouting();

  // Add ref to prevent multiple simultaneous hangup calls
  const hangUpInProgressRef = useRef(false);
  
  // Add state for timeout message
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate keyboard offset
  const keyboardOffset = Platform.select({
    ios: 44, // Adjust this value as needed
    android: 10,
    default: 0
  });

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleMenuPress = useCallback(() => {
    setShowMenu(true);
  }, []);

  const handleCallSettings = useCallback(() => {
    triggerHaptic();
    setShowSettings(true);
    setShowMenu(false);
  }, []);

  const handleEndChat = useCallback(() => {
    triggerHaptic();
    router.replace("/(tabs)/history");
    setShowEndChatModal(true);
    setShowMenu(false);
  }, []);

  const handleSettingsChange = useCallback(async (changes: Partial<ChatData['chat']>) => {
    if (!chatId || !roomConfig?.name || !token || !chatData || !chatData.chat) {
      console.error('Missing required data for updating room settings');
      return;
    }

    // Handle keep screen on setting
    if ('keep_screen_on' in changes) {
      setKeepScreenOn(changes.keep_screen_on as boolean);
    }

    // Handle avatar changes without room reconnection
    if (changes.voice || changes.language || changes.voice_provider) {
      const newVoice = changes.voice || chatData.chat.voice;
      const newLanguage = changes.language || chatData.chat.language;
      const newProvider = changes.voice_provider || chatData.chat.voice_provider;
      console.log('New voice:', newVoice);
      console.log('New language:', newLanguage);
      console.log('New provider:', newProvider);
      const newAvatarUrl = getAvatarUrl(newLanguage, newVoice, newProvider);
      console.log('New avatar URL:', newAvatarUrl);
      setCurrentAvatarUrl(newAvatarUrl);
    }

    if (changes.voice_provider !== 'openai' && changes.voice_provider !== 'gemini') {
      // Check if provider is changing
      const isProviderChanging = changes.voice_provider !== undefined && 
        changes.voice_provider !== chatData.chat.voice_provider;
      
      // Only proceed if we're not changing providers but have voice_provider in changes
      if (isProviderChanging === false) {
        // For provider-specific setting changes, use metadata update
        console.log('For provider-specific setting changes, use metadata update');
        setChatData(prevData => {
          if (!prevData) return prevData;
          return {
            ...prevData,
            chat: {
              ...prevData.chat,
              ...changes
            }
          };
        });
        // Only keep string/boolean fields for settingsChanged
        const filteredChanges = Object.fromEntries(
          Object.entries(changes).filter(([_, v]) => typeof v === 'string' || typeof v === 'boolean')
        ) as Record<string, string | boolean>;
        setSettingsChanged(filteredChanges);
        return;
      }
    }

    // For provider changes, continue with full room reconnection
    try {
      setIsLoading(true);
      
      // Create complete settings object with all required fields
      const completeSettings = {
        // Common required fields
        voice_provider: changes.voice_provider || chatData.chat.voice_provider || 'elevenlabs',
        language: changes.language || chatData.chat.language,
        language_code: changes.language_code || chatData.chat.language_code,
        mode: changes.mode || chatData.chat.mode,
        voice: changes.voice || chatData.chat.voice || '',
        
        // OpenAI specific fields
        openai_voice: changes.openai_voice || chatData.chat.openai_voice || 'alloy',
        openai_temperature: changes.openai_temperature || chatData.chat.openai_temperature || '0.8',
        openai_max_tokens: changes.openai_max_tokens || chatData.chat.openai_max_tokens || '2048',
        openai_turn_detection_type: changes.openai_turn_detection_type || chatData.chat.openai_turn_detection_type || 'server_vad',
        openai_vad_threshold: changes.openai_vad_threshold || chatData.chat.openai_vad_threshold || '0.6',
        openai_silence_duration_ms: changes.openai_silence_duration_ms || chatData.chat.openai_silence_duration_ms || '1500',
        openai_model: changes.openai_model || chatData.chat.openai_model || 'gpt-4o-mini-realtime-preview-2024-12-17',
        openai_transcription_model: changes.openai_transcription_model || chatData.chat.openai_transcription_model || 'gpt-4o-transcribe',
        
        // Gemini specific fields
        gemini_voice: changes.gemini_voice || chatData.chat.gemini_voice || 'Puck',
        gemini_temperature: changes.gemini_temperature || chatData.chat.gemini_temperature || '0.8',
        
        // Cartesia specific field
        cartesia_voice: changes.cartesia_voice || chatData.chat.cartesia_voice || '',

        // Include any other changes
        ...changes
      };

      // Update local chat data with changes
      setChatData(prevData => {
        if (!prevData) return prevData;
        return {
          ...prevData,
          chat: {
            ...prevData.chat,
            ...completeSettings
          }
        };
      });
      
      // Force room reload by generating a new key and clearing roomConfig temporarily
      setRoomConfig(null);
      setIsLoading(true);
      
      // Fetch a new room configuration with updated settings
      const response = await fetch(`${API_URL}/api/v1/live_kit_keys`, {
        method: 'POST',
        headers: {
          Authorization: `${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          chat_id: chatId,
          ...completeSettings // Send all settings including defaults
        })
      });

      if (!response.ok) {
        throw new Error("Failed to fetch new room configuration");
      }

      const data = await response.json();

      // Update room configuration with new data
      setRoomConfig({
        url: data.url,
        token: data.access_token,
        name: data.name,
      });

      // Generate new key to force component remount
      setRoomKey(Date.now());
      setIsLoading(false);

    } catch (error) {
      console.error("Error updating room settings:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to update room settings");
      setIsLoading(false);
    }
  }, [chatId, roomConfig?.name, token, chatData]);

  const handleSettingsToggle = useCallback(() => {
    setShowTranscription(prev => !prev);
  }, []);

  const handleTranscriptionMessagesChange = useCallback((messages: VisualizerTranscriptionMessage[]) => {
    // Convert VisualizerTranscriptionMessage to TileTranscriptionMessage
    const convertedMessages: TileTranscriptionMessage[] = messages.map(msg => ({
      ...msg,
      created_at: Date.now() // Use timestamp as number
    }));
    setTranscriptionMessages(convertedMessages);
  }, []);

  useEffect(() => {
    if (!chatId) {
      router.replace("/(tabs)/speak");
      return;
    }
    fetchChatData();
    
    // Request notification permissions for Android foreground service
    const requestPermissions = async () => {
      if (Platform.OS === 'android') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Notification permissions not granted. Foreground service may not work properly.');
        }
      }
    };
    
    // Start background audio service
    const startBackgroundAudio = async () => {
      await requestPermissions();
      const audioService = BackgroundAudioService.getInstance();
      await audioService.startBackgroundAudio();
    };
    
    startBackgroundAudio();

    return () => {
      // Stop background audio service when component unmounts
      const stopBackgroundAudio = async () => {
        const audioService = BackgroundAudioService.getInstance();
        await audioService.stopBackgroundAudio();
      };
      stopBackgroundAudio();
    };
  }, [chatId, token]);

  const fetchChatData = async () => {
    if (!token || !user?.id) return;

    try {
      setIsLoading(true);
      
      const response = await fetch(`${API_URL}/api/v1/live_kit_keys`, {
        method: 'POST',
        headers: {
          Authorization: `${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chat_id: chatId })
      });

      if (!response.ok) {
        throw new Error("Failed to fetch chat data");
      }

      const data = await response.json();
      
      // Update room configuration with the correct properties including room name
      setRoomConfig({
        url: data.url,
        token: data.access_token,
        name: data.name,
      });

      const responseChatData: ChatData = data.chat;
      setChatData(responseChatData);

      // Start call session only if not already started and not exceeded limit
      if (user?.id && !callHasStarted) {
        await startCallSession(user.id.toString());
        setCallHasStarted(true);
      }

    } catch (error) {
      console.error("Error fetching chat data:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to fetch chat data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const handleHangUp = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (hangUpInProgressRef.current) {
      console.log('HangUp already in progress, ignoring duplicate call');
      return;
    }
    
    hangUpInProgressRef.current = true;
    
    try {
      // Stop audio routing first
      await stopAudioRouting();

      // Stop background audio service when ending call
      const audioService = BackgroundAudioService.getInstance();
      await audioService.stopBackgroundAudio();

      // End call session if call had started
      if (user?.id && callHasStarted) {
        await endCallSession(user.id.toString());
        setCallHasStarted(false);
      }

      // First, clear the room configuration to trigger unmounting of LiveKitRoom
      setRoomConfig(null);

      // Reset any other relevant state
      setChatData(null);
      setIsLoading(false);
      setErrorMessage(null);

      try {
        // Save transcriptions if there are any
        if (transcriptionMessages.length > 0) {
          const response = await fetch(`${API_URL}/api/v1/chat_transcriptions`, {
            method: 'POST',
            headers: {
              'Authorization': `${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: chatId,
              transcriptions: transcriptionMessages
            })
          });

          if (!response.ok) {
            throw new Error('Failed to save transcriptions');
          }
        }

        // Fetch chat data before redirecting
        const response = await fetch(`${API_URL}/api/v1/chats/${chatId}`, {
          headers: {
            'Authorization': `${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch chat data');
        }

        const data = await response.json();

        // Redirect to chat screen with initial data
        router.replace({
          pathname: '/(tabs)/speak/chat',
          params: { 
            chatId: chatId,
            initialData: JSON.stringify(data)
          }
        });
      } catch (error) {
        console.error('Error during hang up:', error);
        // Still redirect even if save/fetch fails, but without initial data
        router.replace({
          pathname: '/(tabs)/speak/chat',
          params: { chatId: chatId }
        });
      }
    } catch (error) {
      console.error('Error in handleHangUp:', error);
      // Still redirect on any error
      router.replace({
        pathname: '/(tabs)/speak/chat',
        params: { chatId: chatId }
      });
    } finally {
      hangUpInProgressRef.current = false;
    }
  }, [chatId, token, transcriptionMessages, user?.id, callHasStarted]);

  const handleSuggestedReplies = useCallback(() => {
    // Implement suggested replies logic
  }, []);

  const handleTranscriptionToggle = useCallback(() => {
    setShowTranscription(prev => !prev);
  }, []);

  // Function to handle room connection
  const handleRoomConnect = useCallback(async () => {
    console.log('Room connected, starting audio routing...');
    try {
      await startAudioRouting();
    } catch (error) {
      console.error('Failed to start audio routing:', error);
    }
  }, [startAudioRouting]);

  // Function to handle room disconnection
  const handleRoomDisconnect = useCallback(async () => {
    console.log('Room disconnected, stopping audio routing...');
    try {
      await stopAudioRouting();
    } catch (error) {
      console.error('Failed to stop audio routing:', error);
    }
  }, [stopAudioRouting]);

  // Timeout functionality
  const {
    isTimeoutModalVisible,
    countdownSeconds,
    resetTimeout,
    handleStayInCall: onStayInCall,
    handleEndCall: onTimeoutEndCall
  } = useCallTimeout({
    initialTimeoutSeconds: 60,
    countdownSeconds: 10,
    onTimeout: handleHangUp,
    isActive: !!roomConfig && !isLoading && !errorMessage
  });

  // Wrapper functions that include timeout reset
  const handleMenuPressWithTimeout = useCallback(() => {
    resetTimeout();
    handleMenuPress();
  }, [resetTimeout, handleMenuPress]);

  const handleCallSettingsWithTimeout = useCallback(() => {
    resetTimeout();
    handleCallSettings();
  }, [resetTimeout, handleCallSettings]);

  const handleEndChatWithTimeout = useCallback(() => {
    resetTimeout();
    handleEndChat();
  }, [resetTimeout, handleEndChat]);

  const handleMuteWithTimeout = useCallback(() => {
    resetTimeout();
    handleMute();
  }, [resetTimeout, handleMute]);

  const handleSettingsToggleWithTimeout = useCallback(() => {
    resetTimeout();
    handleSettingsToggle();
  }, [resetTimeout, handleSettingsToggle]);

  const handleTranscriptionToggleWithTimeout = useCallback(() => {
    resetTimeout();
    handleTranscriptionToggle();
  }, [resetTimeout, handleTranscriptionToggle]);

  const handleSuggestedRepliesWithTimeout = useCallback(() => {
    resetTimeout();
    handleSuggestedReplies();
  }, [resetTimeout, handleSuggestedReplies]);

  const handleTranscriptionMessagesChangeWithTimeout = useCallback((messages: VisualizerTranscriptionMessage[]) => {
    resetTimeout();
    handleTranscriptionMessagesChange(messages);
  }, [resetTimeout, handleTranscriptionMessagesChange]);

  useEffect(() => {
    return () => {
      // Cleanup function that runs when component unmounts
      const cleanup = async () => {
        // Stop audio routing
        await stopAudioRouting();
        
        const audioService = BackgroundAudioService.getInstance();
        await audioService.stopBackgroundAudio();
        // End call session on unmount if call had started
        if (user?.id && callHasStarted) {
          await endCallSession(user.id.toString());
        }
      };
      
      cleanup();
      setRoomConfig(null);
      setChatData(null);
      setIsLoading(false);
      setErrorMessage(null);
    };
  }, [stopAudioRouting]);

  // Handle back button press
  useEffect(() => {
    const backAction = () => {
      // Start the async operations but don't wait for them
      const saveAndRedirect = async () => {
        try {
          // Stop audio routing
          await stopAudioRouting();

          // Stop background audio service when leaving call
          const audioService = BackgroundAudioService.getInstance();
          await audioService.stopBackgroundAudio();

          // End call session on back press if call had started
          if (user?.id && callHasStarted) {
            await endCallSession(user.id.toString());
          }

          // Save transcriptions if there are any
          if (transcriptionMessages.length > 0) {
            const response = await fetch(`${API_URL}/api/v1/chat_transcriptions`, {
              method: 'POST',
              headers: {
                'Authorization': `${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                chat_id: chatId,
                transcriptions: transcriptionMessages
              })
            });

            if (!response.ok) {
              throw new Error('Failed to save transcriptions');
            }
          }

          // Fetch chat data before redirecting
          const response = await fetch(`${API_URL}/api/v1/chats/${chatId}`, {
            headers: {
              'Authorization': `${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error('Failed to fetch chat data');
          }

          const data = await response.json();

          // Redirect to chat screen with initial data
          router.replace({
            pathname: '/(tabs)/speak/chat',
            params: { 
              chatId: chatId,
              initialData: JSON.stringify(data)
            }
          });
        } catch (error) {
          console.error('Error during back navigation:', error);
          // Still redirect even if save/fetch fails, but without initial data
          router.replace({
            pathname: '/(tabs)/speak/chat',
            params: { chatId: chatId }
          });
        }
      };

      // Start the async operations
      saveAndRedirect();

      // Return true to prevent default back behavior
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [chatId, token, transcriptionMessages]);

  // Effect to handle wakelock
  useEffect(() => {
    const setupWakelock = async () => {
      if (keepScreenOn) {
        await KeepAwake.activateKeepAwakeAsync();
      } else {
        await KeepAwake.deactivateKeepAwake();
      }
    };

    setupWakelock();

    // Cleanup function to ensure wakelock is deactivated when component unmounts
    return () => {
      KeepAwake.deactivateKeepAwake();
    };
  }, [keepScreenOn]);

  // Handle app state changes for background audio
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const audioService = BackgroundAudioService.getInstance();
      audioService.handleAppStateChange(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => subscription?.remove();
  }, []);

  // Add useEffect to handle loading timeout message
  useEffect(() => {
    if (isLoading) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Reset timeout message
      setShowTimeoutMessage(false);
      
      // Set new timeout for 10 seconds
      timeoutRef.current = setTimeout(() => {
        setShowTimeoutMessage(true);
      }, 10000);
    } else {
      // Clear timeout when loading stops
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setShowTimeoutMessage(false);
    }

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isLoading]);

  // Update the Colors access to handle null/undefined
  const colorSchemeValue = colorScheme ?? 'light';
  const colors = Colors[colorSchemeValue];

  // Add useEffect to control header visibility based on loading state
  useEffect(() => {
    navigation.setOptions({
      headerShown: isLoading || !roomConfig,
      headerTitle: isLoading ? 'Connecting...' : '',
      headerTitleStyle: {
        color: colors?.text,
        fontSize: 16,
        fontWeight: '600'
      },
      headerStyle: {
        backgroundColor: colors?.background
      },
      headerTintColor: colors?.text,
    });
  }, [isLoading, roomConfig, navigation, colors]);

  // Ensure keep_screen_on is true by default when loading CallScreen
  useEffect(() => {
    if (chatData && chatData.chat) {
      if (typeof chatData.chat.keep_screen_on === 'boolean') {
        setKeepScreenOn(chatData.chat.keep_screen_on);
      } else {
        setKeepScreenOn(true);
      }
    }
  }, [chatData]);

  // Handle call limit reached - ends call but doesn't redirect
  const handleCallLimitReached = useCallback(async () => {
    try {
      // Stop audio routing
      await stopAudioRouting();

      // Stop background audio service when ending call
      const audioService = BackgroundAudioService.getInstance();
      await audioService.stopBackgroundAudio();

      // End call session if call had started
      if (user?.id && callHasStarted) {
        await endCallSession(user.id.toString());
        setCallHasStarted(false);
      }

      // Clear the room configuration to trigger unmounting of LiveKitRoom
      setRoomConfig(null);
      
      // Set state to show call ended due to limit
      setCallEndedDueToLimit(true);
      setIsLoading(false);
      setErrorMessage(null);

      // Save transcriptions if there are any (but don't redirect)
      if (transcriptionMessages.length > 0) {
        try {
          const response = await fetch(`${API_URL}/api/v1/chat_transcriptions`, {
            method: 'POST',
            headers: {
              'Authorization': `${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: chatId,
              transcriptions: transcriptionMessages
            })
          });

          if (!response.ok) {
            console.warn('Failed to save transcriptions:', response.statusText);
          }
        } catch (error) {
          console.warn('Error saving transcriptions:', error);
        }
      }
    } catch (error) {
      console.error('Error in handleCallLimitReached:', error);
      setCallEndedDueToLimit(true);
      setRoomConfig(null);
    }
  }, [user?.id, callHasStarted, transcriptionMessages, token, chatId]);

  const { 
    showLimitExceededModal, 
    dismissLimitModal,
    showOneMinuteWarning,
    remainingMinutes,
    dismissOneMinuteWarning,
    countdownSeconds: warningCountdownSeconds
  } = useCallTimeMonitoring({
    userId: user?.id ? user.id.toString() : null,
    planId: subscriptionInfo?.plan?.id,
    planName: subscriptionInfo?.plan?.name,
    productId: subscriptionInfo?.plan?.product_id,
    isCallActive: callHasStarted,
    onLimitExceeded: handleCallLimitReached,
  });

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View className="flex-row items-center">
              {/* Add any header title content here */}
            </View>
          ),
          headerRight: () => (
            <Pressable 
              onPress={handleMenuPressWithTimeout} 
              style={{ paddingRight: 16 }} 
              hitSlop={20}
            >
              <FontAwesomeIcon 
                icon={faEllipsisVertical} 
                size={getIconSize(24)} 
                color={colors?.text} 
              />
            </Pressable>
          ),
          contentStyle: { backgroundColor: "#fff" }
        }}
      />

      <KeyboardAvoidingView
        className={cx('flex-1 bg-white dark:bg-[#181C20]')}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardOffset}
      >
        {errorMessage && (
          <View className="bg-red-500 p-4 rounded-md mb-4">
            <Text style={GlobalFontStyleSheet.textMd} className="text-gray-200 font-bold">
              {errorMessage}
            </Text>
            <TouchableOpacity onPress={() => setErrorMessage(null)} className="mt-2">
              <Text style={GlobalFontStyleSheet.textMd} className="text-gray-200 underline">
                Close
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoading ? (
          <View style={[styles.loaderContainer, { backgroundColor: colorScheme === 'dark' ? '#181C20' : '#fff' }]}>
            <ActivityIndicator size="large" color={colors?.tint} />
            {showTimeoutMessage && (
              <Text style={[GlobalFontStyleSheet.textMd, { 
                color: colors?.text, 
                textAlign: 'center', 
                marginTop: 20,
                paddingHorizontal: 40,
                lineHeight: 24,
              }]}>
                Sorry, one of our tech partners is struggling to connect the call. Please go back & try again.
              </Text>
            )}
          </View>
        ) : callEndedDueToLimit ? (
          <View style={[styles.loaderContainer, { backgroundColor: colorScheme === 'dark' ? '#181C20' : '#fff' }]}>
            <Text style={[GlobalFontStyleSheet.textLg, { color: colors?.text, textAlign: 'center', marginBottom: 20 }]}>
              Call Ended
            </Text>
            <Text style={[GlobalFontStyleSheet.textMd, { color: colors?.text, textAlign: 'center', marginBottom: 30 }]}>
              You've reached your daily call limit
            </Text>
            <TouchableOpacity 
              onPress={handleHangUp}
              style={{
                backgroundColor: colors?.tint,
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 8,
              }}
            >
              <Text style={[GlobalFontStyleSheet.textMd, { color: 'white', fontWeight: '600' }]}>
                Return to Chat
              </Text>
            </TouchableOpacity>
          </View>
        ) : roomConfig ? (
          <TouchableWithoutFeedback onPress={resetTimeout}>
            <View style={{ flex: 1, position: 'relative' }}>
              <LiveKitRoomContainer
                key={roomKey}
                roomConfig={roomConfig}
                chatData={chatData}
                showTranscription={showTranscription}
                isMuted={isMuted}
                onRoomConnect={handleRoomConnect}
                onDisconnect={handleRoomDisconnect}
                settingsChanged={settingsChanged}
                onSettingsNotified={() => setSettingsChanged(null)}
                onTranscriptionMessagesChange={handleTranscriptionMessagesChangeWithTimeout}
                currentAvatarUrl={currentAvatarUrl}
              />
              <CallModeBar
                onMute={handleMuteWithTimeout}
                onHangUp={handleHangUp}
                onSettings={handleSettingsToggleWithTimeout}
                onSuggestions={handleSuggestedRepliesWithTimeout}
                isMuted={isMuted}
                onOpenSettings={handleCallSettingsWithTimeout}
                onInteraction={resetTimeout}
              />
            </View>
          </TouchableWithoutFeedback>
        ) : (
          <View style={[styles.loaderContainer, { backgroundColor: colorScheme === 'dark' ? '#181C20' : '#fff' }]}>
            <ActivityIndicator size="large" color={colors?.tint} />
          </View>
        )}

        <CallSettingsMenu
          isVisible={showMenu}
          onClose={() => setShowMenu(false)}
          onSettingsPress={handleCallSettingsWithTimeout}
          onEndChat={handleEndChatWithTimeout}
          openHelpScout={openHelpScout}
          userSettings={userSettings || undefined}
        />

        <CallSettingsModal
          isVisible={showSettings}
          onClose={() => setShowSettings(false)}
          chatSettings={chatData?.chat}
          chatOptions={chatData?.chat_form_options}
          onSettingChange={handleSettingsChange}
          showCallModeOptions={true}
          showTranscription={showTranscription}
          onTranscriptionToggle={handleTranscriptionToggleWithTimeout}
        />

        <EndChatModal
          isVisible={showEndChatModal}
          onClose={() => setShowEndChatModal(false)}
          userMessagesCount={chatData?.messages?.filter(m => m.role === 'user').length || 0}
          chatId={chatData?.chat?.id || 0}
        />

        <CallModeTimeoutModal
          isVisible={isTimeoutModalVisible}
          onStayInCall={onStayInCall}
          onEndCall={onTimeoutEndCall}
          countdownSeconds={countdownSeconds}
        />

        <CallModeLimitWarningModal
          isVisible={showOneMinuteWarning}
          onContinueCall={dismissOneMinuteWarning}
          onEndCall={handleHangUp}
          remainingMinutes={remainingMinutes}
          countdownSeconds={warningCountdownSeconds}
        />

        <CallModeLimitReachedModal
          isVisible={showCallTimeLimitModal}
          onClose={() => {
            setShowCallTimeLimitModal(false);
            if (!roomConfig && !isLoading) {
                router.replace("/(tabs)/speak");
            }
          }}
        />

        <CallModeLimitReachedModal
          isVisible={showLimitExceededModal}
          onClose={() => {
            dismissLimitModal();
          }}
        />
      </KeyboardAvoidingView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    position: 'relative',
  },
  visualizerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
