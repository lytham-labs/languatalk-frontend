export interface ReadingAidContextValue {
  isReadingAidFlagEnabled: boolean;
  isJapaneseReadingAidEnabledAndReady: boolean;
  isJapaneseReadingAidLoading: boolean;
  readingAidService: any;
  setChatLanguage: (language: string) => void;
}

// Platform abstraction interfaces
export interface ReadingAidConfig {
  isAuthenticated: boolean;
  isLoading: boolean;
  userSettings?: {
    team: {
      stream_language: string;
    };
  };
  featureFlagAdapter?: ReadingAidFeatureFlagAdapter;
  textServiceProvider: ReadingAidTextServiceProvider;
}

export interface ReadingAidFeatureFlagAdapter {
  isEnabled: (flag: string) => boolean;
}

export interface ReadingAidTextServiceProvider {
  getJapaneseTextService: () => any;
}

export interface ReadingAidState {
  isJapaneseReadingAidEnabledAndReady: boolean;
  isJapaneseReadingAidLoading: boolean;
  readingAidService: any;
  chatLanguage: string;
}