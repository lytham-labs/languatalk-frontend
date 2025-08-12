export const API_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST;
export const POSTHOG_API_KEY = __DEV__ ? process.env.EXPO_PUBLIC_POSTHOG_API_KEY_DEV : process.env.EXPO_PUBLIC_POSTHOG_API_KEY;