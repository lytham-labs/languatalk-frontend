import React, { useState, useEffect, useCallback, useRef } from 'react';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { View, Text, Pressable, StyleSheet, FlatList, Dimensions, ScrollView, Platform } from 'react-native';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import cx from 'classnames';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/constants/api';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { UserSettingsContext } from '@/contexts/UserSettingsContext';
import Notification from '@/components/Notification';
import * as Haptics from 'expo-haptics';
import SlidingModal from '@/components/shared/SlidingModal';
import { ELEVENLABS_CHAT_VOICE_OPTIONS } from '@/constants/VoiceOptions';
import { useLocalSearchParams, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TutorialModal from '@/components/speak/TutorialModal';
import VocabSelectionModal from '@/components/speak/VocabSelectionModal';
import { getDeviceType } from '@/constants/Font';
import GlobalChatSettingsPanel from '@/components/settings/GlobalChatSettingsPanel';
import { useFeatureFlag } from 'posthog-react-native';
import FreeTrialModal from '@/components/speak/FreeTrial';
import useUserSubscription from '@/services/api/useUserSubscription';
import { SPEED_MULTIPLIER, AUTO_SEND_THRESHOLD } from '@/constants/Lists';
import CustomConversationModal from '@/components/speak/CustomConversationModal';
import PracticeVocabBeforeChatScreen from '@/components/speak/PracticeVocabBeforeChatScreen';
import { useStoreReview } from '@/hooks/useStoreReview';
import CallModeLimitReachedModal from '@/components/pricing/CallModeLimitReachedModal';
import MyCustomPromptsModal from '@/components/speak/MyCustomPromptsModal';

interface ChatOption {
  key: string;
  label: string;
  topics?: { key: string; label: string }[];
}

interface ApiResponse {
  chat_options: {
    roleplay: ChatOption[];
    general: ChatOption[];
    debate: ChatOption[];
    chat_about_anything: ChatOption[];
    vocab: ChatOption[];
    grammar: ChatOption[];
    guided: ChatOption[];
  };
  chat_form: {
    mode_options: { [key: string]: string };
    voice_options: { [key: string]: string };
    all_voice_options: { [key: string]: { [key: string]: string } };
    ai_model_options: [string, string][];
    transcription_mode_options: [string, string][];
    speed_options: [string, string][];
    language: string;
    mode: string;
    display_selected_options: string;
    voice: string;
  };
  new_user: boolean;
  language_warning: boolean;
  vocab_list?: string[];
  user_prompts?: { id: number; title: string; prompt: string; }[];
}

const triggerHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

const ChatSettings = React.memo(({
  showSettings,
  setShowSettings,
  settings,
  setSettings,
  apiData,
  onSettingsChange
}: {
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
  apiData: ApiResponse | null;
  onSettingsChange: (settings: any) => void;
}) => {
  const { updateUserSettings, error, successMessage } = React.useContext(UserSettingsContext)!;
  const [notification, setNotification] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  useEffect(() => {
    if (successMessage) {
      setNotification({ message: successMessage, type: "success" });
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      setNotification({ message: error, type: "error" });
    }
  }, [error]);

  return (
    <SlidingModal visible={showSettings} onClose={() => setShowSettings(false)}>
      <View className="pb-4">
        <GlobalChatSettingsPanel 
          showAdvancedSettings={true}
          onSettingsChange={onSettingsChange}
          initialSettings={settings}
          onCloseModal={() => setShowSettings(false)}
        />
      </View>
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onDismiss={() => setNotification(null)}
        />
      )}
    </SlidingModal>
  );
});

// Add interface for settings type
interface ChatSettings {
  mode: string;
  voice: string;
  ai_model: string;
  voice_model: string;
  speed_multiplier: number;
  transcription_mode: string;
  auto_record: boolean;
  auto_send: boolean;
  auto_correct: boolean;
  highlight_mode: string;
  repeat_corrections: boolean;
  do_not_ask_questions: boolean;
  guided_mode: boolean;
  auto_translate: string;
  practice_vocab_before_chat: boolean;
  auto_send_threshold?: number;
  pronunciation_characters?: string | null;
}

