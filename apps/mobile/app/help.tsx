import React from 'react';
import { WebView } from 'react-native-webview';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function HelpScreen() {
  const colorScheme = useColorScheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Help & Support' }} />
      <WebView 
        source={{ uri: 'https://support.languatalk.com/category/125-langua' }}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
          </View>
        )}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        onLoad={(event) => { console.log("event.nativeEvent.url", event.nativeEvent.url) }}
      />
    </>
  );
} 