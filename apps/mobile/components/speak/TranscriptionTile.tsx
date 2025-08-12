import "fast-text-encoding";
import "expo-router/entry";
import {
  TrackReferenceOrPlaceholder,
  useChat,
  useLocalParticipant,
  useTrackTranscription,
} from "@livekit/components-react";
import {
  LocalParticipant,
  Participant,
  Track,
  TranscriptionSegment,
} from "livekit-client";
import { useEffect, useState } from "react";
import { ChatTile } from "@/components/speak/ChatTile";

export type TranscriptionMessage = {
  content: string;
  role: "assistant" | "user";
  chat_id: string;
  created_at: number;
};

interface ChatMessageType {
  message: string;
  name: string;
  isSelf: boolean;
  timestamp: number;
}

export function TranscriptionTile({
  agentAudioTrack,
  accentColor,
  chatData,
  onTranscriptionMessagesChange,
}: {
  agentAudioTrack: TrackReferenceOrPlaceholder;
  accentColor: string;
  chatData: any;
  onTranscriptionMessagesChange?: (messages: TranscriptionMessage[]) => void;
}) {
  const agentMessages = useTrackTranscription(agentAudioTrack);
  const localParticipant = useLocalParticipant();
  const localMessages = useTrackTranscription({
    publication: localParticipant.microphoneTrack,
    source: Track.Source.Microphone,
    participant: localParticipant.localParticipant,
  });

  const [transcripts, setTranscripts] = useState<Map<string, ChatMessageType>>(new Map());
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [transcriptionMessages, setTranscriptionMessages] = useState<TranscriptionMessage[]>([]);
  const { chatMessages, send: sendChat } = useChat();

  // store transcripts and collect transcription messages
  useEffect(() => {
    const processMessages = () => {
      const newTranscripts = new Map(transcripts);
      const newTranscriptionMessages: TranscriptionMessage[] = [];
      
      // Process agent messages
      const agentSegments = agentMessages.segments;
      if (agentSegments.length > 0) {
        // Get the latest segment
        const latestSegment = agentSegments[agentSegments.length - 1];
        // Only create a new message if this is a final segment
        if (latestSegment.final) {
          if (!newTranscripts.has(latestSegment.id)) {
            newTranscripts.set(latestSegment.id, segmentToChatMessage(latestSegment, undefined, agentAudioTrack.participant));
            // Add to transcription messages
            newTranscriptionMessages.push({
              content: latestSegment.text,
              role: "assistant",
              chat_id: chatData?.chat?.id || "",
              created_at: latestSegment.firstReceivedTime,
            });
          } else {
            // Update existing message text only, preserve timestamp
            const existingMessage = newTranscripts.get(latestSegment.id)!;
            newTranscripts.set(latestSegment.id, segmentToChatMessage(latestSegment, existingMessage, agentAudioTrack.participant));
          }
        }
      }

      // Process local (user) messages
      const localSegments = localMessages.segments;
      if (localSegments.length > 0) {
        // Get the latest segment
        const latestSegment = localSegments[localSegments.length - 1];
        // Only create a new message if this is a final segment
        if (latestSegment.final) {
          if (!newTranscripts.has(latestSegment.id)) {
            newTranscripts.set(latestSegment.id, segmentToChatMessage(latestSegment, undefined, localParticipant.localParticipant));
            // Add to transcription messages
            newTranscriptionMessages.push({
              content: latestSegment.text,
              role: "user",
              chat_id: chatData?.chat?.id || "",
              created_at: latestSegment.firstReceivedTime,
            });
          } else {
            // Update existing message text only, preserve timestamp
            const existingMessage = newTranscripts.get(latestSegment.id)!;
            newTranscripts.set(latestSegment.id, segmentToChatMessage(latestSegment, existingMessage, localParticipant.localParticipant));
          }
        }
      }

      setTranscripts(newTranscripts);
      setTranscriptionMessages(prev => {
        const updatedMessages = [...prev, ...newTranscriptionMessages];
        // Notify parent of changes
        onTranscriptionMessagesChange?.(updatedMessages);
        return updatedMessages;
      });

      // Combine and sort messages
      const allMessages = [
        ...Array.from(newTranscripts.values()),
        ...chatMessages.map(msg => ({
          name: msg.from?.name || (msg.from?.identity === agentAudioTrack.participant?.identity ? "Agent" : "You"),
          message: msg.message,
          timestamp: msg.timestamp,
          isSelf: msg.from?.identity === localParticipant.localParticipant.identity,
        }))
      ];
      
      return allMessages.sort((a, b) => a.timestamp - b.timestamp);
    };

    setMessages(processMessages());
  }, [agentMessages.segments, localMessages.segments, chatMessages, chatData?.chat?.id, onTranscriptionMessagesChange]);

  // Function to get current transcriptions
  const getTranscriptionMessages = () => {
    return transcriptionMessages;
  };

  return (
    <ChatTile
      messages={messages}
      accentColor={accentColor}
      chatData={chatData}
      getTranscriptionMessages={getTranscriptionMessages}
    />
  );
}

function segmentToChatMessage(
  s: TranscriptionSegment,
  existingMessage: ChatMessageType | undefined,
  participant: Participant
): ChatMessageType {
  return {
    message: s.final ? s.text : `${s.text} ...`,
    name: participant instanceof LocalParticipant ? "You" : "Agent",
    isSelf: participant instanceof LocalParticipant,
    // Use existing timestamp if available, otherwise create new one
    timestamp: existingMessage?.timestamp ?? Date.now(),
  };
}
