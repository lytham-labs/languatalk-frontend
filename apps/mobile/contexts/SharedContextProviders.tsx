import React from 'react';
import * as Google from 'expo-auth-session/providers/google';
import { usePostHog, useFeatureFlag } from 'posthog-react-native';
import { 
  AuthProvider, 
  useAuth, 
  AuthConfig 
} from '@languatalk-frontend/data-access-auth';
import { 
  UserSettingsProvider, 
  useUserSettings, 
  UserSettingsConfig 
} from '@languatalk-frontend/data-access-user-settings';
import { 
  WebSocketProvider, 
  useWebSocket, 
  WebSocketConfig 
} from '@languatalk-frontend/data-access-websocket';
import { 
  ReadingAidProvider, 
  useReadingAid, 
  ReadingAidConfig 
} from '@languatalk-frontend/util-reading-aid';

import { createReactNativeAuthConfig } from '@/adapters/AuthAdapters';
import { createReactNativeUserSettingsConfig } from '@/adapters/UserSettingsAdapters';
import { createReactNativeWebSocketConfig } from '@/adapters/WebSocketAdapters';
import { createReactNativeReadingAidConfig } from '@/adapters/ReadingAidAdapters';

interface SharedContextProvidersProps {
  children: React.ReactNode;
}

// Internal component that uses auth context to provide other contexts
const InnerProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated, isLoading } = useAuth();
  const { userSettings } = useUserSettings();
  const isJapaneseReadingAidEnabled = useFeatureFlag('japanese-reading-aid-native');
  
  const getAuthToken = async () => token;
  
  // WebSocket config
  const webSocketConfig = createReactNativeWebSocketConfig(getAuthToken);
  
  // ReadingAid config
  const readingAidConfig = createReactNativeReadingAidConfig(
    isAuthenticated,
    isLoading,
    userSettings,
    isJapaneseReadingAidEnabled
  );

  return (
    <WebSocketProvider config={webSocketConfig}>
      <ReadingAidProvider config={readingAidConfig}>
        {children}
      </ReadingAidProvider>
    </WebSocketProvider>
  );
};

// UserSettings provider that wraps around auth
const UserSettingsWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const getAuthToken = async () => token;
  
  const userSettingsConfig = createReactNativeUserSettingsConfig(getAuthToken);
  
  return (
    <UserSettingsProvider config={userSettingsConfig}>
      <InnerProviders>
        {children}
      </InnerProviders>
    </UserSettingsProvider>
  );
};

// Main provider component
export const SharedContextProviders: React.FC<SharedContextProvidersProps> = ({ children }) => {
  const posthog = usePostHog();
  
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    redirectUri: 'com.strukturedkaos.languatalkapp:/login'
  });

  const authConfig = createReactNativeAuthConfig(request, promptAsync, posthog);

  return (
    <AuthProvider config={authConfig}>
      <UserSettingsWrapper>
        {children}
      </UserSettingsWrapper>
    </AuthProvider>
  );
};

// Re-export hooks for backward compatibility
export { 
  useAuth, 
  useUserSettings, 
  useWebSocket, 
  useReadingAid 
};