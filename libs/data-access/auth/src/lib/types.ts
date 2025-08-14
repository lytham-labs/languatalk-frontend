export type AuthErrorCode = 
  | 'token_expired'
  | 'invalid_token'
  | 'user_not_found'
  | 'invalid_credentials'
  | 'validation_error'
  | 'signup_error'
  | 'invalid_refresh_token'
  | 'auth_error'
  | 'network_error'
  | 'initialization_error'
  | 'non_network_error';

export interface AuthUser {
  id: number;
  uuid: string;
  email: string;
  first_name?: string;
  last_name?: string;
  onboarding_completed?: boolean;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, receiveEmails: boolean) => Promise<void>;
  logout: () => void;
  googleSignIn: () => Promise<void>;
  appleSignIn: () => Promise<void>;
  createAuthenticatedRequest: (url: string, options?: RequestInit) => Promise<Response>;
}

// Platform abstraction interfaces
export interface AuthStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export interface AuthPlatformAdapter {
  OS: string;
  Version?: string;
  sessionId?: string;
}

export interface AuthSocialProvider {
  googleSignIn: () => Promise<{ 
    type: string; 
    authentication?: { idToken?: string }; 
    params?: { code?: string; error?: string }; 
    error?: { message?: string } 
  }>;
  appleSignIn: () => Promise<{ 
    identityToken: string | null; 
    fullName?: { givenName?: string; familyName?: string } 
  }>;
}

export interface AuthAnalyticsAdapter {
  identify: (uuid: string, properties?: Record<string, any>) => void;
  captureMessage: (message: string, options?: { 
    level?: string; 
    extra?: Record<string, any>; 
    tags?: Record<string, any> 
  }) => void;
  captureException: (error: Error, options?: { tags?: Record<string, any> }) => void;
}

export interface AuthRevenueAdapter {
  identifyUser: (user: { uuid: string; email: string }) => Promise<void>;
}

export interface AuthConfig {
  apiUrl: string;
  googleClientIds?: {
    web?: string;
    ios?: string;
    android?: string;
  };
  appleRedirectUri?: string;
  storageAdapter: AuthStorageAdapter;
  platformAdapter: AuthPlatformAdapter;
  socialProvider?: AuthSocialProvider;
  analyticsAdapter?: AuthAnalyticsAdapter;
  revenueAdapter?: AuthRevenueAdapter;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  user: AuthUser | null;
}

export interface LoginResponse {
  token?: string;
  access_token?: string;
  refresh_token?: string;
  id: number;
  uuid: string;
  email: string;
  first_name?: string;
  last_name?: string;
  onboarding_completed: boolean;
}

export interface SignupResponse extends LoginResponse {}

export interface SocialAuthResponse extends LoginResponse {}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
}

export interface ErrorResponse {
  code?: string;
  message?: string;
  errors?: Record<string, string[]>;
}