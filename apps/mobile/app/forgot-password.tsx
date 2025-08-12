import React, { useState } from 'react';
import cx from 'classnames';
import { View, TextInput, ScrollView, KeyboardAvoidingView, Platform, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/shared/ThemedText';
import Button from '@/components/shared/Button';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { API_URL } from '@/constants/api';
import { faEnvelope } from '@fortawesome/pro-duotone-svg-icons/faEnvelope';
import useDevice from '@/hooks/useDevice';
import { getIconSize, GlobalFontStyleSheet } from '@/constants/Font';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { isTablet, isPhone } = useDevice();

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user: { email } }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          'Success',
          'You will receive an email with instructions on how to reset your password.',
          [
            { 
              text: 'OK', 
              onPress: () => router.replace('/login') 
            }
          ]
        );
      } else {
        Alert.alert(
          'Error',
          data.status?.message || 'An error occurred. Please try again.'
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'Network error. Please check your connection.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-center items-center px-6"
        >
          <View className={cx("w-full", { "max-w-sm": isPhone, "max-w-2xl": isTablet })}>
            <Image 
              source={require('@/assets/images/favicon.png')}
              style={{ width: 100, height: 100, alignSelf: 'center', marginBottom: 20 }}
              resizeMode="contain"
            />

            <ThemedText className="text-2xl font-bold mb-6">
              Reset Password
            </ThemedText>

            <ThemedText className="mb-6">
              Enter your email address and we'll send you instructions to reset your password.
            </ThemedText>

            {error && (
              <View className="mb-4 p-3 bg-red-100 dark:bg-red-900 rounded-lg">
                <ThemedText className="text-red-600 dark:text-red-100 text-center">
                  {error}
                </ThemedText>
              </View>
            )}

            <TextInput
              className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg p-3 mb-4"
              style={GlobalFontStyleSheet.textInput}
              placeholder="Enter your email"
              placeholderTextColor={Colors[colorScheme].placeholderText}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Button 
              onPress={handleResetPassword}
              icon={faEnvelope}
              iconSize={getIconSize(16)}
              btnType='primary'
              titleSize='text-xl'
              title="Send Reset Instructions"
              centeredItems={true}
              containerClassNames='flex-none mb-4 text-center'
              disabled={isLoading}
            />

            <Button 
              onPress={() => router.replace('/login')}
              btnType='secondary'
              titleSize='text-xl'
              title="Back to Login"
              centeredItems={true}
              containerClassNames='flex-none text-center'
            />
          </View>
        </KeyboardAvoidingView>
      </ScrollView>
    </View>
  );
}
