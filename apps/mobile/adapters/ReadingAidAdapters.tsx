import { useFeatureFlag } from 'posthog-react-native';
import { 
  ReadingAidConfig,
  ReadingAidFeatureFlagAdapter,
  ReadingAidTextServiceProvider
} from '@languatalk-frontend/util-reading-aid';
import getJapaneseTextService from '@/services/JapaneseTextService';

// Feature flag adapter for React Native with PostHog
export const createReactNativeFeatureFlagAdapter = (
  useFeatureFlagHook: typeof useFeatureFlag
): ReadingAidFeatureFlagAdapter => ({
  isEnabled: (flag: string) => {
    // This is a workaround since we can't use hooks here directly
    // We'll handle this differently in the provider
    return true; // fallback
  },
});

// Text service provider for React Native
export const createReactNativeTextServiceProvider = (): ReadingAidTextServiceProvider => ({
  getJapaneseTextService: () => getJapaneseTextService(),
});

// Factory function to create ReadingAid config for React Native
export const createReactNativeReadingAidConfig = (
  isAuthenticated: boolean,
  isLoading: boolean,
  userSettings?: any,
  isJapaneseReadingAidEnabled?: boolean
): ReadingAidConfig => ({
  isAuthenticated,
  isLoading,
  userSettings,
  featureFlagAdapter: isJapaneseReadingAidEnabled !== undefined ? {
    isEnabled: () => isJapaneseReadingAidEnabled
  } : undefined,
  textServiceProvider: createReactNativeTextServiceProvider(),
});