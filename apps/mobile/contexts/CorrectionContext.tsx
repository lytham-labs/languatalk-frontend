import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Message, ProcessedMessage } from '@/types/chat';
import { TextCorrectionService } from '@/services/TextCorrectionService';
import { CorrectionExplanationService } from '@/services/CorrectionExplanationService';
import { useAuth } from '@/contexts/AuthContext';
import { useChatData } from '@/contexts/ChatDataContext';
import { useReadingAid } from '@/contexts/ReadingAidContext';
import { processGenericContent } from '@/utils/textProcessingUtils';

interface CorrectionContextType {
  selectedMessage: Message | null;
  processedCorrection: string | Partial<ProcessedMessage> | undefined;
  isVisible: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  fetchAndShowCorrection: (
    item: Message,
    previousMessage: Message | undefined,
    chat: any,
    ensureWebSocketConnection: () => Promise<boolean>
  ) => Promise<void>;
  handleWebSocketCorrection: (response: { chat_message_id: string; text: string }, language: string) => void;
  handleWebSocketCorrectionExplanation: (response: { chat_message_id: string; text: string }, language: string) => void;
  requestCorrectionExplanation: (item: Message, chat: any) => Promise<void>;
  showCorrectionModal: () => void;
  hideCorrectionModal: () => void;
  clearError: () => void;
}

const CorrectionContext = createContext<CorrectionContextType | undefined>(undefined);

export const useCorrection = () => {
  const context = useContext(CorrectionContext);
  if (context === undefined) {
    throw new Error('useCorrection must be used within a CorrectionProvider');
  }
  return context;
};

interface CorrectionProviderProps {
  children: React.ReactNode;
}

export const CorrectionProvider: React.FC<CorrectionProviderProps> = ({ children }) => {
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [processedCorrection, setProcessedCorrection] = useState<string | Partial<ProcessedMessage> | undefined>(undefined);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { token } = useAuth();
  const { dispatch: chatDataDispatch, state: chatData } = useChatData();
  const { readingAidService } = useReadingAid();

  // Create refs for services to ensure we always have the latest token
  const textCorrectionServiceRef = useRef<TextCorrectionService | null>(null);
  const correctionExplanationServiceRef = useRef<CorrectionExplanationService | null>(null);

  // Update service instances when token changes
  if (token) {
    textCorrectionServiceRef.current = new TextCorrectionService(token);
    correctionExplanationServiceRef.current = new CorrectionExplanationService(token);
  }

  const fetchAndShowCorrection = useCallback(
    async (
      item: Message,
      previousMessage: Message | undefined,
      chat: any,
      ensureWebSocketConnection: () => Promise<boolean>
    ) => {
      setSelectedMessage(item);
      setIsVisible(true);
      setErrorMessage(null);

      // If we already have a correction, process and show it
      if (item.correction) {
        setIsLoading(false);
        try {
          const processed = await processGenericContent(
            chat?.language,
            item.correction,
            readingAidService
          );
          setProcessedCorrection(processed);
        } catch (error) {
          setProcessedCorrection(item.correction);
        }
        return;
      }

      // If we don't have a correction yet, fetch it
      setIsLoading(true);
      if (!(await ensureWebSocketConnection())) {
        setErrorMessage("Please wait for connection to be established...");
        setIsLoading(false);
        return;
      }
      if (!chat || !textCorrectionServiceRef.current) {
        setErrorMessage("Failed to initialize correction service");
        setIsLoading(false);
        return;
      }
      try {
        await textCorrectionServiceRef.current.fetchCorrection(
          chat.id.toString(),
          item.chat_message_id,
          item.content,
          chat.language,
          previousMessage?.content || null,
          chat.client_provider,
          chat.model
        );
        // Don't set isLoading to false here - it will be set to false when the WebSocket response arrives
      } catch (error) {
        console.error("Error fetching correction:", error);
        setIsLoading(false);
        setErrorMessage("Failed to get correction. Please try again.");
        setIsVisible(false);
      }
    },
    [readingAidService]
  );

  const handleWebSocketCorrection = useCallback((response: { chat_message_id: string; text: string }, language: string) => {
    setIsLoading(false);
    chatDataDispatch({
      type: "updateMessageProp",
      payload: {
        response_msg_id: response.chat_message_id,
        correction: response.text,
      }
    });
    setSelectedMessage((prev) =>
      prev?.chat_message_id === response.chat_message_id
        ? { ...prev, correction: response.text }
        : prev
    );
    // Process the correction for the modal
    processGenericContent(language, response.text, readingAidService)
      .then(setProcessedCorrection)
      .catch(() => setProcessedCorrection(response.text));
  }, [chatDataDispatch, readingAidService, selectedMessage]);

  const handleWebSocketCorrectionExplanation = useCallback((response: { chat_message_id: string; text: string }, language: string) => {
    setIsLoading(false);

    // Update the message in the chat data
    chatDataDispatch({
      type: "updateMessageProp",
      payload: {
        response_msg_id: response.chat_message_id,
        correction_explanation: response.text,
      }
    });

    // Update the selected message if it matches
    setSelectedMessage((prev) =>
      prev?.chat_message_id === response.chat_message_id
        ? { ...prev, correction_explanation: response.text }
        : prev
    );
  }, [chatDataDispatch]);

  const requestCorrectionExplanation = useCallback(async (item: Message, chat: any) => {
    // If we already have the explanation, no need to fetch
    if (item.correction_explanation) {
      return;
    }

    setIsLoading(true);

    if (!correctionExplanationServiceRef.current || !chat) {
      setErrorMessage("Failed to initialize correction explanation service");
      setIsLoading(false);
      return;
    }

    // Find the previous AI message using the same pattern as in chat_unflagged.tsx
    let previousAIMessageContent = "";
    if (chatData?.messages) {
      const messageIndex = chatData.messages.findIndex(msg => msg.chat_message_id === item.chat_message_id);
      if (messageIndex !== -1) {
        const previousMessages = chatData.messages.slice(0, messageIndex).reverse();
        const previousAIMessage = previousMessages.find(msg => msg.role === 'assistant');
        if (previousAIMessage) {
          previousAIMessageContent = previousAIMessage.content;
        }
      }
    }

    try {
      // This will trigger a WebSocket response that will be handled by handleWebSocketCorrectionExplanation
      const response = await correctionExplanationServiceRef.current.fetchExplanation(
        chat.id,
        item.chat_message_id,
        item.correction || "",
        previousAIMessageContent, // Use the found previous AI message content
        item.content,
        chat.language,
        chat.client_provider,
        chat.model
      );
      if (response.error) {
        throw new Error(response.error);
      }
      // Don't set isLoading to false here - it will be set to false when the WebSocket response arrives
    } catch (error) {
      console.error("Error fetching correction explanation:", error);
      setIsLoading(false);
      setErrorMessage("Failed to get explanation. Please try again.");
    }
  }, [chatData]);

  const showCorrectionModal = useCallback(() => {
    setIsVisible(true);
  }, []);

  const hideCorrectionModal = useCallback(() => {
    setIsVisible(false);
    setSelectedMessage(null);
    setIsLoading(false);
    setErrorMessage(null);
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const value: CorrectionContextType = {
    selectedMessage,
    processedCorrection,
    isVisible,
    isLoading,
    errorMessage,
    fetchAndShowCorrection,
    handleWebSocketCorrection,
    handleWebSocketCorrectionExplanation,
    requestCorrectionExplanation,
    showCorrectionModal,
    hideCorrectionModal,
    clearError,
  };

  return (
    <CorrectionContext.Provider value={value}>
      {children}
    </CorrectionContext.Provider>
  );
}; 