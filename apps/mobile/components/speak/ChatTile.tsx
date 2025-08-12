import { useEffect, useRef, useMemo } from "react";
import { FlashList } from '@shopify/flash-list';
import { ChatMessage } from "./ChatMessage";
import { View, Text } from "react-native";
import { TranscriptionMessage } from "./TranscriptionTile";

export type ChatMessageType = {
  name: string;
  message: string;
  isSelf: boolean;
  timestamp: number;
};

type ChatTileProps = {
  messages: ChatMessageType[];
  accentColor: string;
  chatData: any;
  getTranscriptionMessages: () => TranscriptionMessage[];
};

type GroupedMessage = {
  name: string;
  message: string;
  timestamp: number;
  isSelf: boolean;
};

export const ChatTile = ({ messages, accentColor, chatData, getTranscriptionMessages }: ChatTileProps) => {
  const containerRef = useRef(null);
  
  const groupedMessages = useMemo(() => {
    const groups = messages.reduce((groups, currentMessage, index) => {
      if (index === 0) {
        groups.push({ ...currentMessage });
      } else {
        const previousMessage = messages[index - 1];
        if (
          currentMessage.isSelf === previousMessage.isSelf &&
          currentMessage.timestamp - previousMessage.timestamp <= 5 * 60 * 1000
        ) {
          const lastGroup = groups[groups.length - 1];
          lastGroup.message = `${lastGroup.message}\n${currentMessage.message}`;
          lastGroup.timestamp = currentMessage.timestamp;
        } else {
          groups.push({ ...currentMessage });
        }
      }
      return groups;
    }, [] as GroupedMessage[]);
    
    return groups.reverse();
  }, [messages]);
  

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [containerRef, messages]);

  return (
    <View style={{ flex: 1 }}>
      <FlashList
        data={groupedMessages}
        estimatedItemSize={100}
        inverted
        renderItem={({ item: group, index }) => {
          const hideName =
            index < groupedMessages.length - 1 && 
            groupedMessages[index + 1].name === group.name;

          return (
            <ChatMessage
              key={`${group.name}-${group.timestamp}`}
              hideName={hideName}
              name={group.name}
              message={group.message}
              isSelf={group.isSelf}
              accentColor={accentColor}
              chatData={chatData}
              timestamp={group.timestamp}
              getTranscriptionMessages={getTranscriptionMessages}
            />
          );
        }}
      />
    </View>
  );
}; 
