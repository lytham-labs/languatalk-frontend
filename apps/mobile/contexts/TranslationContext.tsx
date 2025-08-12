import React, { createContext, useContext, useState, useCallback } from 'react';
import { ProcessedMessage } from '@/types/chat';
import { useReadingAid } from '@/contexts/ReadingAidContext';
import { processGenericContent } from '@/utils/textProcessingUtils';

interface TranslationContextType {
  currentTranslation: string | null;
  currentOriginalText: string | null;
  processedOriginalText: string | Partial<ProcessedMessage> | undefined;
  isVisible: boolean;
  isLoading: boolean;
  showTranslationModal: (translation: string, originalText: string, language?: string, chatContextFlag?: boolean, japaneseReadingAidFlag?: boolean) => Promise<string | Partial<ProcessedMessage>>;
  hideTranslationModal: () => void;
  clearTranslationData: () => void;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};

interface TranslationProviderProps {
  children: React.ReactNode;
}

export const TranslationProvider: React.FC<TranslationProviderProps> = ({ children }) => {
  const [currentTranslation, setCurrentTranslation] = useState<string | null>(null);
  const [currentOriginalText, setCurrentOriginalText] = useState<string | null>(null);
  const [processedOriginalText, setProcessedOriginalText] = useState<string | Partial<ProcessedMessage> | undefined>(undefined);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { readingAidService } = useReadingAid();

  const showTranslationModal = useCallback(async (
    translation: string, 
    originalText: string, 
    language?: string,
    chatContextFlag?: boolean,
    japaneseReadingAidFlag?: boolean
  ) => {
    setCurrentTranslation(translation);
    setCurrentOriginalText(originalText);
    setIsVisible(true);
    setIsLoading(true);

    try {
      // Only process the original text if both flags are enabled
      if (chatContextFlag && japaneseReadingAidFlag) {
        const processed = await processGenericContent(
          language,
          originalText,
          readingAidService
        );
        setProcessedOriginalText(processed);
        setIsLoading(false);
        return processed;
      } else {
        // Use original text without processing
        setIsLoading(false);
        return originalText;
      }
    } catch (error) {
      console.error("Error processing original text:", error);
      // Fallback to original text if processing fails
      setProcessedOriginalText(originalText);
    } finally {
      setIsLoading(false);
    }
  }, [readingAidService]);

  const hideTranslationModal = useCallback(() => {
    setIsVisible(false);
  }, []);

  const clearTranslationData = useCallback(() => {
    setCurrentTranslation(null);
    setCurrentOriginalText(null);
    setProcessedOriginalText(undefined);
    setIsVisible(false);
    setIsLoading(false);
  }, []);

  const value: TranslationContextType = {
    currentTranslation,
    currentOriginalText,
    processedOriginalText,
    isVisible,
    isLoading,
    showTranslationModal,
    hideTranslationModal,
    clearTranslationData,
  };

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}; 