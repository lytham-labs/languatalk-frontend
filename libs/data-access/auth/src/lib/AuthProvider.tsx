import React, { useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import { 
  AuthConfig, 
  AuthState, 
  AuthUser,
  LoginResponse,
  SignupResponse,
  SocialAuthResponse,
  RefreshTokenResponse,
  ErrorResponse
} from './types';

interface AuthProviderProps {
  children: React.ReactNode;
  config: AuthConfig;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, config }) => {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    token: null,
    user: null,
  });

  const updateState = (updates: Partial<AuthState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const isNetworkError = (error: Error): boolean => {
    const errorMessage = error.message.toLowerCase();
    return errorMessage.includes('network') || 
           errorMessage.includes('timeout') || 
           errorMessage.includes('fetch') ||
           errorMessage.includes('connection') ||
           error instanceof TypeError;
  };

  const refreshAccessToken = async (refreshToken: string): Promise<boolean> => {
    try {
      const deviceInfo = {
        device_id: config.platformAdapter.sessionId || 'unknown',
        device_name: `${config.platformAdapter.OS} ${config.platformAdapter.Version || 'unknown'}`,
      };
      
      const response = await fetch(`${config.apiUrl}/api/v1/token/refresh`, {
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
        const data: RefreshTokenResponse = await response.json();
        
        await config.storageAdapter.setItem('authToken', data.access_token);
        if (data.refresh_token) {
          await config.storageAdapter.setItem('refreshToken', data.refresh_token);
        }
        
        updateState({ token: data.access_token });
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
        hadToken: !!state.token,
        wasAuthenticated: state.isAuthenticated,
        platform: config.platformAdapter.OS,
        appVersion: process.env['NODE_ENV'] || 'production'
      };

      console.log('User logged out:', logoutEvent);
      
      // Only capture problematic logouts in analytics
      if (reason && ['invalid_token', 'token_expired', 'invalid_refresh_token', 'network_error', 'non_network_error', 'initialization_error'].includes(reason)) {
        config.analyticsAdapter?.captureMessage(`Authentication logout: ${reason}`, {
          level: 'warning',
          extra: logoutEvent,
          tags: {
            auth_action: 'logout',
            logout_reason: reason,
            platform: config.platformAdapter.OS
          }
        });
      }
      
      await config.storageAdapter.removeItem('authToken');
      await config.storageAdapter.removeItem('refreshToken');
      updateState({
        token: null,
        isAuthenticated: false,
        user: null
      });
    } catch (error) {
      console.error('Error during auth cleanup:', error);
      config.analyticsAdapter?.captureException(error as Error, {
        tags: { auth_action: 'cleanup_error' }
      });
    }
  };

  const initializeAuth = async () => {
    try {
      updateState({ isLoading: true });
      const storedToken = await config.storageAdapter.getItem('authToken');
      
      if (storedToken) {
        let lastError: Error | null = null;
        
        // Retry mechanism for network failures
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const response = await fetch(`${config.apiUrl}/api/v1/me`, {
              headers: {
                'Authorization': `Bearer ${storedToken}`,
              },
              signal: AbortSignal.timeout(10000), // 10 second timeout
            });

            if (response.ok) {
              const userData: AuthUser = await response.json();
              updateState({
                token: storedToken,
                isAuthenticated: true,
                user: userData
              });

              // Identify user with external services
              if (config.revenueAdapter) {
                await config.revenueAdapter.identifyUser({
                  uuid: userData.uuid,
                  email: userData.email
                });
              }

              if (config.analyticsAdapter) {
                config.analyticsAdapter.identify(userData.uuid, {
                  email: userData.email
                });
              }
              
              return; // Success, exit retry loop
            } else if (response.status === 401) {
              const errorData: ErrorResponse = await response.json().catch(() => ({ code: 'invalid_token' }));
              
              if (errorData.code === 'token_expired') {
                // Try to refresh the token
                const refreshToken = await config.storageAdapter.getItem('refreshToken');
                if (refreshToken) {
                  const refreshed = await refreshAccessToken(refreshToken);
                  if (refreshed) {
                    // Retry the original request with new token
                    const newToken = await config.storageAdapter.getItem('authToken');
                    const retryResponse = await fetch(`${config.apiUrl}/api/v1/me`, {
                      headers: {
                        'Authorization': `Bearer ${newToken!}`,
                      },
                      signal: AbortSignal.timeout(10000),
                    });
                    
                    if (retryResponse.ok) {
                      const userData: AuthUser = await retryResponse.json();
                      updateState({
                        isAuthenticated: true,
                        user: userData
                      });
                      
                      if (config.revenueAdapter) {
                        await config.revenueAdapter.identifyUser({
                          uuid: userData.uuid,
                          email: userData.email
                        });
                      }

                      if (config.analyticsAdapter) {
                        config.analyticsAdapter.identify(userData.uuid, {
                          email: userData.email
                        });
                      }
                      
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
            
            if (isNetworkError(lastError)) {
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
        
        // Track authentication resilience event
        config.analyticsAdapter?.captureMessage('Authentication check failed - kept user logged in', {
          level: 'warning',
          extra: {
            error: lastError?.message,
            attempts: 3,
            hadToken: !!storedToken,
            timestamp: new Date().toISOString(),
            platform: config.platformAdapter.OS
          },
          tags: {
            auth_action: 'retry_failed_but_kept_logged_in',
            error_type: lastError instanceof TypeError ? 'network_error' : 'other_error'
          }
        });
        
        // Assume user is still authenticated if we have a token but can't verify
        updateState({
          token: storedToken,
          isAuthenticated: true
          // Don't set user since we couldn't verify - it will be set on next successful API call
        });
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      // Only logout if it's clearly an auth-related error, not a network issue
      if (!isNetworkError(error as Error)) {
        await cleanupAuth('initialization_error');
      }
    } finally {
      updateState({ isLoading: false });
    }
  };

  const handleSocialLogin = async (
    provider: 'google' | 'apple',
    token: string | null,
    firstName?: string,
    lastName?: string
  ) => {
    console.log(`${provider} authentication starting...`);
    if (!token) throw new Error('No authentication token received');

    try {
      const platform = config.platformAdapter.OS;
      console.log(`Making request to ${config.apiUrl}/api/v1/auth/${provider}`);
      
      const response = await fetch(`${config.apiUrl}/api/v1/auth/${provider}`, {
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
        const errorData: ErrorResponse = await response.json();
        if (response.status === 401) {
          throw new Error('Authentication failed. Please try again or use a different sign-in method.');
        }
        throw new Error(errorData.message || `${provider} authentication failed`);
      }

      const data: SocialAuthResponse = await response.json();
      const newToken = data.token || data.access_token;
      const refreshToken = data.refresh_token;

      if (newToken) {
        await config.storageAdapter.setItem('authToken', newToken);
        if (refreshToken) {
          await config.storageAdapter.setItem('refreshToken', refreshToken);
        }
        await config.storageAdapter.setItem('onboardingCompleted', data.onboarding_completed.toString());
        
        const user: AuthUser = {
          id: data.id,
          uuid: data.uuid,
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          onboarding_completed: data.onboarding_completed
        };

        updateState({
          token: newToken,
          isAuthenticated: true,
          user
        });

        // Identify user with external services
        if (config.revenueAdapter) {
          await config.revenueAdapter.identifyUser({
            uuid: data.uuid,
            email: data.email
          });
        }

        if (config.analyticsAdapter) {
          config.analyticsAdapter.identify(data.uuid, {
            email: data.email
          });
        }
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
      const response = await fetch(`${config.apiUrl}/api/v1/sign_in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user: { email, password } }),
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json().catch(() => ({ code: 'auth_error', message: 'Login failed' }));
        if (errorData.code === 'invalid_credentials') {
          throw new Error('Invalid email or password');
        }
        throw new Error(errorData.message || 'Login failed');
      }

      const data: LoginResponse = await response.json();
      const newToken = data.token || data.access_token || response.headers.get('Authorization');
      const refreshToken = data.refresh_token;

      if (newToken) {
        await config.storageAdapter.setItem('authToken', newToken);
        if (refreshToken) {
          await config.storageAdapter.setItem('refreshToken', refreshToken);
        }
        await config.storageAdapter.setItem('onboardingCompleted', data.onboarding_completed.toString());
        
        const user: AuthUser = {
          id: data.id,
          uuid: data.uuid,
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          onboarding_completed: data.onboarding_completed
        };

        updateState({
          token: newToken,
          isAuthenticated: true,
          user
        });

        // Identify user with external services
        if (config.revenueAdapter) {
          await config.revenueAdapter.identifyUser({
            uuid: data.uuid,
            email: data.email
          });
        }

        if (config.analyticsAdapter) {
          config.analyticsAdapter.identify(data.uuid, {
            email: data.email
          });
        }
      } else {
        throw new Error('No token received in response');
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Track login failures
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = errorMessage.includes('Invalid email or password') ? 'invalid_credentials' : 'auth_error';
      
      config.analyticsAdapter?.captureMessage(`Authentication error: ${errorCode}`, {
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
          platform: config.platformAdapter.OS
        }
      });
      
      throw error;
    }
  };

  const signup = async (name: string, email: string, password: string, receiveEmails: boolean) => {
    try {
      const response = await fetch(`${config.apiUrl}/api/v1/sign_up`, {
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
        const errorData: ErrorResponse = await response.json().catch(() => ({ code: 'signup_error', message: 'Signup failed' }));
        if (errorData.code === 'validation_error' && errorData.errors) {
          const errorMessages = Object.entries(errorData.errors)
            .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
            .join('; ');
          throw new Error(errorMessages);
        }
        throw new Error(errorData.message || 'Signup failed');
      }

      const data: SignupResponse = await response.json();
      const newToken = data.token || data.access_token;
      const refreshToken = data.refresh_token;

      if (newToken) {
        await config.storageAdapter.setItem('authToken', newToken);
        if (refreshToken) {
          await config.storageAdapter.setItem('refreshToken', refreshToken);
        }
        await config.storageAdapter.setItem('onboardingCompleted', data.onboarding_completed.toString());
        
        const user: AuthUser = {
          id: data.id,
          uuid: data.uuid,
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          onboarding_completed: data.onboarding_completed
        };

        updateState({
          token: newToken,
          isAuthenticated: true,
          user
        });

        // Identify user with external services
        if (config.revenueAdapter) {
          await config.revenueAdapter.identifyUser({
            uuid: data.uuid,
            email: data.email
          });
        }

        if (config.analyticsAdapter) {
          config.analyticsAdapter.identify(data.uuid, {
            email: data.email
          });
        }
      } else {
        throw new Error('No token received in response');
      }
    } catch (error) {
      console.error('Signup error:', error);
      
      // Track signup failures
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = errorMessage.includes('validation') ? 'validation_error' : 'signup_error';
      
      config.analyticsAdapter?.captureMessage(`Authentication error: ${errorCode}`, {
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
          platform: config.platformAdapter.OS
        }
      });
      
      throw error;
    }
  };

  const createAuthenticatedRequest = async (url: string, options: RequestInit = {}): Promise<Response> => {
    let token = await config.storageAdapter.getItem('authToken');
    
    const makeRequest = async (authToken: string) => {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${authToken}`,
        },
      });
    };
    
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    let response = await makeRequest(token);
    
    // If token expired, try to refresh
    if (response && response.status === 401) {
      const errorData: ErrorResponse = await response.json().catch(() => ({ code: 'invalid_token' }));
      if (errorData.code === 'token_expired') {
        const refreshToken = await config.storageAdapter.getItem('refreshToken');
        if (refreshToken && await refreshAccessToken(refreshToken)) {
          // Retry with new token
          token = await config.storageAdapter.getItem('authToken');
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
      const refreshToken = await config.storageAdapter.getItem('refreshToken');
      
      if (state.token && refreshToken) {
        // Revoke refresh token on server
        try {
          await fetch(`${config.apiUrl}/api/v1/token/revoke`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
        } catch (error) {
          console.warn('Failed to revoke refresh token:', error);
        }
      }

      // Legacy logout endpoint for backward compatibility
      if (state.token) {
        try {
          const response = await fetch(`${config.apiUrl}/api/v1/sign_out`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${state.token}`
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
    if (!config.socialProvider) {
      throw new Error('Social provider not configured');
    }

    try {
      console.log('Initiating Google sign in...');
      const result = await config.socialProvider.googleSignIn();
      console.log('Google sign in result:', result);

      if (result.type === 'success') {
        const { authentication } = result;
        if (authentication?.idToken) {
          await handleSocialLogin('google', authentication.idToken);
        } else if (result.params?.code) {
          // Handle OAuth2 code flow
          await handleSocialLogin('google', result.params.code);
        } else {
          throw new Error('No authentication token or code received');
        }
      } else if (result.type === 'error') {
        if (result.params?.error === 'access_denied') {
          throw new Error('Sign in was cancelled');
        }
        throw new Error(result.error?.message || 'Google Sign In failed');
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
    if (!config.socialProvider) {
      throw new Error('Social provider not configured');
    }

    try {
      const credential = await config.socialProvider.appleSignIn();

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

  useEffect(() => {
    initializeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated: state.isAuthenticated, 
      isLoading: state.isLoading,
      token: state.token, 
      user: state.user,
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