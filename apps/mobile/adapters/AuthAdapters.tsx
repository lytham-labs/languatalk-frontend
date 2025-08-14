import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Sentry from '@sentry/react-native';
import { 
  AuthStorageAdapter, 
  AuthPlatformAdapter, 
  AuthSocialProvider, 
  AuthAnalyticsAdapter, 
  AuthRevenueAdapter,
  AuthConfig 
} from '@languatalk-frontend/data-access-auth';
import { identifyUser } from '@/lib/revenuecat';
import { API_URL } from '@/constants/api';

WebBrowser.maybeCompleteAuthSession();

// Storage adapter using React Native AsyncStorage
export const createReactNativeStorageAdapter = (): AuthStorageAdapter => ({
  getItem: async (key: string) => {
    return await AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    await AsyncStorage.removeItem(key);
  },
});

// Platform adapter for React Native
export const createReactNativePlatformAdapter = (): AuthPlatformAdapter => ({
  OS: Platform.OS,
  Version: Platform.Version?.toString(),
  sessionId: Constants.sessionId,
});

// Social provider adapter for React Native with Expo
export const createReactNativeSocialProvider = (
  googleRequest: any,
  googlePromptAsync: any,
  posthog: any
): AuthSocialProvider => {
  return {
    googleSignIn: async () => {
      if (!googlePromptAsync) {
        throw new Error('Google authentication not initialized');
      }
      
      const result = await googlePromptAsync();
      return {
        type: result.type,
        authentication: result.authentication,
        params: result.params,
        error: result.error
      };
    },
    appleSignIn: async () => {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      return {
        identityToken: credential.identityToken,
        fullName: credential.fullName ? {
          givenName: credential.fullName.givenName || undefined,
          familyName: credential.fullName.familyName || undefined
        } : undefined
      };
    },
  };
};

// Analytics adapter using PostHog and Sentry
export const createReactNativeAnalyticsAdapter = (posthog: any): AuthAnalyticsAdapter => ({
  identify: (uuid: string, properties?: Record<string, any>) => {
    posthog.identify(uuid, properties);
  },
  captureMessage: (message: string, options?: { 
    level?: string; 
    extra?: Record<string, any>; 
    tags?: Record<string, any> 
  }) => {
    Sentry.captureMessage(message, {
      level: options?.level as any,
      extra: options?.extra,
      tags: options?.tags
    });
  },
  captureException: (error: Error, options?: { tags?: Record<string, any> }) => {
    Sentry.captureException(error, {
      tags: options?.tags
    });
  },
});

// Revenue adapter using RevenueCat
export const createReactNativeRevenueAdapter = (): AuthRevenueAdapter => ({
  identifyUser: async (user: { uuid: string; email: string }) => {
    await identifyUser(user);
  },
});

// Factory function to create complete auth config for React Native
export const createReactNativeAuthConfig = (
  googleRequest: any,
  googlePromptAsync: any,
  posthog: any
): AuthConfig => ({
  apiUrl: API_URL,
  googleClientIds: {
    web: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  },
  appleRedirectUri: 'com.strukturedkaos.languatalkapp:/login',
  storageAdapter: createReactNativeStorageAdapter(),
  platformAdapter: createReactNativePlatformAdapter(),
  socialProvider: createReactNativeSocialProvider(googleRequest, googlePromptAsync, posthog),
  analyticsAdapter: createReactNativeAnalyticsAdapter(posthog),
  revenueAdapter: createReactNativeRevenueAdapter(),
});