// contexts/ChatContext.tsx
import { ChatData, CompleteChatSettingsData, Message, MutableChatSettingsData } from '@/types/chat';
import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { useReadingAid } from '@/contexts/ReadingAidContext';
import { ProcessedMessage } from '@/types/chat';
import { processMessage, processMessages } from '@/utils/textProcessingUtils';
import { router } from 'expo-router';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';
import { getTranscriptionModel } from '@/constants/TranscriptionOptions';



// Define your state type
interface ChatState {
  chat: CompleteChatSettingsData;
  messages: ProcessedMessage[];
  displayMessages: ProcessedMessage[]; // always reverse messages when passed to displayMessages
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
    pronunciation_options: [string, string][];
    transcription_model_options: {
      [key: string]: {
        label: string;
        value: string;
        model: string;
      }
    };
  };
  isProcessingMessages: boolean;
  callLimitReached: boolean;
  loadingChatData: boolean;
  
  // UI settings state (derived from chat but can be optimistically updated)
  // settings: MutableChatSettings;
}

// Split ChatData in Context 
// messages: ChatMessageContext; displayMessages: ChatMessageContext; isProcessingMessages: boolean;

// State:
// chat, MutableChatSettingsData and ImmutableChatSettingsData
// user
// message_limit_reached
// chat_form_options: ChatInfo

// loadingData: boolean;




interface ChatProviderProps {
  children: React.ReactNode;
  chatId: string;
  initialData: ChatData | null;
}

// Message processing functions
// const processMessage = (message: Message): ProcessedMessage => {
//   // Process word timings if they exist
//   const lines = message.content.split('\n').map(line => ({
//     text: line,
//     segments: []
//   }));

//   const processed: ProcessedMessage = {
//     ...message,
//     processed_at: new Date().toISOString(),
//     lines
//   };
//   return processed;
// };

// const processMessages = (messages: Message[]): ProcessedMessage[] => {
//   return messages.map(processMessage);
// };

// Define your action types
type ChatAction = 
  | { type: 'setChatData'; payload: ChatState }
  | { type: 'updateChatSetting'; payload: Partial<MutableChatSettingsData> }
  | { type: 'updateMessageLimitReached'; payload: boolean }
  | { type: 'updateMessageProp'; payload: { id?: number | string, response_msg_id?: string } & Partial<ProcessedMessage> }
  | { type: 'addMessage'; payload: ProcessedMessage }
  | { type: 'addMessages'; payload: Message[] }
  | { type: 'updateMessages'; payload: Message[] }
  | { type: 'setProcessedMessages'; payload: ProcessedMessage[] }
  | { type: 'setProcessingMessages'; payload: boolean }
  | { type: 'setCallLimitReached'; payload: boolean }
  | { type: 'setLoadingChatData'; payload: boolean }


// Create your reducer
const chatDataReducer = (state: ChatState | null, action: ChatAction): ChatState | null => {
  // Allow setChatData to work with null state (initial state setting)
  if (!state && action.type !== 'setChatData') {
    return null;
  }
  let reversedMessages: ProcessedMessage[];
  let messages: ProcessedMessage[];
  switch (action.type) {
    case 'setChatData':
      return { 
        ...state, 
        ...action.payload,
        displayMessages: action.payload.displayMessages,
        isProcessingMessages: false,
        // Initialize settings from chat data
        chat: {
          ...state?.chat,
          ...action.payload.chat,
        }
      };
    case 'addMessage':
      if (!state) return null;
      messages = [...state.messages, action.payload];
      reversedMessages = messages.slice().reverse();
      return { ...state, messages: messages, displayMessages: reversedMessages, isProcessingMessages: false };
    case 'updateChatSetting': 
      if (!state) return null;
      return { 
        ...state, 
        chat: { 
          ...state.chat, 
          ...(action.payload.auto_record !== undefined && { auto_record: action.payload.auto_record }),
          ...(action.payload.auto_send !== undefined && { auto_send: action.payload.auto_send }),
          ...(action.payload.auto_send_threshold !== undefined && { auto_send_threshold: action.payload.auto_send_threshold }),
          ...(action.payload.auto_correct !== undefined && { auto_correct: action.payload.auto_correct }),
          ...(action.payload.guided_mode !== undefined && { guided_mode: action.payload.guided_mode }),
          ...(action.payload.auto_translate !== undefined && { auto_translate: action.payload.auto_translate }),
          ...(action.payload.pronunciation_characters !== undefined && { pronunciation_characters: action.payload.pronunciation_characters }),
          ...(action.payload.transcription_mode !== undefined && { transcription_mode: action.payload.transcription_mode }),
          ...(action.payload.highlight_mode !== undefined && { highlight_mode: action.payload.highlight_mode }),
          ...(action.payload.mode !== undefined && { mode: action.payload.mode }),
          ...(action.payload.ai_model !== undefined && { aiModel: action.payload.ai_model }),
          ...(action.payload.do_not_ask_questions !== undefined && { do_not_ask_questions: action.payload.do_not_ask_questions }),
          ...(action.payload.repeat_corrections !== undefined && { repeat_corrections: action.payload.repeat_corrections }),
          ...(action.payload.speed_multiplier !== undefined && { speed_multiplier: action.payload.speed_multiplier }),
          ...(action.payload.voice !== undefined && { voice: action.payload.voice }),
        }
      };
    case 'updateMessageLimitReached':
      if (!state) return null;
      return { ...state, message_limit_reached: action.payload };
    case 'updateMessageProp': {
      if (!state) return null;
      const { id, response_msg_id, ...updates } = action.payload;
      const searchId = id || response_msg_id;
      const messageIndex = state.messages.findIndex(m => m.id === searchId);
      
      if (messageIndex === -1) return state;
      
      const updatedMessages = [...state.messages];
      updatedMessages[messageIndex] = {
        ...updatedMessages[messageIndex],
        ...updates,
        processed_at: new Date().toISOString()
      };
      reversedMessages = updatedMessages.slice().reverse();
      return { ...state, messages: updatedMessages, displayMessages: reversedMessages };
    }
    case 'setProcessedMessages':
      if (!state) return null;
      messages = action.payload;
      reversedMessages = action.payload.slice().reverse();
      return { ...state, messages: messages, displayMessages: reversedMessages, isProcessingMessages: false };
    case 'setProcessingMessages':
      if (!state) return null;
      console.log("******** DISPATCH PROCESSING MESSAGES: ", action.payload);
      return { ...state, isProcessingMessages: action.payload };
    case 'setCallLimitReached':
      if (!state) return null;
      return { ...state, callLimitReached: action.payload };
    case 'setLoadingChatData':
      if (!state) return null;
      return { ...state, loadingChatData: action.payload };
    default:
      return state;
  }
};

