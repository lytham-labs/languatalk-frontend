import { Stack } from 'expo-router';
import { StyleSheet, TouchableOpacity, Pressable, Platform } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import useUserStats from '@/services/api/useUserStats';
import SpeakHeaderLeft from '@/components/speak/SpeakHeaderLeft';
import { getFontSize } from '@/constants/Font';
import SpeakHeaderRight from '@/components/speak/SpeakHeaderRight';
import SpeakHeaderCenter from '@/components/speak/SpeakHeaderCenter';
import useUserSettings from '@/services/api/useUserSettings';
import { useFeatureFlag } from 'posthog-react-native';
import { Audio } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import { HeaderBackButton } from '@react-navigation/elements';
import { FontAwesome6 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/shared/ThemedText';

export default function SpeakLayout() {
    const colorScheme = useColorScheme();
    const { token } = useAuth();
    const { userStats, loading: statsLoading } = useUserStats(token);
    const { userSettings, loading: settingsLoading } = useUserSettings();
    const navigation = useNavigation();
    const router = useRouter();
    
    // Check if language switcher feature is enabled
    const headerLanguageSwitcher = useFeatureFlag('header-language-switcher');

    const navStyles = StyleSheet.create({
        backButton: {
          fontSize: getFontSize(16)
        }
    });

    // Determine if we should show the pro upgrade button
    const shouldShowProButton = userSettings?.user?.langua_pro_enabled === false;

    const handleBack = async () => {
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
        });
        navigation.goBack();
    };

    return (
    <Stack 
        screenOptions={{
            headerStyle: { backgroundColor: Colors[colorScheme ?? 'light'].background },
            headerTintColor: Colors[colorScheme ?? 'light'].text,
            headerBackTitleStyle: navStyles.backButton,
            headerTitleStyle: {
                fontWeight: 'bold',
                fontSize: getFontSize(16)
            },
            headerBackButtonMenuEnabled: false,
            headerLeft: ({ canGoBack }) => 
                canGoBack ? (
                    <HeaderBackButton
                        onPress={handleBack}
                        tintColor={Colors[colorScheme ?? 'light'].text}
                    />
                ) : undefined,
        }}
    >
        <Stack.Screen name="practice" options={{
            headerShown: false,
        }} />
        <Stack.Screen name="call" options={{
            headerShown: true,
            headerTitle: "Connecting...",
            headerTitleAlign: "center",
        }} />
        <Stack.Screen name="chat" options={{
            headerTitle: "Chat",
            headerTitleAlign: "center",
            headerBackVisible: false,
            headerLeft: () => (
                <Pressable 
                    className="flex flex-row items-center gap-2"
                    style={({ pressed }) => ({
                        opacity: pressed ? 0.7 : 1,
                        padding: 8,
                        marginLeft: 8,
                    })} 
                    onPress={() => router.back()}
                >
                    <FontAwesome6 
                        name="chevron-left" 
                        size={24} 
                        color={Colors[colorScheme ?? 'light'].text} 
                    />
                    <ThemedText>Back</ThemedText>
                </Pressable>
            ),
        }} />
        <Stack.Screen name="summary" options={{
            headerTitle: "Audio Summary",
            headerTitleAlign: "center",
            headerBackTitleStyle: navStyles.backButton,
            headerTitleStyle: {
                fontWeight: 'bold',
                fontSize: getFontSize(16)
            },
        }} />
        <Stack.Screen name="feedback" options={{
            headerTitle: "Feedback",
            headerTitleAlign: "center",
            headerBackTitleStyle: navStyles.backButton,
            headerTitleStyle: {
                fontWeight: 'bold',
                fontSize: getFontSize(16)
            },
        }} />
        <Stack.Screen name="index"
            options={{
            headerStyle: {
                backgroundColor: Colors[colorScheme ?? 'light'].background_brand
            },
            headerTintColor: Colors[colorScheme ?? 'light'].text,
            headerTitleStyle: {
                fontWeight: 'bold',
                fontSize: getFontSize(16)
            },
            headerBackTitleStyle: navStyles.backButton,
            headerShown: true,
            headerBackVisible: false,
            headerLeft: () => (
                <SpeakHeaderLeft userStats={userStats} userSettings={userSettings} />
            ),
            headerRight: () => (
                // Only render SpeakHeaderRight if user doesn't have pro enabled
                shouldShowProButton ? <SpeakHeaderRight /> : null
            ),
            headerTitle: headerLanguageSwitcher ? () => <SpeakHeaderCenter /> : "",
            headerTitleAlign: "center", 
        }}/>
    </Stack>
    );
}
