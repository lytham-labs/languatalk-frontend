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

export interface UserSettingsContextType {
  userSettings: UserSettings | null;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  fetchUserSettings: () => Promise<void>;
  updateUserSettings: (updatedSettings: Partial<UserSettings>) => Promise<void>;
  lastFetchTime: number;
}

// Platform abstraction interfaces
export interface UserSettingsConfig {
  apiUrl: string;
  getAuthToken: () => Promise<string | null>;
}

export interface UserSettingsState {
  userSettings: UserSettings | null;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  lastFetchTime: number;
}