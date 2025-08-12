import { Stack } from "expo-router";
import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getFontSize } from '@/constants/Font';

export default function CardsLayout() {
  const colorScheme = useColorScheme();
  const navStyles = StyleSheet.create({
      backButton: {
        fontSize: getFontSize(16)
      }
    });

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Flashcards",
          headerStyle: {
            backgroundColor: Colors[colorScheme ?? 'light'].background_brand
          },
          headerTitleAlign: "center",
          headerBackTitleStyle: navStyles.backButton,
          headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: getFontSize(16)
          },
        }}
      />
      <Stack.Screen
        name="recall"
        options={{
          title: "Recall",
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="listen"
        options={{
          title: "Listen",
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="produce"
        options={{
          title: "Produce",
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="cloze"
        options={{
          title: "Cloze",
          headerShown: false,
          presentation: "card",
        }}
      />
    </Stack>
  );
}
