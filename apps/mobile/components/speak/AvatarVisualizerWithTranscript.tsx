import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, ViewStyle, ColorValue, Platform, Animated, useColorScheme, Dimensions } from 'react-native';
import { AgentState, TrackReferenceOrPlaceholder, useTrackTranscription, useLocalParticipant } from '@livekit/components-react';
import { AvatarVisualizer } from './AvatarVisualizer';
import { TranscriptionSegment, LocalParticipant, Participant, Track } from 'livekit-client';
import { GlobalFontStyleSheet } from '@/constants/Font';
import useDevice from '@/hooks/useDevice';
import { FlashList, ListRenderItem } from '@shopify/flash-list';
import { InteractiveText } from '@/components/shared/InteractiveText';
import TranscribingDots from '@/components/TranscribingDots';
import { Colors } from '@/constants/Colors';
import useUserSettings from '@/services/api/useUserSettings';

const { isTablet } = useDevice();

export type TranscriptionMessage = {
  content: string;
  role: "assistant" | "user";
  chat_id: string;
};

export interface AvatarVisualizerWithTranscriptProps {
  state?: AgentState;
  avatarUrl?: string;
  trackRef?: TrackReferenceOrPlaceholder;
  style?: ViewStyle;
  borderColor?: ColorValue;
  size?: number;
  maxBorderWidth?: number;
  colorScheme?: 'light' | 'dark';
  chatData?: any;
  onTranscriptionMessagesChange?: (messages: TranscriptionMessage[]) => void;
  isMuted?: boolean;
}

