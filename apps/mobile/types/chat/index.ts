export type HighlightMode = 'word' | 'sentence' | 'off';

export type PronunciationCharacters = 'disabled' | 'hiragana' | 'romaji';

export interface FormattingState {
  isBold?: boolean;
  isDeleted?: boolean;
  isItalic?: boolean;
  isUnderlined?: boolean;
  // Add more formatting states as needed
}

export interface Message {
  id: number;
  role: string;
  content: string;
  avatar_url: string;
  target_language: string;
  target_language_text: string;
  english_text: string;
  correction: any;
  translation: string;
  alternative_response: any;
  correction_explanation: any;
  audio_url: string;
  slow_audio_url: string | null;
  word_timings: any;
  created_at: string;
  chat_message_id: string;
  hide_text: boolean;
  audio_only: boolean;
  highlight_mode: 'word' | 'sentence' | 'off';
  showCorrection?: boolean;
}
export interface ProcessedMessage extends Message {
  processed_at: string;
  lines?: Line[];
  messageSegmentTextArray?: string[]; // multiple segment translation selection
}

export interface ProcessedMessageData {
  processed_at: string;
  lines?: Line[];
  messageSegmentTextArray?: string[]; // multiple segment translation selection
}

export interface Line {
  text: string;
  pressableSegments: PressableSegment[];
}

export interface Segment {
  baseText : string;  // base text
  romaji?: string; // romaji text
  hiragana?: string; // hiragana text
  pinyin?: string; // pinyin text
  formatting?: FormattingState; // New formatting state for rendering
}

export interface PressableSegment {
  text: string;
  type: 'plain' | 'ruby';
  isBold?: boolean;
  start_time?: number;
  end_time?: number;
  segments: Segment[];
  messageSegmentIndex?: number; // index of the segment in the message
}

interface ImmutableChatSettingsData {
  id: number;
  language: string;
  language_code: string;
  voice_provider: string;
  speed: string;
  streaming_enabled: boolean;
  topic: string;
  subtopic_category: string;
  topic_category: string;
  client_provider: string;
  model: string;
  dialect_code: string;
  avatar_url: string;
  created_at: string;
  updated_at: string;
  name: string;
  saved_vocabulary: string[];
  translated_vocabulary: string[];
}
export interface MutableChatSettingsData {
  ai_model: string;
  mode: string;
  auto_record: boolean;
  auto_send: boolean;
  auto_send_threshold: number;
  auto_correct: boolean;
  do_not_ask_questions: boolean;
  guided_mode: boolean;
  auto_translate: string;
  pronunciation_characters: string | null;
  transcription_mode: string;
  transcription_model: string;
  highlight_mode: HighlightMode;   
  voice: string;
  speed_multiplier: number;
  repeat_corrections: boolean;
}

export interface MutableChatSettings {
  aiModel: string;
  autoCorrect: boolean;
  autoRecord: boolean;
  autoSend: boolean;
  autoSendThreshold: number;
  autoTranslate: string;
  doNotAskQuestions: boolean;
  guidedMode: boolean;
  highlightMode: HighlightMode;
  mode: string;
  pronunciationCharacters?: string | null;
  repeatCorrections: boolean;
  speedMultiplier: number;
  transcriptionMode: string;
  transcriptionModel: string;
  voice: string;
};

export interface ChatSettingsData {
    id: number;
    language: string;
    language_code: string;
    mode: string;
    voice: string;
    voice_provider: string;
    speed: string;
    streaming_enabled: boolean;
    auto_send: boolean;
    auto_send_threshold: number;
    auto_record: boolean;
    auto_correct: boolean;
    auto_translate: string;
    topic: string;
    subtopic_category: string;
    topic_category: string;
    client_provider: string;
    model: string;
    transcription_mode: string;
    ai_model: string;
    dialect_code: string;
    avatar_url: string;
    created_at: string;
    updated_at: string;
    highlight_mode: string;
    name: string;
    guided_mode: boolean;
    saved_vocabulary: string[];
    translated_vocabulary: string[];
}

export interface ChatData {
  chat: CompleteChatSettingsData;
  messages: Message[];
  user: {
    id: number;
    name: string;
    avatar_url: string;
  };
  message_limit_reached: boolean;
  chat_form_options: {
    mode_options: { [key: string]: string };
    voice_options: { [key: string]: string };
    ai_model_options: [string, string][];
    transcription_mode_options: [string, string][];
    speed_options: [string, string][];
    pronunciation_options: [string, string][];
    transcription_model_options: {
      [key: string]: {
        label: string;
        value: string;
        model: string;
      }
    };
  };
}

// the mutable and immutable chat settings data will be split into two contexts for reference to what there are setters and api update calls for each
export interface CompleteChatSettingsData extends ImmutableChatSettingsData, MutableChatSettingsData {}
