import { UserSettingsConfig } from '@languatalk-frontend/data-access-user-settings';
import { API_URL } from '@/constants/api';

// Factory function to create UserSettings config for React Native
export const createReactNativeUserSettingsConfig = (
  getAuthToken: () => Promise<string | null>
): UserSettingsConfig => ({
  apiUrl: API_URL,
  getAuthToken,
});