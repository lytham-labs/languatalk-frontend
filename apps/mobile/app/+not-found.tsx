import { Link, Stack, useRouter, usePathname } from 'expo-router';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { ThemedText } from '@/components/shared/ThemedText';
import { ThemedView } from '@/components/shared/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getIconSize } from '@/constants/Font';
import { useAuth } from '@/contexts/AuthContext';

export default function NotFoundScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  if (pathname === null || pathname === '/') {
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!', headerShown: false }} />
      <ThemedView style={styles.container}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <FontAwesomeIcon
            icon={faChevronLeft}
            size={getIconSize(24)}
            color={Colors[colorScheme ?? 'light'].text}
          />
        </TouchableOpacity>

        <ThemedText type="title">This screen doesn't exist.</ThemedText>
        <TouchableOpacity 
          onPress={() => router.replace(isAuthenticated ? '/(tabs)/speak' : '/login')}
          style={styles.link}
        >
          <ThemedText type="link">
            {isAuthenticated ? 'Go Home' : 'Return to Login'}
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  backButton: {
    position: 'absolute',
    top: 44,
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  helperText: {
    marginTop: 8,
    fontSize: getIconSize(14),
    opacity: 0.7,
    textAlign: 'center',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