export default function SpeakScreenOriginal() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = Dimensions.get('window');
  const isTablet = width >= 768;
  const router = useRouter();
  const { token, user } = useAuth();
  const { userSettings, loading: userSettingsLoading, fetchUserSettings } = React.useContext(UserSettingsContext)!;
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ChatSettings>({
    mode: '',
    voice: '',
    ai_model: '',
    voice_model: '',
    speed_multiplier: 1,
    transcription_mode: '',
    auto_record: false,
    auto_send: false,
    auto_correct: false,
    auto_translate: 'off',
    highlight_mode: 'sentence',
    repeat_corrections: false,
    do_not_ask_questions: false,
    guided_mode: false,
    practice_vocab_before_chat: false
  });
  const isFocused = useIsFocused();
  const [selectedSubtopic, setSelectedSubtopic] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const { selectedOption: initialOption } = useLocalSearchParams<{ selectedOption?: string }>();
  const [showTutorial, setShowTutorial] = useState(false);
  const [isInitialMount, setIsInitialMount] = useState(true);
  const [showVocabSelection, setShowVocabSelection] = useState(false);
  const [selectedVocab, setSelectedVocab] = useState<string[]>([]);
  const [showFreeTrial, setShowFreeTrial] = useState(false);
  const { subscriptionInfo } = useUserSubscription();
  const [showCustomConversation, setShowCustomConversation] = useState(false);
  const [showMyCustomPrompts, setShowMyCustomPrompts] = useState(false);
        
  // New state for practice vocab step
  const [showPracticeVocabScreen, setShowPracticeVocabScreen] = useState(false);
  const [pendingChatTopic, setPendingChatTopic] = useState<{ key: string; label: string } | null>(null);
  const [pendingManualVocab, setPendingManualVocab] = useState<string | undefined>(undefined);
  const [promptItems, setPromptItems] = useState<string[]>([]);
  const { requestReview } = useStoreReview();
  const [showCallTimeLimitModal, setShowCallTimeLimitModal] = useState(false);
  useFocusEffect(
    React.useCallback(() => {
      fetchApiData();
    }, [])
  );

  useEffect(() => {
    if (isFocused) {
      fetchUserSettings();
    }
  }, [isFocused]);

  useEffect(() => {
    if (userSettings) {
      const userLevel = userSettings?.team.stream_language_level || 'beginner';
      const chatSettings = userSettings.team.chat_settings;
      const defaultMode = chatSettings.mode || 'text_audio';
      const defaultVoice = chatSettings.voice || apiData?.chat_form.voice || Object.values(apiData?.chat_form.all_voice_options[apiData?.chat_form.language] || {})[0];
      const defaultVoiceModel = chatSettings.voice_model || 'v1';
      const defaultAiModel = chatSettings.ai_model || apiData?.chat_form.ai_model_options[0][1];
      const defaultTranscriptionMode = chatSettings.transcription_mode || apiData?.chat_form.transcription_mode_options[0][1];
      const defaultAutoRecord = chatSettings.auto_record || false;
      const defaultAutoSend = chatSettings.auto_send || false;
      const defaultAutoCorrect = chatSettings.auto_correct || false;
      const defaultAutoTranslate = chatSettings.auto_translate || (userLevel === 'beginner' ? 'written' : 'off');
      const defaultHighlightMode = chatSettings.highlight_mode || 'sentence';
      const defaultRepeatCorrections = chatSettings.repeat_corrections || false;
      const defaultDoNotAskQuestions = chatSettings.do_not_ask_questions || false;
      const defaultPracticeVocabBeforeChat = chatSettings.practice_vocab_before_chat || false;
      const defaultPronunciationCharacters = chatSettings.pronunciation_characters || null;
      const defaultSpeedMultiplier = chatSettings.speed_multiplier !== undefined ? 
        chatSettings.speed_multiplier : 
        (userLevel === 'beginner' ? SPEED_MULTIPLIER.slow : SPEED_MULTIPLIER.normal);
      const defaultAutoSendThreshold = chatSettings.auto_send_threshold || AUTO_SEND_THRESHOLD.normal;
      
      // For beginners: defaults to true if guided_mode undefined
      // For all other levels: uses guided_mode value if set, defaults to false if undefined
      const defaultGuidedMode = userLevel === 'beginner' ? (chatSettings.guided_mode ?? true) :
        (chatSettings.guided_mode ?? false);
      
      setSettings({
        mode: defaultMode || '',
        voice: defaultVoice || '',
        speed_multiplier: defaultSpeedMultiplier || 1,
        voice_model: defaultVoiceModel || 'v1',
        ai_model: defaultAiModel || '',
        transcription_mode: defaultTranscriptionMode || '',
        auto_record: defaultAutoRecord || false,
        auto_send: defaultAutoSend || false,
        auto_correct: defaultAutoCorrect || false,
        auto_translate: defaultAutoTranslate || 'off',
        highlight_mode: defaultHighlightMode || 'sentence',
        repeat_corrections: defaultRepeatCorrections,
        do_not_ask_questions: defaultDoNotAskQuestions,
        guided_mode: defaultGuidedMode || false,
        practice_vocab_before_chat: defaultPracticeVocabBeforeChat,
        auto_send_threshold: defaultAutoSendThreshold,
        pronunciation_characters: defaultPronunciationCharacters || null
      });
    }
  }, [userSettings, apiData]);


  useEffect(() => {
    if (!loading && apiData && initialOption) {
      handleOptionPress(initialOption);
    }
  }, [loading, apiData, initialOption]);

  useEffect(() => {
    const checkTutorialStatus = async () => {
      if (!user?.id) {
        console.log('No user ID available');
        return;
      }

      try {
        // Check ID based tutorial status
        const tutorialStatusById = user?.id ? await AsyncStorage.getItem(`tutorial_shown_${user.id}`) : null;
        
        console.log('Tutorial status:', { byId: tutorialStatusById });
        console.log("userId", user?.id);
        // Show tutorial if either condition is met
        if (tutorialStatusById === null) {
          console.log('Setting tutorial to show');
          setShowTutorial(true);
        }
      } catch (error) {
        console.error('Error checking tutorial status:', error);
      }
    };

    if (isInitialMount && !loading && user?.id) {
      console.log('Checking tutorial status for user:', user);
      checkTutorialStatus();
      setIsInitialMount(false);
    }
  }, [isInitialMount, loading, user?.id]);

  const fetchApiData = async () => {
    if (!token) { return; }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/v1/chats/new`, {
        headers: {
          'Authorization': `${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chat options');
      }

      const data: ApiResponse = await response.json();
      setApiData(data);
    } catch (error) {
      console.error('Error fetching chat options:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionPress = async (option: string) => {
    // Prevent multiple navigations
    if (isNavigating) return;

    triggerHaptic();

    setSelectedOption(option);
    setSelectedSubtopic(null); // Reset selectedSubtopic when a new main option is selected
    // Update promptItems with the category key
    setPromptItems([getTopicCategory(option)]);
  };

  const handleSubtopicPress = async (subtopic: ChatOption) => {
    // Prevent multiple navigations
    if (isNavigating) return;

    triggerHaptic();
    
    // Update promptItems with the category key and subtopic key
    if (selectedOption) {
      setPromptItems([
        getTopicCategory(selectedOption),
        subtopic.key
      ]);
    }

    if (selectedOption === 'Do a role play') {
      setSelectedSubtopic(subtopic.key);
    } else if (selectedOption === 'Chat about anything' && subtopic.topics !== undefined) {
      setSelectedSubtopic(subtopic.key);
    } else if (selectedOption === 'Vocab & Games' && subtopic.topics !== undefined) {
      setSelectedSubtopic(subtopic.key);
    } else {
      // Only show practice screen if enabled AND not doing vocab or grammar practice
      const category = getTopicCategory(selectedOption);
      const skipPracticeCategories = ['vocab', 'grammar'];
      
      if (settings.practice_vocab_before_chat && !skipPracticeCategories.includes(category)) {
        // Skip specific conversation types from pre-chat vocab practice
        if ((selectedOption === 'Do a role play' && subtopic.key === 'custom_topic') ||
            (selectedOption === 'Have a debate' && subtopic.key === 'custom_chose_a_topic') ||
            (selectedOption === 'Chat about anything' && subtopic.key === 'free_chat') ||
            subtopic.key === 'custom_conversation') {
          // Skip practice screen and proceed directly to chat
          await createChat(subtopic);
          return;
        }
        
        setPendingChatTopic(subtopic);
        setPendingManualVocab(undefined);
        setShowPracticeVocabScreen(true);
        return;
      }
      
      // Otherwise proceed with chat creation
      await createChat(subtopic);
    }
  };

  const handleTopicPress = async (
    topic: { key: string; label: string }, 
    manualVocab?: string,
    customPrompt?: string,
    customTitle?: string
  ) => {
    // Prevent multiple navigations
    if (isNavigating) return;

    triggerHaptic();

    // Update promptItems with the keys only (category, subtopic, topic)
    if (selectedOption && selectedSubtopic) {
      setPromptItems([
        getTopicCategory(selectedOption),
        selectedSubtopic,
        topic.key
      ]);
    }

    // Show vocab selection modal if this is manual selection
    if (topic.key === 'manual_selection' && !manualVocab) {
      setShowVocabSelection(true);
      return;
    }

    // Only show practice screen if enabled AND not doing vocab or grammar practice
    const category = getTopicCategory(selectedOption);
    const skipPracticeCategories = ['vocab', 'grammar'];
    
    if (settings.practice_vocab_before_chat && !skipPracticeCategories.includes(category)) {
      // Skip specific conversation types from pre-chat vocab practice
      if ((selectedOption === 'Do a role play' && topic.key === 'custom_topic') ||
          (selectedOption === 'Have a debate' && topic.key === 'custom_chose_a_topic') ||
          (selectedOption === 'Chat about anything' && topic.key === 'free_chat') ||
          topic.key === 'custom_conversation') {
        // Skip practice screen and proceed directly to chat
        await createChat(topic, manualVocab, customPrompt, customTitle);
        return;
      }
      
      setPendingChatTopic(topic);
      setPendingManualVocab(manualVocab);
      setShowPracticeVocabScreen(true);
      return;
    }

    // Otherwise proceed with chat creation
    await createChat(topic, manualVocab, customPrompt, customTitle);
  };

  // Extract chat creation logic to separate function
  const createChat = async (topic: { key: string; label: string;  } | ChatOption, manualVocab?: string, customPrompt?: string, customTitle?: string) => {
    try {
      setIsNavigating(true);
      const topicCategory = getTopicCategory(selectedOption);
      const shouldDisableGuidedMode = topicCategory === 'vocab' || topicCategory === 'grammar';
      
      const response = await fetch(`${API_URL}/api/v1/chats`, {
        method: 'POST',
        headers: {
          'Authorization': `${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: settings.mode,
          voice: settings.voice,
          speed_multiplier: settings.speed_multiplier,
          speed: 'standard',
          language: apiData?.chat_form.language || 'spanish',
          auto_send: settings.auto_send ? '1' : '0',
          auto_send_threshold: settings.auto_send_threshold,
          auto_record: settings.auto_record ? '1' : '0',
          auto_correct: settings.auto_correct ? '1' : '0',
          auto_translate: settings.auto_translate,
          repeat_corrections: settings.repeat_corrections ? '1' : '0',
          do_not_ask_questions: settings.do_not_ask_questions ? '1' : '0',
          topic: topic.key,
          subtopic_category: topic.key === 'custom_conversation' ? 'create_new' :
            topic.key === 'custom_topic' ? 'custom' : selectedSubtopic,
          topic_category: topicCategory,
          transcription_mode: settings.transcription_mode,
          ai_model: settings.ai_model,
          highlight_mode: settings.highlight_mode,
          guided_mode: shouldDisableGuidedMode ? '0' : (settings.guided_mode ? '1' : '0'),
          practice_vocab_before_chat: settings.practice_vocab_before_chat ? '1' : '0',
          pronunciation_characters: settings.pronunciation_characters,
          ...(topic.key === 'custom_conversation' 
            ? {
                custom_prompt: customPrompt,
                custom_prompt_title: customTitle
              }
            : {
                selected_vocab: manualVocab || (selectedVocab.length > 0 ? selectedVocab.join(',') : undefined)
              }
          ),
        }),
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
        throw new Error('Failed to create chat');
      }

      const data = await response.json();

      // Redirect to call screen if mode is call_mode
      if (settings.mode === 'call_mode') {
        router.push({
          pathname: '/(tabs)/speak/call',
          params: { chatId: data.chat.id }
        });
      } else {
        router.push({
          pathname: '/(tabs)/speak/chat',
          params: { chatId: data.chat.id, initialData: JSON.stringify(data) }
        });
      }

      // Reset selections after navigation
      setSelectedOption(null);
      setSelectedSubtopic(null);
      setShowPracticeVocabScreen(false);
      setPendingChatTopic(null);
      setPendingManualVocab(undefined);
    } catch (error) {
      console.error('Error creating chat:', error);
    } finally {
      setIsNavigating(false);
    }
  };

  const getTopicCategory = (option: string | null): string => {
    switch (option) {
      case 'Beginner course (new, feedback welcome!)':
        return 'guided';
      case 'Design my own':
        return 'custom_conversation';
      case 'Chat about anything':
        return 'chat_about_anything';
      case 'Do a role play':
        return 'roleplay';
      case 'Have a debate':
        return 'debate';
      case 'Vocab & Games':
        return 'vocab';
      case 'Grammar practice':
        return 'grammar';
      default:
        return '';
    }
  };

  const getHumanReadableMode = (mode: string): string => {
    const modeMap: { [key: string]: string } = {
      'text_only': 'Text only mode',
      'audio_only': 'Listen first (click eye to read) mode',
      'text_audio': 'Listen & read mode',
      'call_mode': 'Call mode (Beta)'
    };
    return modeMap[mode] || mode;
  };

  const getHumanReadableVoice = (voice: string): string => {
    if (!apiData) {
      // When apiData is not available, search through ELEVENLABS_CHAT_VOICE_OPTIONS
      for (const language in ELEVENLABS_CHAT_VOICE_OPTIONS) {
        for (const label in ELEVENLABS_CHAT_VOICE_OPTIONS[language]) {
          if (ELEVENLABS_CHAT_VOICE_OPTIONS[language][label] === voice) {
            return label;
          }
        }
      }
      return voice;
    }

    const voiceOption = apiData.chat_form.all_voice_options[apiData.chat_form.language];
    if (voiceOption !== undefined) {
      const voiceEntry = Object.entries(apiData.chat_form.all_voice_options[apiData.chat_form.language]).find(([_, value]) => value === voice);
      return voiceEntry ? voiceEntry[0] : voice;
    } else {
      const voiceEntry = Object.entries(apiData.chat_form.all_voice_options['default'])[0];
      return voiceEntry ? voiceEntry[0] : voice;
    }
  };

  const getMainOptions = () => {
    if (!apiData) return [];

    const options = [
      'Chat about anything',
      'Do a role play',
      'Have a debate',
      'Vocab & Games',
      'Grammar practice',
      'Design my own',
    ];

    // Only add begginer guided course for beginner level
    if (userSettings?.team.stream_language_level === 'beginner') {
      options.unshift('Beginner course (new, feedback welcome!)');
    }

    return options;
  };

  const getDisplayData = () => {
    if (selectedSubtopic && selectedOption === 'Do a role play') {
      // Display roleplay topics for the selected subtopic
      const selectedRoleplayOption = apiData?.chat_options.roleplay.find(option => option.key === selectedSubtopic);
      return selectedRoleplayOption?.topics || [];
    } else if (selectedSubtopic && selectedOption === 'Chat about anything') {
      const selectedChatAboutAnythingOption = apiData?.chat_options.chat_about_anything.find(option => option.key === selectedSubtopic)?.topics;
      return selectedChatAboutAnythingOption || [];
    } else if (selectedSubtopic && selectedOption === 'Vocab & Games') {
      const selectedVocabOption = apiData?.chat_options.vocab.find(option => option.key === selectedSubtopic)?.topics;
      return selectedVocabOption || [];
    } else if (selectedOption) {
      // Display subtopics for the selected main option
      return apiData?.chat_options[getTopicCategory(selectedOption)] || [];
    } else {
      // Display main options
      return getMainOptions();
    }
  };

  const Header = ({ showBackButton = false, onBackPress, hideInfoSection = false, isLoading = false }: {
    showBackButton?: boolean,
    onBackPress?: () => void,
    hideInfoSection?: boolean,
    isLoading?: boolean
  }) => (
    <View style={[styles.header, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
      {showBackButton && (
        <Pressable style={styles.backButton} onPress={onBackPress}>
          <FontAwesome6 name="arrow-left" size={isTablet ? 20 : 24} color={Colors[colorScheme].tint} />
        </Pressable>
      )}
      {!hideInfoSection && !isLoading && (
        <View style={styles.chatInfoContainer}>
          <View style={styles.chatInfoContent}>
            <Text style={[GlobalFontStyleSheet.textBase, isTablet && GlobalFontStyleSheet.textBase]} className='text-gray-950 dark:text-white mb-2 text-center'>
              {settings.mode === 'text_only'
                ? `You will be chatting in ${getHumanReadableMode(settings.mode)}`
                : `You will be chatting with ${getHumanReadableVoice(settings.voice)} in ${getHumanReadableMode(settings.mode)}`
              }
            </Text>
          </View>
        </View>
      )}
      {isLoading && (
        <View style={styles.chatInfoContainer}>
          <View style={styles.chatInfoContent}>
            <Text style={GlobalFontStyleSheet.textBase} className='text-gray-950 dark:text-white mb-2 text-center'>
              Loading chat options...
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const placeholderOptions = [
    'Continue last conversation',
    'Chat about anything',
    'Do a role play',
    'Have a debate',
    'Vocab & Games',
    'Grammar practice',
    'Design my own',
  ];

  const handleCloseTutorial = async () => {
    try {
      // Save tutorial using ID if available
      if (user?.id) {
        await AsyncStorage.setItem(`tutorial_shown_${user.id}`, 'true');
      }
      console.log('Tutorial status saved as shown for user:', user);
    } catch (error) {
      console.error('Error saving tutorial status:', error);
    }
    setShowTutorial(false);
    if (Platform.OS === 'ios' && subscriptionInfo?.plan?.id === 'free') {
      setShowFreeTrial(true);
    }
  };

  // Update the settings when they change in the panel
  const handleSettingsChange = useCallback((settings: any) => {
    setSettings(settings);
  }, []);

  // Initialize settings from context when component mounts
  useEffect(() => {
    if (userSettings?.team?.chat_settings && !settings) {
      setSettings(userSettings.team.chat_settings);
    }
  }, [userSettings, settings]);

  // Add this effect to trigger store review
  useEffect(() => {
    if (isFocused && subscriptionInfo?.is_premium !== undefined) {
        requestReview();
    }
  }, [isFocused, subscriptionInfo?.is_premium]);

  // Render function with conditional for practice vocab screen
  if (showPracticeVocabScreen && pendingChatTopic) {
    return (
      <PracticeVocabBeforeChatScreen
        prompt={"Sample Prompt"}
        onStartChat={() => {
          if (pendingChatTopic) {
            createChat(pendingChatTopic, pendingManualVocab);
          }
        }}
        onBack={() => {
          setShowPracticeVocabScreen(false);
          setPendingChatTopic(null);
          setPendingManualVocab(undefined);
        }}
        topicLabel={pendingChatTopic.label}
        subtopicLabel={pendingChatTopic.label}
        promptItems={promptItems}
        language={apiData?.chat_form.language}
        voice={settings.voice}
      />
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
        <View className={cx({ 'p-10': isTablet })}>
          <Header hideInfoSection={false} isLoading={true} />
          <FlatList
            className={cx({ 'mt-10': isTablet })}
            data={placeholderOptions}
            keyExtractor={(item) => item}
            renderItem={() => (
              <View
                className={cx(
                  'bg-gray-100 dark:bg-gray-600 p-4 my-2 mx-4 rounded-lg items-center shadow-sm opacity-50'
                )}
              >
                <Text
                  className={cx('font-medium text-gray-400 dark:text-gray-300')}
                  style={GlobalFontStyleSheet.textBase}
                >
                  &nbsp;
                </Text>
              </View>
            )}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
      <ScrollView contentContainerStyle={{paddingBottom: 20}} style={{ flexGrow: 1}}>
        <Header
          showBackButton={selectedOption !== null}
          onBackPress={() => {
            if (selectedSubtopic) {
              setSelectedSubtopic(null);
            } else {
              setSelectedOption(null);
            }
          }}
        />
        <Pressable 
          onPress={() => {
            triggerHaptic();
            setShowSettings(true);
          }}
          style={isTablet ? styles.tabletSettingsButton : {}}
        >
          <Text 
            style={[
              GlobalFontStyleSheet.textBase, 
              isTablet && GlobalFontStyleSheet.textMd
            ]} 
            className={cx('font-medium text-center text-blue-500 dark:text-blue-300 pb-3', { 'mt-3': isTablet })}
          >
            Change your <Text className="underline">partner</Text> / <Text className="underline">settings</Text>
          </Text>
        </Pressable>
        <View className={cx('pb-100', { 'px-20': isTablet })}>
          {getDisplayData().map((item:string | { key: string, label: string}) => (
            <Pressable
              key={typeof item === 'string' ? item : item.key}
              className={cx(
                'bg-white dark:bg-gray-500 text-gray-500 dark:text-white items-center shadow-sm',
                isTablet ? 'rounded-3xl my-3 mx-2 p-3' : 'rounded-lg my-2 mx-4 p-4'
              )}
              onPress={() => {
                if (typeof item === 'string') {
                  handleOptionPress(item);
                } else if (selectedSubtopic && (selectedOption === 'Do a role play' || selectedOption === 'Chat about anything' || selectedOption === 'Vocab & Games' || selectedOption === 'Design my own')) {
                  handleTopicPress(item);
                } else if (selectedOption === 'Design my own' && item.key === 'create_new'){ 
                  setShowCustomConversation(true);
                } else if (selectedOption === 'Design my own' && item.key === 'my_prompts'){ 
                  setShowMyCustomPrompts(true);
                } else {
                  handleSubtopicPress(item);
                }
              }}
            >
              <Text
                className={cx('font-medium text-gray-500 dark:text-white', { 'p-3': isTablet })}
                style={[
                  GlobalFontStyleSheet.textBase,
                  isTablet && GlobalFontStyleSheet.textMd
                ]}
              >
                {typeof item === 'string' ? item : item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <ChatSettings
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          settings={settings}
          setSettings={setSettings}
          apiData={apiData}
          onSettingsChange={handleSettingsChange}
        />
      </ScrollView>
      {user?.id && (
        <TutorialModal 
          visible={showTutorial} 
          onClose={handleCloseTutorial}
          userId={user.id}
        />
      )}

      <VocabSelectionModal
        visible={showVocabSelection}
        onClose={() => {
          setShowVocabSelection(false);
          setSelectedVocab([]);
        }}
        onConfirm={(words) => {
          setSelectedVocab(words);
          handleTopicPress(
            { key: 'manual_selection', label: 'Practice Selected Vocabulary' },
            words.join(',')
          );
        }}
        token={token ?? ''}
      />
      
      <FreeTrialModal 
        isVisible={showFreeTrial}
        onClose={() => setShowFreeTrial(false)}
      />

      <CustomConversationModal
        visible={showCustomConversation}
        onClose={() => setShowCustomConversation(false)}
        onConfirm={(title, prompt) => {
          handleTopicPress(
            { key: 'custom_conversation', label: title },
            undefined,
            prompt,
            title
          );
        }}
        userPrompts={apiData?.user_prompts}
      />

      <MyCustomPromptsModal
        visible={showMyCustomPrompts}
        onClose={() => setShowMyCustomPrompts(false)}
        userPrompts={apiData?.user_prompts}
        onStartChat={(prompt) => {
          handleTopicPress(
            { key: 'custom_conversation', label: prompt.title },
            undefined,
            prompt.prompt,
            prompt.title
          );
          setShowMyCustomPrompts(false);
        }}
      />

      <CallModeLimitReachedModal
        isVisible={showCallTimeLimitModal}
        onClose={() => setShowCallTimeLimitModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: getDeviceType() === 'tablet' ? 128 : 20,
    paddingBottom: 10,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  chatInfoContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  chatInfoContent: {
    alignItems: 'center',
    maxWidth: '80%',
  },
  tabletSettingsButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  changeSettingsText: {
    fontSize: 16,
    textAlign: 'center',
  },
  optionButton: {
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    // borderWidth: 2,
  },
  optionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  dragIndicator: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 10,
  },
});
