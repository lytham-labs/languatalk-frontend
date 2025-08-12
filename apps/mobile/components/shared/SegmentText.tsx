import React, { useMemo } from 'react';
import { View, Text, type TextProps, TextStyle, StyleSheet, Platform } from 'react-native';
import { Segment } from '@/types/chat';
import cx from 'classnames';
import useDevice from '@/hooks/useDevice';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { useReadingAid } from '@/contexts/ReadingAidContext';
import { useChatData } from '@/contexts/ChatDataContext';

export type SegmentTextProps = TextProps & {
  segment: Segment;
  type?: 'plain' | 'ruby';
  isBold?: boolean;
  isSelected?: boolean;
  isFirstSelected?: boolean;
  isInSelectedPhrase?: boolean;
  isHidden?: boolean;
  colorScheme?: 'light' | 'dark';
  lineHeight?: number;
};

const { isTablet } = useDevice();

export default function SegmentText({
  segment,
  type = 'plain',
  isBold = false,
  isSelected = false,
  isFirstSelected = false,
  isInSelectedPhrase = false,
  isHidden = false,
  colorScheme = 'light',
  lineHeight,
  ...rest   
}: SegmentTextProps) {
    const { isJapaneseReadingAidEnabledAndReady } = useReadingAid();
    const { state: chatDataState } = useChatData();
    const pronunciationCharacters = chatDataState?.chat.pronunciation_characters;
    
    const rubyText = useMemo(() => {
      if (type !== 'ruby' || !isJapaneseReadingAidEnabledAndReady || pronunciationCharacters === 'disabled') {
        return null;
      }
      if (pronunciationCharacters === 'romaji') {
        return segment.romaji;
      }
      if (pronunciationCharacters === 'hiragana') {
        return segment.hiragana;
      }
      return null;
    }, [type, isJapaneseReadingAidEnabledAndReady, pronunciationCharacters, segment]);

    const baseText = segment.baseText;
    
    if (isHidden) {
        return null;
    }

    // Combine bold formatting from props and segment
    const isBoldFormatted = isBold || (segment.formatting?.isBold ?? false);
    const isDeletedFormatted = segment.formatting?.isDeleted ?? false;
    const isItalicFormatted = segment.formatting?.isItalic ?? false;
    const isUnderlinedFormatted = segment.formatting?.isUnderlined ?? false;

    // Determine effective line height
    const effectiveLineHeight = lineHeight || (isTablet ? 42 : 35);

    // For ruby text (Japanese with furigana/romaji)
    if (type === 'ruby' && rubyText) {
        return ( 
            <View className="grid grid-rows-2 mr-1 gap-y-3" >
                <Text className={cx(
                    'text-center align-middle', {
                    'text-blue-500 dark:text-blue-400': !isInSelectedPhrase && !isSelected,
                    'text-blue-500 dark:text-blue-50': isInSelectedPhrase || isSelected,
                    'invisible': isHidden,
                    'font-bold': isBoldFormatted,
                    'underline decoration-2': isFirstSelected,
                    'decoration-blue-500 dark:decoration-white': isFirstSelected,
                    })}
                    style={[
                        isTablet ? GlobalFontStyleSheet.textMd : GlobalFontStyleSheet.textLg,
                        {
                          lineHeight: 0,
                          backgroundColor: isInSelectedPhrase || isSelected ? (colorScheme === 'light' ? 'rgba(0, 68, 143, 0.1)' : 'rgba(96, 165, 250, 0.4)') : 'transparent',
                          fontFamily: Platform.select({
                            ios: isBoldFormatted ? 'Hiragino Sans' : 'Hiragino Sans Wx',
                            android: isBoldFormatted ? 'Noto Sans JP' : 'Noto Sans JP',
                          }),
                        },
                    ]}>{rubyText}</Text>
                <Text className={cx(
                    'text-center align-middle', {
                    'text-black dark:text-white': true,
                    'invisible': isHidden,
                    'font-bold': isBoldFormatted,
                    'underline decoration-2': isFirstSelected,
                    'decoration-blue-500 dark:decoration-white': isFirstSelected,
                    })}
                    style={[
                        { lineHeight: effectiveLineHeight },
                        isTablet ? GlobalFontStyleSheet.textMd : GlobalFontStyleSheet.textLg,
                        {
                          backgroundColor: isInSelectedPhrase || isSelected ? (colorScheme === 'light' ? 'rgba(0, 68, 143, 0.1)' : 'rgba(96, 165, 250, 0.4)') : 'transparent',
                          textDecorationColor: colorScheme === 'light' ? '#00448f' : 'white',
                          fontFamily: Platform.select({
                            ios: isBoldFormatted ? 'Hiragino Sans' : 'Hiragino Sans Wx',
                            android: isBoldFormatted ? 'Noto Sans JP' : 'Noto Sans JP',
                          }),
                          // Apply segment formatting styles
                          ...(segment.formatting?.isBold && { fontWeight: 'bold' }),
                          ...(segment.formatting?.isDeleted && {
                            textDecorationLine: 'line-through',
                            color: '#ff6b6b',
                            textDecorationColor: '#ff6b6b',
                            opacity: 0.7,
                            textDecorationStyle: Platform.OS === 'ios' ? 'solid' : undefined,
                          }),
                          ...(segment.formatting?.isItalic && { fontStyle: 'italic' }),
                          ...(segment.formatting?.isUnderlined && {
                            textDecorationLine: 'underline',
                            textDecorationColor: colorScheme === 'light' ? '#00448f' : 'white',
                          }),
                        }
                    ]}>{baseText}</Text>
            </View>
        );
    }

    // For plain text
    return (
        <Text
            className={cx({
            'text-black dark:text-white': true,
            'invisible': isHidden,
            'font-bold': isBoldFormatted,
            'underline decoration-2': isFirstSelected,
            'decoration-blue-500 dark:decoration-white': isFirstSelected,
            })}
            style={[
                { lineHeight: effectiveLineHeight },
                isTablet ? GlobalFontStyleSheet.textMd : GlobalFontStyleSheet.textLg,
                {
                  marginRight: 2,
                  fontFamily: isBoldFormatted ? 'lato-extrabold' : 'lato-regular',
                  backgroundColor: isInSelectedPhrase || isSelected ? (colorScheme === 'light' ? 'rgba(0, 68, 143, 0.1)' : 'rgba(96, 165, 250, 0.4)') : 'transparent',
                  textDecorationColor: colorScheme === 'light' ? '#00448f' : 'white',
                  // Apply segment formatting styles
                  ...(segment.formatting?.isBold && { fontWeight: 'bold' }),
                                            ...(segment.formatting?.isDeleted && {
                            textDecorationLine: 'line-through',
                            color: '#ff6b6b',
                            textDecorationColor: '#ff6b6b',
                            opacity: 0.7,
                            textDecorationStyle: Platform.OS === 'ios' ? 'solid' : undefined,
                          }),
                  ...(segment.formatting?.isItalic && { fontStyle: 'italic' }),
                  ...(segment.formatting?.isUnderlined && {
                    textDecorationLine: 'underline',
                    textDecorationColor: colorScheme === 'light' ? '#00448f' : 'white',
                  }),
                },
                ...rest.style ? [rest.style] : [],
            ]}
            {...rest}
        >{baseText}</Text>
    );
}