// Create your context
const ChatDataContext = createContext<{
  state: ChatState | null;
  dispatch: React.Dispatch<ChatAction>;
} | undefined>(undefined);

// Create your provider component
export function ChatDataProvider({ children, chatId, initialData }: ChatProviderProps) {
  const [state, dispatch] = useReducer<React.Reducer<ChatState | null, ChatAction>>(chatDataReducer, null);
  const { token } = useAuth();
  const { readingAidService, isJapaneseReadingAidEnabledAndReady } = useReadingAid();
  const readingAidRef = useRef({ readingAidService, isJapaneseReadingAidEnabledAndReady });
  const hasProcessedWithReadingAid = useRef(false);
  
  // Update ref whenever values change
  readingAidRef.current = { readingAidService, isJapaneseReadingAidEnabledAndReady };
  
  // Debug: Log when this hook gets fresh values
  console.log("********** useChatData hook - fresh ReadingAid values:");
  console.log("  ready =", isJapaneseReadingAidEnabledAndReady, "service =", !!readingAidService);
  const processInitialData = async (chatData: ChatData): Promise<ProcessedMessage[]> => {
    const processedMessages: ProcessedMessage[] = await processMessages(chatData.chat.language, chatData.messages, readingAidService);
    return processedMessages;
  };

  const addInitialData = async (data: ChatData) => {
    const processedMessages = await processInitialData(data);
    console.log("********** initialData: ", data.messages);
    dispatch({ type: 'setChatData', payload: { 
      chat: data.chat,
      messages: processedMessages,
      displayMessages: processedMessages.slice().reverse(),
      user: data.user,
      message_limit_reached: data.message_limit_reached,
      chat_form_options: data.chat_form_options,
      isProcessingMessages: false,
      callLimitReached: false,
      loadingChatData: false,
    }});
  };

  const fetchChatData = async () => {
    console.log("🔍 fetchChatData called", { chatId, token: !!token });
    
    if (!chatId) {
      console.log("❌ No chatId, redirecting");
      router.replace("/(tabs)/speak");
      return;
    }

    if (!token) {
      console.error("❌ No auth token available");
      return;
    }

    try {
      console.log("🚀 Dispatching setLoadingChatData: true");
      dispatch({ type: 'setLoadingChatData', payload: true });
      
      const response = await fetch(`${API_URL}/api/v1/chats/${chatId}`, {
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
          // dispatch action for call limit reached
          dispatch({ type: 'setCallLimitReached', payload: true });
          return;
        }
        throw new Error("Failed to fetch chat data");
      }

      const data: ChatData = await response.json();
      // Use the same processing logic as initial data
      await addInitialData(data);
    } catch (error) {
      console.error("Error fetching chat data:", error);
    } finally {
      dispatch({ type: 'setLoadingChatData', payload: false });
    }
  };

  useEffect(() => {
    console.log("🔄 ChatDataProvider useEffect", { 
      hasState: !!state, 
      hasInitialData: !!initialData, 
      chatId, 
      hasToken: !!token,
      isReadingAidReady: isJapaneseReadingAidEnabledAndReady,
      hasProcessedWithReadingAid: hasProcessedWithReadingAid.current
    });
    
    if (!state) {
      if (initialData) {
        console.log("📥 Using initialData");
        addInitialData(initialData);
      } else if (chatId) {
        console.log("🌐 Fetching chat data");
        fetchChatData();
      } else {
        console.log("⏸️ No chatId, waiting");
      }
    } else if (isJapaneseReadingAidEnabledAndReady && !hasProcessedWithReadingAid.current) {
      console.log("✅ State already exists, but Japanese Reading Aid is now enabled, re-processing with reading aid");
      hasProcessedWithReadingAid.current = true;
      if (initialData) {
        console.log("📥 Re-processing initialData with reading aid");
        addInitialData(initialData);
      } else if (chatId) {
        console.log("🌐 Re-fetching chat data with reading aid");
        fetchChatData();
      } else {
        console.log("⏸️ No chatId, waiting");
      }
    } else {
      console.log("✅ State already exists, skipping");
    }
  }, [chatId, token, initialData, isJapaneseReadingAidEnabledAndReady]);


  return (
    <ChatDataContext.Provider value={{ state, dispatch }}>
      {children}
    </ChatDataContext.Provider>
  );
}

