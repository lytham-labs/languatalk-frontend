import React, { useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import { usePostHog } from 'posthog-react-native';
import { AuthProvider, useAuth } from '@languatalk-frontend/data-access-auth';
import { createReactNativeAuthConfig } from '@/adapters/AuthAdapters';

interface SharedAuthProviderProps {
  children: React.ReactNode;
}

export const SharedAuthProvider: React.FC<SharedAuthProviderProps> = ({ children }) => {
  const posthog = usePostHog();
  
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    redirectUri: 'com.strukturedkaos.languatalkapp:/login'
  });

  const authConfig = createReactNativeAuthConfig(request, promptAsync, posthog);

  // Handle Google response in the main provider  
  useEffect(() => {
    const handleGoogleResponse = async () => {
      try {
        if (response?.type === 'success') {
          const { authentication } = response;
          if (authentication?.idToken) {
            // This will be handled internally by the shared provider
            console.log('Google authentication successful');
          } else if (response.params?.code) {
            // Handle OAuth2 code flow
            console.log('Google OAuth2 code flow successful');
          } else {
            throw new Error('No authentication token or code received');
          }
        } else if (response?.type === 'error') {
          if (response.params?.error === 'access_denied') {
            throw new Error('Sign in was cancelled');
          }
          throw new Error(response.error?.message || 'Google Sign In failed');
        }
      } catch (error) {
        console.log('Error in Google auth response:', error);
      }
    };

    if (response) {
      handleGoogleResponse().catch((error) => {
        console.log('Unhandled error in Google auth:', error);
      });
    }
  }, [response]);

  return (
    <AuthProvider config={authConfig}>
      {children}
    </AuthProvider>
  );
};

// Re-export the useAuth hook for backward compatibility
export { useAuth };