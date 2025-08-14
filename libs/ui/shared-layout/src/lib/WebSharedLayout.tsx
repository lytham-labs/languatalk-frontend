import React from 'react';
import { SharedLayoutProps } from './types';
import { AuthProvider } from '@languatalk-frontend/data-access-auth';
import { UserSettingsProvider } from '@languatalk-frontend/data-access-user-settings';
import { useAuth } from '@languatalk-frontend/data-access-auth';

// Web-specific storage implementation
const webStorage = {
  getItem: async (key: string): Promise<string | null> => {
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    localStorage.removeItem(key);
  }
};

// Web-specific analytics (placeholder)
const webAnalytics = {
  identify: (uuid: string, data: any) => {
    console.log('Analytics identify:', { uuid, data });
  }
};

// Web-specific error tracking (placeholder)
const webErrorTracking = {
  captureMessage: (message: string, options?: any) => {
    console.warn('Error tracking:', message, options);
  },
  captureException: (error: Error, options?: any) => {
    console.error('Error tracking:', error, options);
  }
};

const UserSettingsWrapper: React.FC<{ children: React.ReactNode; apiUrl: string }> = ({ 
  children, 
  apiUrl 
}) => {
  const { token } = useAuth();
  
  return (
    <UserSettingsProvider token={token} apiUrl={apiUrl}>
      {children}
    </UserSettingsProvider>
  );
};

export const WebSharedLayout: React.FC<SharedLayoutProps> = ({
  children,
  config
}) => {
  return (
    <AuthProvider
      storage={webStorage}
      apiUrl={config.apiUrl}
      platform="web"
      socialAuthConfig={config.socialAuthConfig}
      analytics={webAnalytics}
      errorTracking={webErrorTracking}
    >
      <UserSettingsWrapper apiUrl={config.apiUrl}>
        {/* Add other providers here as needed */}
        {children}
      </UserSettingsWrapper>
    </AuthProvider>
  );
};