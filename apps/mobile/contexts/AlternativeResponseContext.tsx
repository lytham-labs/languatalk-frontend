import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from "react";
import { Message, ProcessedMessageData } from "@/types/chat";
import { AlternativeResponseService } from "@/services/AlternativeResponseService";
import { processGenericContent } from "@/utils/textProcessingUtils";
import { useAuth } from "./AuthContext";
import { useReadingAid } from "./ReadingAidContext";

interface AlternativeResponseContextType {
  alternativeResponse: string | Partial<ProcessedMessageData> | undefined;
  isLoading: boolean;
  isVisible: boolean;
  errorMessage: string | null;
  fetchAndShowAlternativeResponse: (
    item: Message,
    chat: any,
    ensureWebSocketConnection: () => Promise<boolean>
  ) => Promise<void>;
  setAndProcessAlternativeResponse: (text: string, language?: string) => Promise<void>;
  handleWebSocketAlternativeResponse: (response: { chat_message_id: string; text: string }, language: string) => void;
  showAlternativeModal: () => void;
  hideAlternativeModal: () => void;
  clearError: () => void;
}

const AlternativeResponseContext = createContext<
  AlternativeResponseContextType | undefined
>(undefined);

export const useAlternativeResponse = () => {
  const context = useContext(AlternativeResponseContext);
  if (!context) {
    throw new Error(
      "useAlternativeResponse must be used within an AlternativeResponseProvider"
    );
  }
  return context;
};

interface AlternativeResponseProviderProps {
  children: React.ReactNode;
}

export const AlternativeResponseProvider: React.FC<
  AlternativeResponseProviderProps
> = ({ children }) => {
  const [alternativeResponse, setAlternativeResponse] = useState<
    string | Partial<ProcessedMessageData> | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { token } = useAuth();
  const { readingAidService, isJapaneseReadingAidEnabledAndReady } =
    useReadingAid();
  const alternativeResponseService = useRef<AlternativeResponseService | null>(
    null
  );

  // Use ref to store current values that fetchAndShowAlternativeResponse can access
  const readingAidRef = useRef({
    readingAidService,
    isJapaneseReadingAidEnabledAndReady,
  });

  // Update ref whenever values change
  readingAidRef.current = {
    readingAidService,
    isJapaneseReadingAidEnabledAndReady,
  };

  // Initialize the service when token is available
  if (token && !alternativeResponseService.current) {
    alternativeResponseService.current = new AlternativeResponseService(token);
  }

  const fetchAndShowAlternativeResponse = useCallback(
    async (
      item: Message,
      chat: any,
      ensureWebSocketConnection: () => Promise<boolean>
    ) => {
      if (!alternativeResponseService.current) {
        setErrorMessage("Authentication required");
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      // If we already have an alternative response, just show it
      if (
        item.alternative_response &&
        typeof item.alternative_response === "string"
      ) {
        let processedText: string | Partial<ProcessedMessageData> | undefined =
          item.alternative_response;
        try {
          // Get fresh values from ref to avoid closure issues
          const { readingAidService: currentService } = readingAidRef.current;
          processedText = await processGenericContent(
            chat?.language,
            item.alternative_response,
            currentService
          );
        } catch (error) {
          console.error(
            "Error processing message in fetchAndShowAlternativeResponse: ",
            item.alternative_response
          );
        }
        setAlternativeResponse(processedText);
        setIsVisible(true);
        setIsLoading(false);
        return;
      }

      // Show modal immediately with loading state
      setIsVisible(true);

      // If we don't have an alternative response yet, fetch it
      if (!item.alternative_response) {
        if (!(await ensureWebSocketConnection())) {
          setErrorMessage("Please wait for connection to be established...");
          setIsLoading(false);
          return;
        }

        if (!chat) {
          setErrorMessage("Chat not available");
          setIsLoading(false);
          return;
        }

        try {
          const response = await alternativeResponseService.current.fetch(
            chat?.id,
            item.chat_message_id,
            item.content,
            chat?.language,
            null,
            chat?.client_provider,
            chat?.model
          );

          // Check if the response indicates processing has started
          if (response.message === 'Alternative response processing started') {
            // Keep loading state active - the actual response will come via WebSocket
            console.log("Alternative response processing started, waiting for WebSocket response");
          } else {
            // Handle unexpected response
            console.error("Unexpected response from alternative response service:", response);
            setErrorMessage("Unexpected response from server");
            setIsVisible(false);
          }
        } catch (error) {
          console.error("Error fetching alternative response:", error);
          setErrorMessage(
            "Failed to get alternative response. Please try again."
          );
          setIsVisible(false);
        }
      }

      // Don't set isLoading to false here - it will be set to false when the WebSocket response arrives
    },
    []
  );

  const showAlternativeModal = useCallback(() => {
    setIsVisible(true);
  }, []);

  const hideAlternativeModal = useCallback(() => {
    setIsVisible(false);
    setAlternativeResponse(undefined);
    setIsLoading(false);
    setErrorMessage(null);
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const setAndProcessAlternativeResponse = useCallback(async (text: string, language?: string) => {
    // Get fresh values from ref to avoid closure issues
    const { readingAidService: currentService } = readingAidRef.current;
    
    try {
      const processedText = await processGenericContent(language || 'english', text, currentService);
      setAlternativeResponse(processedText);
    } catch (error) {
      console.error("Error processing alternative response text:", error);
      // Fallback to raw text if processing fails
      setAlternativeResponse(text);
    }
  }, []);

  const handleWebSocketAlternativeResponse = useCallback((response: { chat_message_id: string; text: string }, language: string) => {
    // Set loading to false since we received the response
    setIsLoading(false);
    
    // Process the response text
    setAndProcessAlternativeResponse(response.text, language);
  }, [setAndProcessAlternativeResponse]);

  const value: AlternativeResponseContextType = {
    alternativeResponse,
    isLoading,
    isVisible,
    errorMessage,
    fetchAndShowAlternativeResponse,
    setAndProcessAlternativeResponse,
    handleWebSocketAlternativeResponse,
    showAlternativeModal,
    hideAlternativeModal,
    clearError,
  };

  return (
    <AlternativeResponseContext.Provider value={value}>
      {children}
    </AlternativeResponseContext.Provider>
  );
};
