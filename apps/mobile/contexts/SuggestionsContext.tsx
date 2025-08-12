import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from "react";
import { SuggestedReplyService } from "@/services/SuggestedReplyService";
import { processGenericContent } from "@/utils/textProcessingUtils";
import { useAuth } from "./AuthContext";
import { useReadingAid } from "./ReadingAidContext";

interface SuggestionsContextType {
  suggestions: string[];
  processedSuggestions: any[];
  isVisible: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  fetchSuggestions: (
    chatId: number,
    chatMessageId: string | undefined,
    text: string,
    language: string,
    context: string | undefined
  ) => Promise<void>;
  handleWebSocketSuggestions: (response: { suggestions: string[] }, language: string) => void;
  processSuggestions: (suggestions: string[], language: string) => Promise<void>;
  showSuggestionsModal: () => void;
  hideSuggestionsModal: () => void;
  clearError: () => void;
  clearSuggestions: () => void;
}

const SuggestionsContext = createContext<SuggestionsContextType | undefined>(
  undefined
);

export const useSuggestions = () => {
  const context = useContext(SuggestionsContext);
  if (!context) {
    throw new Error(
      "useSuggestions must be used within a SuggestionsProvider"
    );
  }
  return context;
};

interface SuggestionsProviderProps {
  children: React.ReactNode;
}

export const SuggestionsProvider: React.FC<SuggestionsProviderProps> = ({
  children,
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [processedSuggestions, setProcessedSuggestions] = useState<any[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { token } = useAuth();
  const { readingAidService, isJapaneseReadingAidEnabledAndReady } = useReadingAid();
  const suggestedReplyService = useRef<SuggestedReplyService | null>(null);

  // Use ref to store current values that other functions can access
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
  if (token && !suggestedReplyService.current) {
    suggestedReplyService.current = new SuggestedReplyService(token);
  }

  const processSuggestions = useCallback(
    async (suggestions: string[], language: string) => {
      // Get fresh values from ref to avoid closure issues
      const { readingAidService: currentService } = readingAidRef.current;
      
      try {
        const processed = await Promise.all(
          suggestions.map(async (suggestion) => {
            try {
              return await processGenericContent(language, suggestion, currentService);
            } catch (error) {
              console.error("Error processing suggestion:", suggestion, error);
              // Fallback to raw text if processing fails
              return { content: suggestion };
            }
          })
        );
        setProcessedSuggestions(processed);
      } catch (error) {
        console.error("Error processing suggestions:", error);
        // Fallback to unprocessed suggestions
        setProcessedSuggestions([]);
      }
    },
    []
  );

  const fetchSuggestions = useCallback(
    async (
      chatId: number,
      chatMessageId: string | undefined,
      text: string,
      language: string,
      context: string | undefined
    ) => {
      if (!suggestedReplyService.current) {
        setErrorMessage("Authentication required");
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await suggestedReplyService.current.fetch(
          chatId,
          chatMessageId,
          text,
          language,
          context
        );

        if (response.error) {
          throw new Error(response.error);
        }

        // Check if the response contains suggestions directly or indicates processing has started
        if (response.suggestions && Array.isArray(response.suggestions)) {
          setSuggestions(response.suggestions);
          await processSuggestions(response.suggestions, language);
          setIsLoading(false);
        } else if (response.message === 'Suggestions processing started') {
          // Keep loading state active - the actual response will come via WebSocket
          console.log("Suggestions processing started, waiting for WebSocket response");
        } else {
          // Handle case where suggestions come back immediately
          console.log("Suggestions response:", response);
          const suggestionsList = response.suggestions || [];
          setSuggestions(suggestionsList);
          if (suggestionsList.length > 0) {
            await processSuggestions(suggestionsList, language);
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setErrorMessage(
          "Failed to get suggestions. Please try again."
        );
        setIsLoading(false);
      }
    },
    [processSuggestions]
  );

  const handleWebSocketSuggestions = useCallback(
    async (response: { suggestions: string[] }, language: string) => {
      // Set loading to false since we received the response
      setIsLoading(false);
      
      // Set the suggestions
      if (response.suggestions && Array.isArray(response.suggestions)) {
        setSuggestions(response.suggestions);
        await processSuggestions(response.suggestions, language);
      } else {
        console.error("Invalid suggestions format received:", response);
        setErrorMessage("Invalid suggestions format received");
      }
    },
    [processSuggestions]
  );

  const showSuggestionsModal = useCallback(() => {
    setIsVisible(true);
  }, []);

  const hideSuggestionsModal = useCallback(() => {
    setIsVisible(false);
    setIsLoading(false);
    setErrorMessage(null);
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setProcessedSuggestions([]);
    setIsVisible(false);
    setIsLoading(false);
    setErrorMessage(null);
  }, []);

  const value: SuggestionsContextType = {
    suggestions,
    processedSuggestions,
    isVisible,
    isLoading,
    errorMessage,
    fetchSuggestions,
    handleWebSocketSuggestions,
    processSuggestions,
    showSuggestionsModal,
    hideSuggestionsModal,
    clearError,
    clearSuggestions,
  };

  return (
    <SuggestionsContext.Provider value={value}>
      {children}
    </SuggestionsContext.Provider>
  );
};