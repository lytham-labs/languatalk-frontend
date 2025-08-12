import { View } from "react-native";
import { ChatMessageItem } from "@/components/speak/ChatMessageItem";
import { TranscriptionMessage } from "./TranscriptionTile";

interface ChatData {
  chat: {
    id: number;
    language: string;
    language_code: string;
    mode: string;
    voice: string;
    voice_provider: string;
    speed: string;
    streaming_enabled: boolean;
    auto_send: boolean;
    auto_record: boolean;
    auto_correct: boolean;
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
    chat_type: string;
    openai_voice: string;
    openai_temperature: string;
    openai_max_tokens: string;
    openai_turn_detection_type: string;
    openai_vad_threshold: string;
    openai_silence_duration_ms: string;
    gemini_voice: string;
    gemini_temperature: string;
  };
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
    transcription_model_options: {
      [key: string]: {
        label: string;
        value: string;
        model: string;
      }
    };
  };
}

type ChatMessageProps = {
  message: string;
  timestamp: number;
  accentColor: string;
  name: string;
  isSelf: boolean;
  hideName?: boolean;
  chatData: ChatData;
  getTranscriptionMessages: () => TranscriptionMessage[];
};

export const ChatMessage = ({
  name,
  message,
  timestamp,
  accentColor,
  isSelf,
  hideName,
  chatData,
  getTranscriptionMessages,
}: ChatMessageProps) => {
  if (!message || message.trim() === '') {
    return null;
  }

  const messageItem = {
    role: isSelf ? 'user' : 'assistant',
    content: message,
    chat_message_id: `${timestamp}`,
  };


  return (
    <View className={`flex flex-col gap-1 ${hideName ? "pt-0" : "pt-6"}`}>
      <ChatMessageItem
        key={messageItem.chat_message_id}
        item={messageItem}
        colorScheme="light"
        chatMode="text"
        highlightMode="off"
        chatData={chatData}
        playingAudioId={null}
        playingSlowAudioId={null}
        isRecording={false}
        cancelRecording={() => {}}
        autoCorrectEnabled={false}
        showAvatar={true}
        getTranscriptionMessages={getTranscriptionMessages}
      />
    </View>
  );
}; 
