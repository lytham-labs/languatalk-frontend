import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getFontSize } from '@/constants/Font';

export default function SettingsLayout() {
  const colorScheme = useColorScheme();

  const navStyles = StyleSheet.create({
    backButton: {
      fontSize: getFontSize(16)
    }
  });
  return (
    <Stack>
      <Stack.Screen name="index" options={{
        title: 'Settings',
        headerStyle: {
          backgroundColor: Colors[colorScheme ?? 'light'].background_brand
        },
        headerBackTitleStyle: navStyles.backButton,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: getFontSize(16)
        },
      }} />
      <Stack.Screen name="chat-settings" options={{
        title: 'Chat Settings',
        headerStyle: {
          backgroundColor: Colors[colorScheme ?? 'light'].background
        },
        headerBackTitleStyle: navStyles.backButton,
        headerTintColor: Colors[colorScheme ?? 'light'].text,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: getFontSize(16),
        },
      }} />
      <Stack.Screen name="language-settings" options={{
        title: 'Learning Settings',
        headerStyle: {
          backgroundColor: Colors[colorScheme ?? 'light'].background
        },
        headerBackTitleStyle: navStyles.backButton,
        headerTintColor: Colors[colorScheme ?? 'light'].text,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: getFontSize(16)
        },
      }} />
      <Stack.Screen name="details" options={{
        title: 'My Details',
        headerStyle: {
          backgroundColor: Colors[colorScheme ?? 'light'].background
        },
        headerBackTitleStyle: navStyles.backButton,
        headerTintColor: Colors[colorScheme ?? 'light'].text,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: getFontSize(16)
        },
      }} />
      <Stack.Screen name="notifications" options={{
        title: 'Notifications',
        headerStyle: {
          backgroundColor: Colors[colorScheme ?? 'light'].background
        },
        headerBackTitleStyle: navStyles.backButton,
        headerTintColor: Colors[colorScheme ?? 'light'].text,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: getFontSize(16)
        },
      }} />
      <Stack.Screen name="subscription" options={{
        title: 'My Subscription',
        headerStyle: {
          backgroundColor: Colors[colorScheme ?? 'light'].background
        },
        headerBackTitleStyle: navStyles.backButton,
        headerTintColor: Colors[colorScheme ?? 'light'].text,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: getFontSize(16)
        },
      }} />
      <Stack.Screen name="manage-subscription" options={{
        title: 'Langua Pro',
        headerStyle: {
          backgroundColor: Colors[colorScheme ?? 'light'].background
        },
        headerBackTitleStyle: navStyles.backButton,
        headerBackTitle: "Back",
        headerTitleAlign: "center",
        headerTintColor: Colors[colorScheme ?? 'light'].text,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: getFontSize(16)
        },
      }} />
    </Stack>
  );
}
