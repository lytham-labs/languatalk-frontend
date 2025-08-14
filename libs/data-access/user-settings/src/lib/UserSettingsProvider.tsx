import React, { useState, useEffect } from 'react';
import { UserSettingsContext } from './UserSettingsContext';
import { 
  UserSettings, 
  UserSettingsConfig, 
  UserSettingsState 
} from './types';

interface UserSettingsProviderProps {
  children: React.ReactNode;
  config: UserSettingsConfig;
}

export const UserSettingsProvider: React.FC<UserSettingsProviderProps> = ({ 
  children, 
  config 
}) => {
  const [state, setState] = useState<UserSettingsState>({
    userSettings: null,
    loading: true,
    error: null,
    successMessage: null,
    lastFetchTime: Date.now(),
  });

  const updateState = (updates: Partial<UserSettingsState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const fetchUserSettings = async () => {
    const token = await config.getAuthToken();
    
    if (!token) {
      updateState({ 
        error: "No authentication token available",
        loading: false 
      });
      return;
    }

    try {
      updateState({ 
        loading: true, 
        error: null 
      });
      
      const response = await fetch(`${config.apiUrl}/api/v1/langua_settings`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user settings');
      }

      const data: UserSettings = await response.json();
      updateState({
        userSettings: data,
        lastFetchTime: Date.now()
      });
    } catch (err) {
      updateState({ 
        error: err instanceof Error ? err.message : 'Unknown error' 
      });
    } finally {
      updateState({ loading: false });
    }
  };

  const updateUserSettings = async (updatedSettings: Partial<UserSettings>) => {
    const token = await config.getAuthToken();
    
    if (!token) {
      updateState({ 
        error: "No authentication token available" 
      });
      return;
    }

    try {
      updateState({
        loading: true,
        error: null,
        successMessage: null,
      });

      // Optimistically update local state
      if (state.userSettings) {
        const optimisticUpdate = {
          ...state.userSettings,
          ...updatedSettings,
          team: {
            ...state.userSettings.team,
            ...(updatedSettings.team || {})
          }
        };
        updateState({ userSettings: optimisticUpdate });
      }

      const response = await fetch(`${config.apiUrl}/api/v1/langua_settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `${token}`,
        },
        body: JSON.stringify({ langua_settings: updatedSettings }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user settings');
      }

      const data: UserSettings = await response.json();
      updateState({
        userSettings: data,
        lastFetchTime: Date.now()
      });
    } catch (err) {
      // If we're offline, keep the optimistic update
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.log('Error updating settings:', errorMessage);
      
      // Only show error if not a network error
      if (!errorMessage.includes('Failed to fetch') && !errorMessage.includes('Network')) {
        updateState({ error: errorMessage });
      }
    } finally {
      updateState({ loading: false });
    }
  };

  useEffect(() => {
    // Only fetch if we have a way to get the token
    const initializeFetch = async () => {
      const token = await config.getAuthToken();
      if (token) {
        fetchUserSettings();
      } else {
        updateState({ loading: false });
      }
    };

    initializeFetch();
  }, [config.getAuthToken]);

  return (
    <UserSettingsContext.Provider
      value={{
        userSettings: state.userSettings,
        loading: state.loading,
        error: state.error,
        successMessage: state.successMessage,
        fetchUserSettings,
        updateUserSettings,
        lastFetchTime: state.lastFetchTime,
      }}
    >
      {children}
    </UserSettingsContext.Provider>
  );
};