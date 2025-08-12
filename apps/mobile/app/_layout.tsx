import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Platform, Pressable, ActivityIndicator, I18nManager, NativeModules } from 'react-native';
import { PostHogProvider } from 'posthog-react-native';
import { POSTHOG_API_KEY, API_HOST } from '@/constants/posthog';
import { ThemedText } from '@/components/shared/ThemedText';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { ConfirmProvider } from 'react-native-confirm-dialog';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useRef } from 'react';
import { Colors } from '@/constants/Colors';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from 'nativewind';
import { UserSettingsProvider } from '@/contexts/UserSettingsContext';
import { ActionCableProvider } from '@/contexts/ActionCableWebSocketContext';
import { SafeAreaProvider,  initialWindowMetrics } from 'react-native-safe-area-context'
import { getFontSize } from '@/constants/Font';
import { ThemedView } from '@/components/shared/ThemedView';
import { ReadingAidProvider } from '@/contexts/ReadingAidContext';
// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Construct a new instrumentation instance for routing
const routingInstrumentation = new Sentry.ReactNavigationInstrumentation();

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  debug: __DEV__, // Enable debug in development only
  enabled: !__DEV__, // Disable in development
  integrations: [
    new Sentry.ReactNativeTracing({
      routingInstrumentation,
      enableNativeFramesTracking: !isRunningInExpoGo(),
      tracePropagationTargets: ['localhost', 'dondev.net', 'languatalk.com'],
    }),
  ],
  tracesSampleRate: 1.0,
});

// Force LTR layout for the entire app
I18nManager.allowRTL(false);
I18nManager.forceRTL(false); 

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { colorScheme } = useColorScheme();
  // Inside the RootLayoutNav function
  const [currentPathname, setCurrentPathname] = useState<string | null>(null);
  const previousPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    // Update the ref with the previous pathname before changing the state
    previousPathnameRef.current = currentPathname;
    setCurrentPathname(pathname); // Update state with the current pathname
  }, [pathname]);

  console.log(previousPathnameRef.current);

  useEffect(() => {
    if (isLoading) return;
    
    if (!isAuthenticated) {
      if (pathname !== '/landing' && pathname !== '/login') {
        router.replace('/landing');
      }
    } else {
      console.log('isAuthenticated', isAuthenticated);
      const checkOnboarding = async () => {
        const onboardingCompleted = await AsyncStorage.getItem('onboardingCompleted');
        if (onboardingCompleted !== 'true') {
          router.replace('/onboarding');
        } else if (segments.length === 1) {
          router.replace('/speak');
        }
      };
      checkOnboarding();
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].text} />
      </ThemedView>
    );
  }

  if (!isAuthenticated) {
    return (
      <Stack>
        <Stack.Screen
          name="landing"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors[colorScheme ?? 'light'].background_brand }
          }}
        />
        <Stack.Screen
          name="login"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors[colorScheme ?? 'light'].background_brand }
          }}
        />
        <Stack.Screen name="+not-found" />
        <Stack.Screen
          name="forgot-password"
          options={{ headerShown: false }}
        />
      </Stack>
    );
  }

  return (
    <Stack>
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors[colorScheme ?? 'light'].background_brand }
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="memories" options={{ 
        headerStyle: { backgroundColor: Colors[colorScheme ?? 'light'].background },
        headerTintColor: Colors[colorScheme ?? 'light'].text,
        headerBackTitle: "Back",
        headerTitle: "",
      }} />
      <Stack.Screen name="subscription" options={{ 
        headerStyle: { backgroundColor: Colors[colorScheme ?? 'light'].background_brand },
        headerTitle: "Langua Pro",
        headerBackTitle: "Back",
        headerTitleAlign: "center",
        headerTintColor: Colors[colorScheme ?? 'light'].text,
        headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: getFontSize(16)
        },
        headerRight: () => (
          previousPathnameRef.current === '/onboarding' ? (
            <Pressable onPress={() => router.replace('/(tabs)/speak')} hitSlop={20}>
              <ThemedText>Skip</ThemedText>
            </Pressable>
          ) : null
        )
      }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

const RootLayout = () => {
  const { colorScheme } = useColorScheme();

  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Lato-Regular': require('../assets/fonts/Lato-Regular.ttf'),
    'Lato-Medium': require('../assets/fonts/Lato-Medium.ttf'),
    'Lato-Bold': require('../assets/fonts/Lato-Bold.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <PostHogProvider apiKey={POSTHOG_API_KEY} options={{
          host: API_HOST,
          // disabled: __DEV__,
          enableSessionReplay: false,
          }}>
        <ConfirmProvider>
          <AuthProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <UserSettingsProvider>
                <ReadingAidProvider>
                  <ActionCableProvider>
                    <RootLayoutNav />
                  </ActionCableProvider>
                </ReadingAidProvider>
              </UserSettingsProvider>
            </ThemeProvider>
          </AuthProvider>
        </ConfirmProvider>
      </PostHogProvider>
    </SafeAreaProvider>
  );
}

// Wrap the Root Layout with Sentry
export default Sentry.wrap(RootLayout);
