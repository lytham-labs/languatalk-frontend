// TODO: Backend Compatibility Cleanup
// Once the backend refresh token update is deployed, remove:
// 1. data.token fallbacks (use data.access_token only)
// 2. Legacy /api/v1/sign_out endpoint call in logout
// 3. Fallback error codes in catch blocks
// 4. response.headers.get('Authorization') fallback

import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { usePostHog } from 'posthog-react-native';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import {
  identifyUser
} from '@/lib/revenuecat';

WebBrowser.maybeCompleteAuthSession();

type AuthErrorCode = 
  | 'token_expired'
  | 'invalid_token'
  | 'user_not_found'
  | 'invalid_credentials'
  | 'validation_error'
  | 'signup_error'
  | 'invalid_refresh_token'
  | 'auth_error';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  user: { id: number } | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, receiveEmails: boolean) => Promise<void>;
  logout: () => void;
  googleSignIn: () => Promise<void>;
  appleSignIn: () => Promise<void>;
  createAuthenticatedRequest: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const posthog = usePostHog()

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    redirectUri: 'com.strukturedkaos.languatalkapp:/login'
  });

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        const storedToken = await AsyncStorage.getItem('authToken');
        if (storedToken) {
          let lastError: Error | null = null;
          
          // Retry mechanism for network failures
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              const response = await fetch(`${API_URL}/api/v1/me`, {
                headers: {
                  'Authorization': storedToken,
                },
                // Add timeout to prevent hanging
                signal: AbortSignal.timeout(10000), // 10 second timeout
              });

              if (response.ok) {
                const userData = await response.json();
                setToken(storedToken);
                setIsAuthenticated(true);
                setUserId(userData.id);

                await identifyUser({
                  uuid: userData.uuid,
                  email: userData.email
                });
                
                
                return; // Success, exit retry loop
              } else if (response.status === 401) {
                // TODO: Remove fallback error code after backend returns proper error codes
                const errorData = await response.json().catch(() => ({ code: 'invalid_token' }));
                
                if (errorData.code === 'token_expired') {
                  // Try to refresh the token
                  const refreshToken = await AsyncStorage.getItem('refreshToken');
                  if (refreshToken) {
                    const refreshed = await refreshAccessToken(refreshToken);
                    if (refreshed) {
                      // Retry the original request with new token
                      const newToken = await AsyncStorage.getItem('authToken');
                      const retryResponse = await fetch(`${API_URL}/api/v1/me`, {
                        headers: {
                          'Authorization': newToken!,
                        },
                        signal: AbortSignal.timeout(10000),
                      });
                      
                      if (retryResponse.ok) {
                        const userData = await retryResponse.json();
                        setIsAuthenticated(true);
                        setUserId(userData.id);
                        await identifyUser({
                          uuid: userData.uuid,
                          email: userData.email
                        });
                        return;
                      }
                    }
                  }
                }
                
                // If refresh fails or other 401 error, logout
                console.log('Auth token is invalid or refresh failed, logging out');
                await cleanupAuth(errorData.code || 'invalid_token');
                return;
              } else if (response.status === 403) {
                // Forbidden - logout immediately
                console.log('Access forbidden, logging out');
                await cleanupAuth('invalid_token');
                return;
              } else {
                // Server error (5xx) or other error - retry
                lastError = new Error(`Server responded with status ${response.status}`);
                console.log(`Auth check attempt ${attempt} failed with status ${response.status}, retrying...`);
              }
            } catch (error) {
              lastError = error as Error;
              
              // Check if it's a network error that should be retried
              const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
              const isNetworkError = errorMessage.includes('network') || 
                                   errorMessage.includes('timeout') || 
                                   errorMessage.includes('fetch') ||
                                   errorMessage.includes('connection') ||
                                   error instanceof TypeError;
              
              if (isNetworkError) {
                console.log(`Auth check attempt ${attempt} failed with network error, retrying...`, error);
              } else {
                // Non-network error, don't retry
                console.error('Auth check failed with non-network error:', error);
                await cleanupAuth('non_network_error');
                return;
              }
            }
            
            // Wait before retrying (exponential backoff)
            if (attempt < 3) {
              const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 1s, 2s, max 5s
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
          
          // All retries failed - keep user logged in but log the issue
          console.warn('Auth check failed after 3 attempts, keeping user logged in:', lastError);
          
          // Track authentication resilience event in Sentry
          Sentry.captureMessage('Authentication check failed - kept user logged in', {
            level: 'warning',
            extra: {
              error: lastError?.message,
              attempts: 3,
              hadToken: !!storedToken,
              timestamp: new Date().toISOString(),
              platform: Platform.OS
            },
            tags: {
              auth_action: 'retry_failed_but_kept_logged_in',
              error_type: lastError instanceof TypeError ? 'network_error' : 'other_error'
            }
          });
          
          // Assume user is still authenticated if we have a token but can't verify
          setToken(storedToken);
          setIsAuthenticated(true);
          // Don't set userId since we couldn't verify - it will be set on next successful API call
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        // Only logout if it's clearly an auth-related error, not a network issue
        const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
        const isNetworkError = errorMessage.includes('network') || 
                             errorMessage.includes('timeout') || 
                             errorMessage.includes('fetch') ||
                             errorMessage.includes('connection');
        
        if (!isNetworkError) {
          await cleanupAuth('initialization_error');
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const refreshAccessToken = async (refreshToken: string): Promise<boolean> => {
    try {
      const deviceInfo = {
        device_id: Constants.sessionId || 'unknown',
        device_name: `${Platform.OS} ${Platform.Version || 'unknown'}`,
      };
      
      const response = await fetch(`${API_URL}/api/v1/token/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
          ...deviceInfo
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        await AsyncStorage.setItem('authToken', data.access_token);
        if (data.refresh_token) {
          await AsyncStorage.setItem('refreshToken', data.refresh_token);
        }
        
        setToken(data.access_token);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  };

  const cleanupAuth = async (reason?: string) => {
    try {
      const logoutEvent = {
        reason: reason || 'manual_logout',
        timestamp: new Date().toISOString(),
        hadToken: !!token,
        wasAuthenticated: isAuthenticated,
        platform: Platform.OS,
        appVersion: __DEV__ ? 'development' : 'production'
      };

      // Log to console for development
      console.log('User logged out:', logoutEvent);
      
      // Only capture problematic logouts in Sentry (not manual logouts)
      if (reason && ['invalid_token', 'token_expired', 'invalid_refresh_token', 'network_error', 'non_network_error', 'initialization_error'].includes(reason)) {
        Sentry.captureMessage(`Authentication logout: ${reason}`, {
          level: 'warning',
          extra: logoutEvent,
          tags: {
            auth_action: 'logout',
            logout_reason: reason,
            platform: Platform.OS
          }
        });
      }
      
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('refreshToken');
      setToken(null);
      setIsAuthenticated(false);
      setUserId(null);
    } catch (error) {
      console.error('Error during auth cleanup:', error);
      Sentry.captureException(error, {
        tags: {
          auth_action: 'cleanup_error'
        }
      });
    }
  };

  useEffect(() => {
    const handleGoogleResponse = async () => {
      try {
        if (response?.type === 'success') {
          const { authentication } = response;
          if (authentication?.idToken) {
            await handleSocialLogin('google', authentication.idToken);
          } else if (response.params?.code) {
            // Handle OAuth2 code flow
            await handleSocialLogin('google', response.params.code);
          } else {
            throw new Error('No authentication token or code received');
          }
        } else if (response?.type === 'error') {
          if (response.params?.error === 'access_denied') {
            throw new Error('Sign in was cancelled');
          }
          throw new Error(response.error?.message || 'Google Sign In failed');
        }
      } catch (error) {
        console.log('Error in Google auth response:', error);
      }
    };

    if (response) {
      handleGoogleResponse().catch((error) => {
        console.log('Unhandled error in Google auth:', error);
      });
    }
  }, [response]);

  const handleSocialLogin = async (
    provider: 'google' | 'apple',
    token: string | null,
    firstName?: string,
    lastName?: string
  ) => {
    console.log(`${provider} authentication starting...`);
    if (!token) throw new Error('No authentication token received');

    try {
      const platform = Platform.OS;
      console.log(`Making request to ${API_URL}/api/v1/auth/${provider}`);
      
      const response = await fetch(`${API_URL}/api/v1/auth/${provider}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          social_auth: {
            token,
            provider,
            platform,
            first_name: firstName,
            last_name: lastName
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 401) {
          throw new Error('Authentication failed. Please try again or use a different sign-in method.');
        }
        throw new Error(errorData.error || `${provider} authentication failed`);
      }

      const data = await response.json();
      // TODO: Remove data.token fallback after backend refresh token update is deployed
      const newToken = data.token || data.access_token;
      const refreshToken = data.refresh_token;

      if (newToken) {
        await AsyncStorage.setItem('authToken', newToken);
        if (refreshToken) {
          await AsyncStorage.setItem('refreshToken', refreshToken);
        }
        await AsyncStorage.setItem('onboardingCompleted', data.onboarding_completed.toString());
        setToken(newToken);
        setIsAuthenticated(true);
        setUserId(data.id);

        await identifyUser({
          uuid: data.uuid,
          email: data.email
        });
      } else {
        throw new Error('No token received in response');
      }
    } catch (error) {
      console.error(`${provider} authentication error:`, error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/api/v1/sign_in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user: { email, password } }),
      });

      if (!response.ok) {
        // TODO: Remove fallback error handling after backend returns proper error codes
        const errorData = await response.json().catch(() => ({ code: 'auth_error', message: 'Login failed' }));
        if (errorData.code === 'invalid_credentials') {
          throw new Error('Invalid email or password');
        }
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await response.json();
      // TODO: Remove data.token fallback after backend refresh token update is deployed
      const newToken = data.token || data.access_token || response.headers.get('Authorization');
      const refreshToken = data.refresh_token;

      if (newToken) {
        await AsyncStorage.setItem('authToken', newToken);
        if (refreshToken) {
          await AsyncStorage.setItem('refreshToken', refreshToken);
        }
        await AsyncStorage.setItem('onboardingCompleted', data.onboarding_completed.toString());
        setToken(newToken);
        setIsAuthenticated(true);
        setUserId(data.id);

        await identifyUser({
          uuid: data.uuid,
          email: data.email
        });

        posthog.identify(data.uuid, {
          email: data.email
        })

      } else {
        throw new Error('No token received in response');
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Track login failures in Sentry
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = errorMessage.includes('Invalid email or password') ? 'invalid_credentials' : 'auth_error';
      
      Sentry.captureMessage(`Authentication error: ${errorCode}`, {
        level: 'warning',
        extra: {
          error_code: errorCode,
          error_message: errorMessage,
          email: email,
          timestamp: new Date().toISOString()
        },
        tags: {
          auth_action: 'login_failed',
          error_type: errorCode,
          platform: Platform.OS
        }
      });
      
      throw error;
    }
  };

  const signup = async (name: string, email: string, password: string, receiveEmails: boolean) => {
    try {
      const response = await fetch(`${API_URL}/api/v1/sign_up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: {
            email,
            password,
            first_name: name,
            accepts_marketing: receiveEmails
          }
        }),
      });

      if (!response.ok) {
        // TODO: Remove fallback error handling after backend returns proper error codes
        const errorData = await response.json().catch(() => ({ code: 'signup_error', message: 'Signup failed' }));
        if (errorData.code === 'validation_error' && errorData.errors) {
          const errorMessages = Object.entries(errorData.errors)
            .map(([field, errors]) => `${field}: ${(errors as string[]).join(', ')}`)
            .join('; ');
          throw new Error(errorMessages);
        }
        throw new Error(errorData.message || 'Signup failed');
      }

      const data = await response.json();
      // TODO: Remove data.token fallback after backend refresh token update is deployed
      const newToken = data.token || data.access_token;
      const refreshToken = data.refresh_token;

      if (newToken) {
        await AsyncStorage.setItem('authToken', newToken);
        if (refreshToken) {
          await AsyncStorage.setItem('refreshToken', refreshToken);
        }
        await AsyncStorage.setItem('onboardingCompleted', data.onboarding_completed.toString());
        setToken(newToken);
        setIsAuthenticated(true);
        setUserId(data.id);

        await identifyUser({
          uuid: data.uuid,
          email: data.email
        });
      } else {
        throw new Error('No token received in response');
      }
    } catch (error) {
      console.error('Signup error:', error);
      
      // Track signup failures in Sentry
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = errorMessage.includes('validation') ? 'validation_error' : 'signup_error';
      
      Sentry.captureMessage(`Authentication error: ${errorCode}`, {
        level: 'warning',
        extra: {
          error_code: errorCode,
          error_message: errorMessage,
          email: email,
          timestamp: new Date().toISOString()
        },
        tags: {
          auth_action: 'signup_failed',
          error_type: errorCode,
          platform: Platform.OS
        }
      });
      
      throw error;
    }
  };

  const createAuthenticatedRequest = async (url: string, options: RequestInit = {}): Promise<Response> => {
    let token = await AsyncStorage.getItem('authToken');
    
    const makeRequest = async (authToken: string) => {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': authToken,
        },
      });
    };
    
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    let response = await makeRequest(token);
    
    // If token expired, try to refresh
    if (response && response.status === 401) {
      const errorData = await response.json().catch(() => ({ code: 'invalid_token' }));
      if (errorData.code === 'token_expired') {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (refreshToken && await refreshAccessToken(refreshToken)) {
          // Retry with new token
          token = await AsyncStorage.getItem('authToken');
          if (token) {
            response = await makeRequest(token);
          }
        }
      }
    }
    
    return response;
  };

  const logout = async () => {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      
      if (token && refreshToken) {
        // Revoke refresh token on server
        try {
          await fetch(`${API_URL}/api/v1/token/revoke`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
        } catch (error) {
          console.warn('Failed to revoke refresh token:', error);
        }
      }

      // TODO: Remove legacy logout after backend refresh token update is deployed
      // Legacy logout endpoint for backward compatibility
      if (token) {
        try {
          const response = await fetch(`${API_URL}/api/v1/sign_out`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token
            },
          });

          if (!response.ok) {
            console.warn('Logout request to server failed, but proceeding with local logout');
          }
        } catch (error) {
          console.warn('Legacy logout failed:', error);
        }
      }

      await cleanupAuth('manual_logout');
    } catch (error) {
      console.error('Logout error:', error);
      await cleanupAuth('manual_logout');
    }
  };

  const googleSignIn = async () => {
    try {
      console.log('Initiating Google sign in...');
      const result = await promptAsync();
      console.log('Google sign in result:', result);

      // Wait for the useEffect to handle the response
      // The error will be propagated from the useEffect
      if (result.type === 'error') {
        if (result.params?.error === 'access_denied') {
          throw new Error('Sign in was cancelled');
        } else {
          console.log('Sign in was not successful:', result.type);
          throw new Error(result.error?.message || `Google Sign In failed with type: ${result.type}`);
        }
      }
    } catch (error: unknown) {
      console.error('Error during Google Sign In:', error);
      if (error instanceof Error) {
        if (error.message.includes('CANCELED') || 
            error.message.includes('cancelled') || 
            error.message.includes('access_denied')) {
          throw new Error('Sign in was cancelled');
        }
        throw error;
      }
      throw new Error('An unexpected error occurred during sign in');
    }
  };

  const appleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Extract first and last name if available
      const firstName = credential.fullName?.givenName || '';
      const lastName = credential.fullName?.familyName || '';

      // Pass first and last name separately
      await handleSocialLogin(
        'apple',
        credential.identityToken,
        firstName,
        lastName
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ERR_CANCELED') {
        // handle that the user canceled the sign-in flow
        throw new Error('Sign in was cancelled');
      } else {
        // handle other errors
        console.error('Error during Apple Sign In:', error);
        throw error;
      }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      isLoading,
      token, 
      user: userId ? { id: userId } : null,
      login, 
      signup, 
      logout, 
      googleSignIn, 
      appleSignIn,
      createAuthenticatedRequest
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
