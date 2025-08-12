import React, { createContext, useState, useEffect } from 'react';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';


export interface UserUserSettings {
  id: number;
  uuid: string;
  email: string;
  first_name: string;
  last_name: string;
  time_zone: string;
  email_notifications_disabled: boolean;
  accepts_marketing: boolean;
  profile_picture: string;
  beta_features_enabled: boolean;
  langua_pro_enabled: boolean;
}
// Define the UserSettings interface
export interface UserSettings {
  user: UserUserSettings;
  team: {
    id: number;
    stream_language: string;
    stream_language_level: string;
    langua_native_language: string;
    preferred_dialect: string;
    stream_tags: string[] | null;
    day_streak: string[];
    stream_dialects: string[] | null;
    flashcards_ordering_technique: string;
    stream_onboarding_complete?: boolean;
    stream_onboarding_completed_at?: string;
    memory_enabled?: boolean;
    chat_settings: {
      voice: string;
      mode: string;
      speed: string;
      speed_multiplier: number;
      streaming_enabled: boolean;
      auto_record: boolean;
      auto_send: boolean;
      auto_send_threshold: number;
      auto_correct: boolean;
      auto_translate: string;
      subtopic: string | null;
      topic: string;
      topic_category: string;
      subtopic_category: string;
      ai_model: string;
      voice_model: string;
      transcription_mode: string;
      highlight_mode: 'word' | 'sentence' | 'off';
      repeat_corrections: boolean;
      do_not_ask_questions: boolean;
      guided_mode: boolean;
      practice_vocab_before_chat: boolean;
      pronunciation_characters?: string;
    };
  };
  chat_form_options: {
    mode_options: Record<string, string>;
    transcription_mode_options: Record<string, string>;
    voice_options: Record<string, string>;
    all_voice_options: string[];
    ai_model_options: Record<string, string>;
    speed_options: Record<string, string>;
    voice_model_options: Record<string, string>;
    pronunciation_options: [string, string][];
  };
}

interface UserSettingsContextProps {
  userSettings: UserSettings | null;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  fetchUserSettings: () => Promise<void>;
  updateUserSettings: (updatedSettings: Partial<UserSettings>) => Promise<void>;
  lastFetchTime: number;
}

export const UserSettingsContext = createContext<UserSettingsContextProps | undefined>(undefined);

export const UserSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());

  const fetchUserSettings = async () => {
    if (!token) {
      setError("No authentication token available");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/api/v1/langua_settings`, {
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
      setUserSettings(data);
      setLastFetchTime(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const updateUserSettings = async (updatedSettings: Partial<UserSettings>) => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      // Optimistically update local state
      if (userSettings) {
        const optimisticUpdate = {
          ...userSettings,
          ...updatedSettings,
          team: {
            ...userSettings.team,
            ...(updatedSettings.team || {})
          }
        };
        setUserSettings(optimisticUpdate);
      }

      const response = await fetch(`${API_URL}/api/v1/langua_settings`, {
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
      setUserSettings(data);
      // setSuccessMessage('Settings updated successfully');
      setLastFetchTime(Date.now());
    } catch (err) {
      // If we're offline, keep the optimistic update
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.log('Error updating settings:', errorMessage);
      // Only show error if not a network error
      if (!errorMessage.includes('Failed to fetch') && !errorMessage.includes('Network')) {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUserSettings();
    }
  }, [token]);

  return (
    <UserSettingsContext.Provider
      value={{
        userSettings,
        loading,
        error,
        successMessage,
        fetchUserSettings,
        updateUserSettings,
        lastFetchTime,
      }}
    >
      {children}
    </UserSettingsContext.Provider>
  );
};
