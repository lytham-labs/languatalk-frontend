import React, { useEffect, useState } from 'react';
import { ReadingAidContext } from './ReadingAidContext';
import { 
  ReadingAidConfig, 
  ReadingAidState 
} from './types';

interface ReadingAidProviderProps {
  children: React.ReactNode;
  config: ReadingAidConfig;
}

export const ReadingAidProvider: React.FC<ReadingAidProviderProps> = ({ 
  children, 
  config 
}) => {
  const [state, setState] = useState<ReadingAidState>({
    isJapaneseReadingAidEnabledAndReady: false,
    isJapaneseReadingAidLoading: false,
    readingAidService: null,
    chatLanguage: config.userSettings?.team.stream_language ?? 'english',
  });

  const updateState = (updates: Partial<ReadingAidState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const setChatLanguage = (language: string) => {
    console.log('********** READING AID: setChatLanguage called with:', language);
    updateState({ chatLanguage: language });
  };

  useEffect(() => {
    const preloadJapaneseService = async () => {
      console.log('Preloading Japanese text service...');
      updateState({ isJapaneseReadingAidLoading: true });
      try {
        const japaneseTextService = config.textServiceProvider.getJapaneseTextService();
        await japaneseTextService.readyPromise;
        console.log('********** Japanese text service COMPLETED successfully');
        updateState({
          readingAidService: japaneseTextService,
          isJapaneseReadingAidEnabledAndReady: true
        });
        console.log('********** ReadingAid state updated: service set, ready = true');
      } catch (error) {
        console.error('Failed to preload Japanese text service:', error);
        updateState({
          readingAidService: null,
          isJapaneseReadingAidEnabledAndReady: false
        });
      } finally {
        updateState({ isJapaneseReadingAidLoading: false });
      }
    };

    console.log('********** READING AID CHECK:');
    console.log('  chatLanguage:', state.chatLanguage);
    console.log('  isAuthenticated:', config.isAuthenticated);
    
    const isJapaneseReadingAidEnabled = config.featureFlagAdapter?.isEnabled('japanese-reading-aid-native') ?? true;
    console.log('  isJapaneseReadingAidEnabled:', isJapaneseReadingAidEnabled);
    
    const shouldInitialize = !!(config.isAuthenticated && isJapaneseReadingAidEnabled && state.chatLanguage === 'japanese');
    console.log('  shouldInitialize:', shouldInitialize);
    
    if (shouldInitialize) {
      console.log('********** PRELOADING Japanese text service...');
      preloadJapaneseService();
    } else {
      console.log('********** NOT INITIALIZING - missing condition(s)');
      updateState({
        isJapaneseReadingAidLoading: false,
        isJapaneseReadingAidEnabledAndReady: false,
        readingAidService: null
      });
    }
  }, [state.chatLanguage, config.isAuthenticated, config.featureFlagAdapter, config.textServiceProvider]);

  const isJapaneseReadingAidEnabled = config.featureFlagAdapter?.isEnabled('japanese-reading-aid-native') ?? true;

  return (
    <ReadingAidContext.Provider value={{
      isReadingAidFlagEnabled: isJapaneseReadingAidEnabled,
      isJapaneseReadingAidEnabledAndReady: state.isJapaneseReadingAidEnabledAndReady,
      isJapaneseReadingAidLoading: state.isJapaneseReadingAidLoading,
      readingAidService: state.readingAidService,
      setChatLanguage: setChatLanguage,
    }}>
      {children}
    </ReadingAidContext.Provider>
  );
};