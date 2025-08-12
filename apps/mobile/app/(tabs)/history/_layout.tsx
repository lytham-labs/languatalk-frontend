import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getFontSize } from '@/constants/Font';

export default function HistoryLayout() {
  const colorScheme = useColorScheme();

  const navStyles = StyleSheet.create({
    backButton: {
      fontSize: getFontSize(16)
    }
  });
  return (
    <Stack>
      <Stack.Screen name="index" options={{
        title: 'History',
        headerStyle: {
          backgroundColor: Colors[colorScheme ?? 'light'].background_brand
        },
        headerBackTitleStyle: navStyles.backButton,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: getFontSize(16)
        },
      }} />
    </Stack>
  );
}
