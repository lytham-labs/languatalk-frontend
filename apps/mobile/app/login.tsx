import React, { useState, useEffect } from 'react';
import { Linking, Image, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, View, ScrollView, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { getFontSize, getIconSize } from '@/constants/Font';
import cx from 'classnames';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/shared/ThemedText';
import { ThemedView } from '@/components/shared/ThemedView';
import Button from '@/components/shared/Button';
import { faGoogle } from '@fortawesome/free-brands-svg-icons/faGoogle'
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { FontAwesome6 } from '@expo/vector-icons';
import { faUser } from '@fortawesome/pro-duotone-svg-icons/faUser';
import { faChevronLeft, faExclamationTriangle, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useDevice from '@/hooks/useDevice';
import { GlobalFontStyleSheet } from '@/constants/Font';
const PRIVACY_POLICY_URL = 'https://languatalk.com/blog/terms-and-privacy/#privacy-policy';
const TERMS_URL = 'https://languatalk.com/blog/terms-and-privacy/#terms-conditions';

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [receiveEmails, setReceiveEmails] = useState(true);
  const { login, signup, googleSignIn, appleSignIn } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [error, setError] = useState<string | null>(null);
  const { isTablet } = useDevice();
  const params = useLocalSearchParams();
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Clear error if we have a successful sign-in
    if (params.code) {
      setError(null);
    }
    // If we're in OAuth flow and there's an error, show error in the login form
    else if (params.error === 'access_denied') {
      setError('Sign in was cancelled');
    }
  }, [params]);

  useEffect(() => {
    // Initialize the mode: if "signup" query param is provided and equals "true", show Sign Up mode; otherwise show Log In mode.
    setIsSignUp(params.signup === 'true');
  }, [params.signup]);

  // If we're in OAuth flow and it's successful, show the redirect screen
  if (params.code && !error) {
    return (
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

        <ThemedView style={styles.content}>
          <ActivityIndicator 
            size="large" 
            color={Colors[colorScheme ?? 'light'].text}
            style={styles.spinner}
          />
          <ThemedText style={styles.loadingText}>Completing sign in...</ThemedText>
          <ThemedText style={styles.helpText}>
            If this takes too long, tap the back button to try again
          </ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  const handleAuth = async () => {
    setError(null);
    try {
      if (isSignUp) {
        if (!name || !email || !password) {
          setError('Please fill in all fields');
          return;
        }
        await signup(name, email, password, receiveEmails);
      } else {
        if (!email || !password) {
          setError('Please enter both email and password');
          return;
        }
        await login(email, password);
      }
    } catch (error: unknown) {
      console.error('Authentication failed:', error);
      if (error instanceof Error) {
        // Create user-friendly message with error details for support
        let userMessage = '';
        let errorCode = '';
        
        // Map technical errors to user-friendly messages
        if (error.message === 'Invalid email or password') {
          userMessage = 'Invalid email or password. Please check for typos and ensure you\'ve entered the correct email. Passwords are case-sensitive.';
          errorCode = 'invalid_credentials';
        } else if (error.message.includes('validation')) {
          userMessage = `Validation error: ${error.message}`;
          errorCode = 'validation_error';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          userMessage = 'Network error. Please check your connection and try again.';
          errorCode = 'network_error';
        } else if (error.message === 'Login failed' || error.message === 'Signup failed') {
          userMessage = isSignUp 
            ? 'Unable to create account. Please try again or contact support.'
            : 'Unable to sign in. Please check your credentials and try again.';
          errorCode = isSignUp ? 'signup_error' : 'auth_error';
        } else {
          userMessage = error.message;
          errorCode = 'unknown_error';
        }
        
        // Add error details for support
        const errorDetails = `\n\nError details for support:\nCode: ${errorCode}\nTime: ${new Date().toISOString()}`;
        setError(userMessage + errorDetails);
      } else {
        setError('An error occurred. Please try again.\n\nError details for support:\nCode: unknown_error\nTime: ' + new Date().toISOString());
      }
    }
  };

  const handleAppleSignIn = async () => {
    setError(null);
    try {
      await appleSignIn();
    } catch (error: unknown) {
      console.error('Apple Sign In failed:', error);
      if (error instanceof Error) {
        setError(
          error.message === 'ERR_CANCELED'
            ? 'Sign in was cancelled'
            : error.message || 'Apple sign in failed. Please try again.'
        );
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await googleSignIn();
    } catch (error: unknown) {
      console.error('Google Sign In failed:', error);
      if (error instanceof Error) {
        if (error.message.includes('cancelled') || error.message.includes('CANCELED')) {
          setError('Sign in was cancelled');
        } else if (error.message.includes('NETWORK_ERROR')) {
          setError('Network error. Please check your connection.');
        } else if (error.message.includes('access_denied')) {
          setError('Sign in was cancelled');
        } else {
          setError(error.message || 'Google sign in failed. Please try again.');
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    }
  };

  const SignInButtons = ({signup = true} : { signup: boolean}) => (
    <View className="flex-column justify-between w-full">
      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={ signup ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={ colorScheme === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={5}
          style={{ 
            height: (isTablet ? 75 : 50),
           }}
          onPress={handleAppleSignIn}
        />
      )}
      <Button onPress={handleGoogleSignIn} btnType='login' title={ signup ? 'Sign up with Google' : 'Sign in with Google'} titleSize='text-md' icon={faGoogle} iconSize={isTablet ? 24 : 18}  centeredItems={true} containerClassNames='flex-none mt-4 text-center' />
    </View>
  );

  const handleModeSwitch = (isSigningUp: boolean) => {
    setError(null); // Clear any errors when switching modes
    setIsSignUp(isSigningUp);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white dark:bg-gray-900"
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View className="flex-1 justify-center items-center px-6">
          <View className={cx("w-full", { "max-w-sm": !isTablet, "max-w-2xl": isTablet })}>
            <Image 
              source={require('@/assets/images/favicon.png')}
              style={{ width: 100, height: 100, alignSelf: 'center', marginBottom: 20 }}
              resizeMode="contain"
            />
            <View className="flex-row mb-6">
              <TouchableOpacity
                className={`flex-1 py-2 ${isSignUp ? 'border-b-2 border-blue-500' : ''}`}
                onPress={() => handleModeSwitch(true)}
              >
                <ThemedText className="text-center font-bold">Sign Up</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-2 ${!isSignUp ? 'border-b-2 border-blue-500' : ''}`}
                onPress={() => handleModeSwitch(false)}
              >
                <ThemedText className="text-center font-bold">Log In</ThemedText>
              </TouchableOpacity>
            </View>

            <ThemedText className="text-2xl font-bold mb-6">
              {isSignUp ? 'Create your free account' : 'Welcome back'}
            </ThemedText>

            {error && (
              <View 
                className="m-4 p-3 rounded-lg flex-row items-center"
                accessible={true}
                accessibilityLabel="Error message"
              >
                <FontAwesomeIcon
                  icon={faExclamationTriangle}
                  size={getIconSize(16)}
                  color={"rgb(234 88 12)"}
                  style={{ marginRight: 8 }}
                />
                <View className="flex-1">
                  <Text 
                    className="text-orange-600 dark:text-orange-400"
                    style={GlobalFontStyleSheet.textBase}
                  >
                    {error.split('\n\n')[0]}
                  </Text>
                  {error.includes('Error details') && (
                    <Text 
                      className="text-gray-500 dark:text-gray-400 mt-2"
                      style={[GlobalFontStyleSheet.textSm, { fontFamily: 'monospace' }]}
                    >
                      {error.split('\n\n')[1]}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {isSignUp && (
              <TextInput
                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg p-3 mb-4"
                style={styles.inputText}
                placeholder="Enter your name"
                placeholderTextColor={Colors[colorScheme || 'light'].text}
                value={name}
                onChangeText={setName}
              />
            )}

            <TextInput
              className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg p-3 mb-4"
              style={styles.inputText}
              placeholder="Enter your email"
              placeholderTextColor={Colors[colorScheme || 'light'].text}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={{ position: 'relative', width: '100%' }}>
              <TextInput
                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg p-3 mb-4 pr-10"
                style={styles.inputText}
                placeholder={isSignUp ? "Create a password" : "Password"}
                placeholderTextColor={Colors[colorScheme || 'light'].text}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              >
                <FontAwesomeIcon
                  icon={showPassword ? faEyeSlash : faEye}
                  size={getIconSize(20)}
                  color={Colors[colorScheme ?? 'light'].text}
                />
              </TouchableOpacity>
            </View>

            {isSignUp && (
              <View className="mb-4">
                <View className="flex-row flex-wrap items-center mb-2">
                  <ThemedText style={styles.legalText}>
                    By signing up, you agree to our{' '}
                  </ThemedText>
                  <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
                    <ThemedText style={[styles.legalText, colorScheme === 'dark' ? styles.linkTextDark : styles.linkTextLight]}>
                      Terms
                    </ThemedText>
                  </TouchableOpacity>
                  <ThemedText style={styles.legalText}>
                    {' '}and{' '}
                  </ThemedText>
                  <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
                    <ThemedText style={[styles.legalText, colorScheme === 'dark' ? styles.linkTextDark : styles.linkTextLight]}>
                      Privacy Policy
                    </ThemedText>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  className="flex-row items-center"
                  onPress={() => setReceiveEmails(!receiveEmails)}
                >
                  <FontAwesome6
                    name={receiveEmails ? 'check-square' : 'square'}
                    size={24}
                    color={Colors[colorScheme || 'light'].text}
                  />
                  <ThemedText className="ml-2">Get learning tips and offers via email</ThemedText>
                </TouchableOpacity>
              </View>
            )}

            <Button onPress={handleAuth} icon={faUser} iconSize={getIconSize(16)} btnType='primary' titleSize='text-md' title={isSignUp ? 'Sign Up' : 'Log In'} centeredItems={true} containerClassNames='flex-none my-4 text-center' />
            <SignInButtons signup={isSignUp}/>
            {!isSignUp && (
              <TouchableOpacity 
                onPress={() => router.replace('/forgot-password')}
                className="mb-4 pt-4"
              >
                <ThemedText className="text-blue-500 text-center">
                  Forgot your password?
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 44,
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  spinner: {
    marginBottom: 20,
  },
  loadingText: {
    fontSize: getIconSize(18),
    marginBottom: 12,
    textAlign: 'center',
  },
  helpText: {
    fontSize: getIconSize(14),
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 8,
  },
  label: {
    fontSize: getFontSize(16),
    lineHeight: getFontSize(24),
  },
  placeholder: {
    fontSize: getFontSize(16),
    lineHeight: getFontSize(24),
  },
  inputText: {
    fontSize: getFontSize(14),
    lineHeight: getFontSize(20),
  },
  link: {
    lineHeight: getFontSize(16),
    fontSize: getFontSize(16),
  },
  legalText: {
    fontSize: getFontSize(16),
    lineHeight: getFontSize(24),
  },
  linkTextLight: {
    color: Colors.light.tint,
    textDecorationLine: 'underline',
  },
  linkTextDark: {
    color: Colors.dark.tint,
    textDecorationLine: 'underline',
  },
  eyeIcon: {
    position: 'absolute',
    right: 20,
    top: '55%',
    transform: [{ translateY: -20 }],
  },
});
