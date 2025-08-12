import React, { useEffect, useState, createContext, useContext, useRef } from 'react';
import getJapaneseTextService from '@/services/JapaneseTextService';
import { useFeatureFlag } from 'posthog-react-native';
import useUserSettings from '@/services/api/useUserSettings';
import { useAuth } from '@/contexts/AuthContext';

interface ReadingAidContextValue {
  isReadingAidFlagEnabled: boolean;
  isJapaneseReadingAidEnabledAndReady: boolean;
  isJapaneseReadingAidLoading: boolean;
  readingAidService: any;
  setChatLanguage: (language: string) => void;
}

const ReadingAidContext = createContext<ReadingAidContextValue | null>(null);

export const ReadingAidProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isJapaneseReadingAidEnabledAndReady, setIsJapaneseReadingAidEnabledAndReady] = useState(false);
  const [isJapaneseReadingAidLoading, setIsJapaneseReadingAidLoading] = useState(false);
  const [readingAidService, setReadingAidService] = useState<any>(null);
  const isJapaneseReadingAidEnabled = useFeatureFlag('japanese-reading-aid-native');
  const { isAuthenticated, isLoading } = useAuth();
  const { userSettings } = useUserSettings();
  const [chatLanguage, setChatLanguageInternal] = useState<string>(userSettings?.team.stream_language ?? 'english');

  const setChatLanguage = (language: string) => {
    console.log('********** READING AID: setChatLanguage called with:', language);
    setChatLanguageInternal(language);
  };
  
  useEffect(() => {
    const preloadJapaneseService = async () => {
      console.log('Preloading Japanese text service...');
      setIsJapaneseReadingAidLoading(true);
      try {
        const japaneseTextService = getJapaneseTextService();
        await japaneseTextService.readyPromise;
        console.log('********** Japanese text service COMPLETED successfully');
        setReadingAidService(japaneseTextService);
        setIsJapaneseReadingAidEnabledAndReady(true);
        console.log('********** ReadingAid state updated: service set, ready = true');
      } catch (error) {
        console.error('Failed to preload Japanese text service:', error);
      } finally {
        setIsJapaneseReadingAidLoading(false);
      }
    };
    console.log('********** READING AID CHECK:');
    console.log('  chatLanguage:', chatLanguage);
    console.log('  isJapaneseReadingAidEnabled:', isJapaneseReadingAidEnabled);
    console.log('  isAuthenticated:', isAuthenticated);
    
    const shouldInitialize = !!(isAuthenticated && isJapaneseReadingAidEnabled && chatLanguage === 'japanese');
    console.log('  shouldInitialize:', shouldInitialize);
    
    if (shouldInitialize) {
      console.log('********** PRELOADING Japanese text service...');
      preloadJapaneseService();
    } else {
      console.log('********** NOT INITIALIZING - missing condition(s)');
      setIsJapaneseReadingAidLoading(false);
      setIsJapaneseReadingAidEnabledAndReady(false);
      setReadingAidService(null);
    }
  }, [isJapaneseReadingAidEnabled, chatLanguage, isAuthenticated]);

  return (
    <ReadingAidContext.Provider value={{
        isReadingAidFlagEnabled: isJapaneseReadingAidEnabled === true,
        isJapaneseReadingAidEnabledAndReady,
        isJapaneseReadingAidLoading,
        readingAidService: readingAidService,
        setChatLanguage: setChatLanguage,
    }}>
      {children}
    </ReadingAidContext.Provider>
  );
};

export const useReadingAid = (): ReadingAidContextValue => {
  const context = useContext(ReadingAidContext);
  if (!context) {
    throw new Error('useReadingAid must be used within a ReadingAidProvider');
  }
  return {
    isReadingAidFlagEnabled: context.isReadingAidFlagEnabled,
    isJapaneseReadingAidEnabledAndReady: context.isJapaneseReadingAidEnabledAndReady,
    isJapaneseReadingAidLoading: context.isJapaneseReadingAidLoading,
    readingAidService: context.readingAidService,
    setChatLanguage: context.setChatLanguage,
  };
};