// Create a hook to use the context
export function useChatData() {
  const context = useContext(ChatDataContext);
  const { token } = useAuth();
  const { readingAidService, isJapaneseReadingAidEnabledAndReady } = useReadingAid();
  
  // Use ref to store current values that addMessage can access
  const readingAidRef = useRef({ readingAidService, isJapaneseReadingAidEnabledAndReady });
  
  // Update ref whenever values change
  readingAidRef.current = { readingAidService, isJapaneseReadingAidEnabledAndReady };

  if (context === undefined) {
    throw new Error('useChatData must be used within a ChatProvider');
  }

  const { state, dispatch } = context;

  const addMessage = async (message: Message) => {
    // Get fresh values from ref to avoid closure issues
    const { readingAidService: currentService, isJapaneseReadingAidEnabledAndReady: currentReady } = readingAidRef.current;
    
    dispatch({ type: 'setProcessingMessages', payload: true });
    try {
      const language = state?.chat?.language || 'english';
      
      const processedMessage = await processMessage(language, message, message.role, currentService);
      dispatch({ type: 'addMessage', payload: processedMessage });
    } finally {
      dispatch({ type: 'setProcessingMessages', payload: false });
    }
  };

  const addMessages = async (messages: Message[]) => {
    // Get fresh values from ref to avoid closure issues
    const { readingAidService: currentService, isJapaneseReadingAidEnabledAndReady: currentReady } = readingAidRef.current;
    dispatch({ type: 'setProcessingMessages', payload: true });
    try {
      const processedMessages = await processMessages(state?.chat?.language || 'english', messages, currentService);
      dispatch({ type: 'setProcessedMessages', payload: [...(state?.messages || []), ...processedMessages] });
    } finally {
      dispatch({ type: 'setProcessingMessages', payload: false });
    }
  };

  const updateMessages = async (messages: Message[]) => {
    // Get fresh values from ref to avoid closure issues
    const { readingAidService: currentService, isJapaneseReadingAidEnabledAndReady: currentReady } = readingAidRef.current;
    dispatch({ type: 'setProcessingMessages', payload: true });
    try {
      const processedMessages = await processMessages(state?.chat?.language || 'english', messages, currentService);
      dispatch({ type: 'setProcessedMessages', payload: processedMessages });
    } finally {
      dispatch({ type: 'setProcessingMessages', payload: false });
    }
  };

  // Helper to convert server setting names to UI setting names
  const getUISettingName = (serverSetting: string): string => {
    const mapping: Record<string, string> = {
      'auto_record': 'autoRecord',
      'auto_send': 'autoSend',
      'auto_send_threshold': 'autoSendThreshold',
      'auto_correct': 'autoCorrect',
      'guided_mode': 'guidedMode',
      'auto_translate': 'autoTranslate',
      'transcription_mode': 'transcriptionMode',
      'highlight_mode': 'highlightMode',
    };
    return mapping[serverSetting] || serverSetting;
  };

  const updateChatSetting = async (setting: string, value: string | boolean | number) => {
    if (!state?.chat?.id || !token) return false;

    // Special case: update transcription model when mode changes
    if (setting === 'transcription_mode') {
      // Note: transcriptionModel is handled separately in the UI
      // This is just for logging the model change
      console.log("Transcription mode changed to:", value, "model:", getTranscriptionModel(value as string));
    }

    dispatch({
      type: "updateChatSetting",
      payload: { [setting]: value },
    });

    try {
      const response = await fetch(
        `${API_URL}/api/v1/chat_settings/${state.chat.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat: {
              [setting]: value,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update chat settings");
      }

      // Update server state after successful API call
      if (state.chat[setting as keyof MutableChatSettingsData] !== value) {
        dispatch({
          type: "updateChatSetting",
          payload: { [setting]: value },
        });
      }

      return true;
    } catch (error) {
      console.error("Error updating chat settings:", error);
      // TODO add error message to state
      
      // Revert optimistic update on error
      const originalValue = state.chat[setting as keyof CompleteChatSettingsData];
      dispatch({
        type: "updateChatSetting",
        payload: { [setting]: originalValue },
      });
      
      return false;
    }
  };

  return {
    state,
    dispatch,
    addMessage,
    addMessages,
    updateMessages,
    updateChatSetting,
  };
}