export const AvatarVisualizerWithTranscript: React.FC<AvatarVisualizerWithTranscriptProps> = ({
  state = 'disconnected',
  avatarUrl,
  trackRef,
  style,
  borderColor = '#007AFF',
  size = 180,
  maxBorderWidth = 10,
  colorScheme = 'light',
  chatData,
  onTranscriptionMessagesChange,
  isMuted = false,
}) => {
  const systemColorScheme = useColorScheme();
  const effectiveColorScheme = colorScheme || systemColorScheme || 'light';
  const colors = Colors[effectiveColorScheme];

  const [transcripts, setTranscripts] = useState<Map<string, { text: string; order: number; role: 'assistant' | 'user' }>>(new Map());
  const [transcript, setTranscript] = useState<string>('');
  const [fadeAnim] = useState(new Animated.Value(1));
  const flashListRef = useRef<FlashList<TranscriptionMessage>>(null);
  const transcription = useTrackTranscription(trackRef);
  const localParticipant = useLocalParticipant();
  const localMessages = useTrackTranscription({
    publication: localParticipant.microphoneTrack,
    source: Track.Source.Microphone,
    participant: localParticipant.localParticipant,
  });
  const [transcriptionMessages, setTranscriptionMessages] = useState<TranscriptionMessage[]>([]);
  const { userSettings } = useUserSettings();

  useEffect(() => {
    let updated = false;
    let order = transcripts.size;
    const newTranscripts = new Map(transcripts);

    // Helper to add or update segment
    const processSegment = (segment: TranscriptionSegment, role: 'assistant' | 'user') => {
      if (!newTranscripts.has(segment.id)) {
        // New segment
        newTranscripts.set(segment.id, { text: segment.text, order: order++, role });
        updated = true;
      } else {
        // Update existing segment
        const existing = newTranscripts.get(segment.id)!;
        if (existing.text !== segment.text || existing.role !== role) {
          newTranscripts.set(segment.id, { 
            text: segment.text, 
            order: existing.order, 
            role 
          });
          updated = true;
        }
      }
    };

    // Process agent segments
    if (transcription?.segments?.length > 0) {
      const agentSegments = transcription.segments;
      // Process all segments to maintain full context
      agentSegments.forEach(segment => processSegment(segment, 'assistant'));
    }

    // Process user segments
    if (localMessages?.segments?.length > 0) {
      const userSegments = localMessages.segments;
      // Process all segments to maintain full context
      userSegments.forEach(segment => processSegment(segment, 'user'));
    }

    if (updated) {
      setTranscripts(newTranscripts);
      // Process messages in real-time

      // Construct the final list of messages for the callback by grouping segments
      const sortedSegments = Array.from(newTranscripts.values()).sort((a, b) => a.order - b.order);
      const finalMessagesForCallback: TranscriptionMessage[] = [];

      if (sortedSegments.length > 0) {
        let currentRole = sortedSegments[0].role;
        let currentContent = "";

        sortedSegments.forEach((segment) => {
          if (segment.role === currentRole) {
            // Append text from segments of the same role. Add a space if currentContent is not empty.
            // Ensure segment.text is not empty before adding.
            if (segment.text && segment.text.trim() !== "") {
              currentContent = currentContent ? (currentContent + " " + segment.text.trim()) : segment.text.trim();
            }
          } else {
            // Role changed, finalize previous message if content exists
            if (currentContent.trim()) {
              finalMessagesForCallback.push({
                content: currentContent.trim(),
                role: currentRole,
                chat_id: chatData?.chat?.id || ""
              });
            }
            // Start new message
            currentRole = segment.role;
            currentContent = segment.text ? segment.text.trim() : "";
          }
        });
        // Add the last accumulated message if content exists
        if (currentContent.trim()) {
          finalMessagesForCallback.push({
            content: currentContent.trim(),
            role: currentRole,
            chat_id: chatData?.chat?.id || ""
          });
        }
      }
      
      // Update local state and call the parent callback with the correctly grouped messages
      setTranscriptionMessages(finalMessagesForCallback);
      onTranscriptionMessagesChange?.(finalMessagesForCallback);
      
      // Update the transcript for local display (FlashList)
      // This part shows only assistant transcript locally, can be kept or improved later.
      const assistantSorted = Array.from(newTranscripts.values())
        .filter(t => t.role === 'assistant')
        .sort((a, b) => a.order - b.order);
      
      // For local display, we want to show the ongoing assistant speech as it forms.
      // Grouping here should be similar to messagesForCallback but only for assistant.
      let assistantDisplayTranscript = "";
      if (assistantSorted.length > 0) {
          let currentAssistantContent = "";
          // This will form one continuous block of assistant text from all its segments
          assistantSorted.forEach(segment => {
              if (segment.text && segment.text.trim() !== "") {
                currentAssistantContent = currentAssistantContent ? (currentAssistantContent + "\n\n\n" + segment.text.trim()) : segment.text.trim();
              }
          });
          assistantDisplayTranscript = currentAssistantContent;
      }

      if (assistantDisplayTranscript !== transcript) { // 'transcript' is local state for FlashList
        setTranscript(assistantDisplayTranscript);
        // Use requestAnimationFrame for more reliable scrolling
        requestAnimationFrame(() => {
          if (flashListRef.current) {
            // For inverted lists, scroll to offset 0 to see the newest items at the bottom (which is visually the top)
            flashListRef.current.scrollToOffset({ offset: 0, animated: true });
          }
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcription?.segments, localMessages?.segments, chatData?.chat?.id, onTranscriptionMessagesChange]);

  // Add effect to scroll to bottom when thinking state changes
  useEffect(() => {
    if (state === 'thinking' && flashListRef.current) {
      requestAnimationFrame(() => {
        // For inverted lists, scroll to offset 0
        flashListRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
    }
  }, [state]);

  const renderItem = ({ item }: { item: TranscriptionMessage }) => {
    // Determine text color based on role and theme
    let textColorClass = '';
    if (item.role === 'user') {
      textColorClass = effectiveColorScheme === 'dark' ? 'text-blue-300' : 'text-blue-700';
    } else {
      textColorClass = effectiveColorScheme === 'dark' ? 'text-gray-100' : 'text-gray-900';
    }

    return (
      <Animated.View style={{ opacity: fadeAnim, marginTop: 60 }} className="flex min-h-[170px]">
        <InteractiveText
          text={item.content}
          languageCode={chatData?.chat?.language}
          targetLanguage={userSettings?.team.langua_native_language || 'english'}
          colorScheme={effectiveColorScheme}
          textSize={isTablet ? 'base' : 'xl'}
          lineHeight={isTablet ? 30 : 32}
          tailwindClassName={textColorClass}
          fontWeight={'bold'}
        />
      </Animated.View>
    );
  };

  // Add a footer component that will always be at the bottom
  const ListFooterComponent = () => {
    if (state !== 'thinking') return null;
    return (
      <View style={styles.thinkingContainer}>
        <TranscribingDots />
      </View>
    );
  };

  // Create a new state for the reversed transcript to be used by FlashList
  const [reversedTranscriptForDisplay, setReversedTranscriptForDisplay] = useState<TranscriptionMessage[]>([]);

  useEffect(() => {
    // When transcriptionMessages changes or speaking state changes
    if (transcriptionMessages.length > 0) {
      // Filter out user messages (this creates a new array)
      let messagesToDisplay = transcriptionMessages.filter(
        (message) => message.role !== 'user'
      );

      // If AI is speaking and there are assistant messages, add/update indicator on the last one
      if (state === 'speaking' && messagesToDisplay.length > 0) {
        // Map to create a new array, modifying the last message
        messagesToDisplay = messagesToDisplay.map((msg, index) => {
          if (index === messagesToDisplay.length - 1) {
            // This is the current assistant utterance
            return {
              ...msg,
              content: `${msg.content} `,
            };
          }
          return msg;
        });
      }
      setReversedTranscriptForDisplay([...messagesToDisplay].reverse()); 
    } else {
      setReversedTranscriptForDisplay([]);
    }
  }, [transcriptionMessages, state]); // Depend on transcriptionMessages and state

  return (
    <View style={[
      styles.container, 
      { backgroundColor: effectiveColorScheme === 'dark' ? '#181C20' : '#F9FAFB' },
      style
    ]}
      className="px-3"
    >
      <View style={styles.avatarContainer}>
        <AvatarVisualizer
          state={state}
          avatarUrl={avatarUrl}
          trackRef={trackRef}
          borderColor={borderColor}
          size={85}
          maxBorderWidth={maxBorderWidth}
          isMuted={isMuted}
        />
      </View>
      <View 
      style={[
        styles.transcriptContainer,
      ]}
        className="px-10 max-h-[80%] dark:bg-gray-700/60 bg-white mt-auto rounded-xl mb-5 "
      >
        <FlashList
          ref={flashListRef}
          data={reversedTranscriptForDisplay}
          renderItem={renderItem}
          estimatedItemSize={230}
          keyExtractor={(item, index) => `${item.role}-${index}-${item.content.substring(0,10)}`}
          ListFooterComponent={ListFooterComponent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: Dimensions.get('window').height / 3,
            paddingBottom: Dimensions.get('window').height / 3
          }}
          inverted
          snapToInterval={230}
          snapToAlignment="center"
          onMomentumScrollEnd={(event) => {
            console.log('Scroll ended at offset:', event.nativeEvent.contentOffset.y);
          }}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10,
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 30,
  },
  avatarContainer: {
    marginBottom: 20,
  },
  transcriptContainer: {
    flex: 1,
    width: isTablet ? '80%' : '100%',
    paddingHorizontal: isTablet ? 40 : 20,
  },
  transcriptContent: {
    paddingVertical: 16,
  },
  transcriptText: {
    lineHeight: 32,
    textAlign: 'center',
    paddingVertical: 2,
    paddingRight: 2,
    flexShrink: 1,
  },
  transcriptTextLight: {
    color: '#222',
  },
  transcriptTextDark: {
    color: '#fff',
  },
  thinkingContainer: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentTranscript: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  previousTranscript: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
}); 
