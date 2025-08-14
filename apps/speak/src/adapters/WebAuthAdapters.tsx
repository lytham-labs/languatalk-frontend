import { AuthConfig } from '@languatalk-frontend/data-access-auth';
import { railsJWTAuth } from './RailsJWTAuth';

// Web-specific storage adapter that uses Rails JWT keys with localStorage
const webStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    // Map auth library keys to Rails JWT keys
    if (key === 'languatalk_auth_token' || key === 'authToken') {
      return railsJWTAuth.getStoredToken();
    }
    if (key === 'languatalk_auth_user' || key === 'authUser') {
      const user = railsJWTAuth.getStoredUser();
      return user ? JSON.stringify(user) : null;
    }
    return localStorage.getItem(key);
  },
  
  async setItem(key: string, value: string): Promise<void> {
    // Handle auth data through Rails JWT auth system
    if (key === 'languatalk_auth_token') {
      // Token is handled by RailsJWTAuth.storeAuthData()
      return;
    }
    if (key === 'languatalk_auth_user') {
      // User is handled by RailsJWTAuth.storeAuthData()
      return;
    }
    localStorage.setItem(key, value);
  },
  
  async removeItem(key: string): Promise<void> {
    if (key === 'languatalk_auth_token' || key === 'languatalk_auth_user') {
      // Handled by RailsJWTAuth.clearAuthData()
      return;
    }
    localStorage.removeItem(key);
  }
};

// Web-specific analytics adapter with error tracking
const webAnalyticsAdapter = {
  identify: (uuid: string, properties?: Record<string, any>) => {
    console.log('Analytics identify:', uuid, properties);
    
    // In production:
    // if (process.env.NODE_ENV === 'production') {
    //   posthog.identify(uuid, properties);
    // }
  },
  
  captureMessage: (message: string, options?: { 
    level?: string; 
    extra?: Record<string, any>; 
    tags?: Record<string, any> 
  }) => {
    const level = options?.level || 'info';
    console.log(`[${level.toUpperCase()}] ${message}`, options?.extra);
    
    // In production, send to Sentry:
    // if (process.env.NODE_ENV === 'production') {
    //   Sentry.captureMessage(message, level);
    // }
  },
  
  captureException: (error: Error, options?: { tags?: Record<string, any> }) => {
    console.error('Auth error:', error, options?.tags);
    
    // In production:
    // if (process.env.NODE_ENV === 'production') {
    //   Sentry.captureException(error, { tags: options?.tags });
    // }
  }
};


// Web auth configuration with Rails JWT integration
export const webAuthConfig: AuthConfig = {
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  storageAdapter: webStorageAdapter,
  platformAdapter: {
    OS: 'web' as const,
    Version: '1.0.0'
  },
  analyticsAdapter: webAnalyticsAdapter,
  
  // Social providers (optional - for future implementation)
  socialProvider: {
    googleSignIn: async () => ({
      type: 'success',
      authentication: {
        idToken: 'mock-google-token'
      },
      params: undefined,
      error: undefined
    }),
    appleSignIn: async () => ({
      identityToken: 'mock-apple-token',
      fullName: { givenName: 'Mock', familyName: 'User' }
    })
  }
};

// Export the Rails JWT auth instance for direct use if needed
export { railsJWTAuth };