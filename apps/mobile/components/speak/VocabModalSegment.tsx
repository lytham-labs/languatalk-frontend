import React, { useMemo } from 'react';
import { View, Text, useColorScheme } from 'react-native';
import { PressableSegment, Segment } from '../../types/chat';
import { getFontStyle } from '@/constants/Font';
import { useChatData } from '@/contexts/ChatDataContext';
import { useReadingAid } from '@/contexts/ReadingAidContext';

interface VocabModalSegmentProps {
  segment: PressableSegment;
  pressableSegmentIndex: number;
}

const VocabModalSegment: React.FC<VocabModalSegmentProps> = ({
  segment,
  pressableSegmentIndex,
}) => {
  const colorScheme = useColorScheme();
  const { type, segments } = segment;
  const { state: chatDataState } = useChatData();
  const pronunciationCharacters = chatDataState?.chat.pronunciation_characters;


  return (
    <View key={`${pressableSegmentIndex}`} className="flex-row justify-end items-end">
      {segments.map((segment: Segment, segmentIndex: number) => {
        if (type === 'ruby') {
          const rubyText  = pronunciationCharacters === 'disabled' ? null : pronunciationCharacters === 'romaji' ? segment.romaji : pronunciationCharacters === 'hiragana' ? segment.hiragana : null;
          if (rubyText) {
            return (
              <View key={`${pressableSegmentIndex}-${segmentIndex}`} className="flex-column items-center">
                <Text style={[getFontStyle('textXl'), { fontFamily: 'Lato-Bold' }]} className="tracking-tight text-blue-500 dark:text-blue-300">
                  {rubyText}
                </Text>
                <Text style={[getFontStyle('text2Xl'), { fontFamily: 'Lato-Bold' }]} className="tracking-tight dark:text-white text-gray-900">
                  {segment.baseText}
                </Text>
              </View>
            );
          } else {
            // When type is 'ruby' but no pronunciation text available, still show base text with consistent styling
            return (
              <Text key={`${pressableSegmentIndex}-${segmentIndex}`} style={[getFontStyle('text2Xl'), { fontFamily: 'Lato-Bold' }]} className="tracking-tight dark:text-white text-gray-900">
                {segment.baseText}
              </Text>
            );
          }
        }
        return (
          <Text key={`${pressableSegmentIndex}-${segmentIndex}`} style={[getFontStyle('text2Xl'), { fontFamily: 'Lato-Bold' }]} className="tracking-tight dark:text-white text-gray-900">
            {segment.baseText}
          </Text>
        );
      })}
    </View>
  );
};

export default VocabModalSegment; 