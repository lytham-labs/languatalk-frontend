import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { GlobalFontStyleSheet } from '@/constants/Font';
import cx from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faXmark, faCardsBlank, faListUl } from '@fortawesome/pro-solid-svg-icons';
import { Router } from 'expo-router';

interface VocabularyHeaderProps {
  title?: string;
  viewMode: 'list' | 'flashcard';
  isSessionComplete: boolean;
  onToggleViewMode: () => void;
  onBack: () => void;
  isDark: boolean;
}

export const VocabularyHeader: React.FC<VocabularyHeaderProps> = ({
  title,
  viewMode,
  isSessionComplete,
  onToggleViewMode,
  onBack,
  isDark
}) => {
  return (
    <>
      <View className="flex-row justify-between items-center mt-16 mb-6">
        <TouchableOpacity 
          onPress={onBack}
          className="flex-row items-center"
        >
          <FontAwesomeIcon 
            icon={faXmark}
            size={20}
            color={isDark ? "#93c5fd" : "#3b82f6"}
          />
          <Text 
            style={GlobalFontStyleSheet.textLg}
            className={cx(
              "ml-2 font-medium",
              isDark ? "text-blue-300" : "text-blue-500"
            )}
          >
            Close
          </Text>
        </TouchableOpacity>

        {!isSessionComplete && (
          <View className="flex-row items-center">
            <TouchableOpacity 
              onPress={onToggleViewMode}
              className="flex-row items-center"
            >
              <FontAwesomeIcon 
                icon={viewMode === 'list' ? faCardsBlank : faListUl}
                size={20}
                color={isDark ? "#93c5fd" : "#3b82f6"}
              />
              <Text 
                style={GlobalFontStyleSheet.textBase}
                className={cx(
                  "ml-2",
                  isDark ? "text-blue-300" : "text-blue-500"
                )}
              >
                {viewMode === 'list' ? 'Cards' : 'List'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Title - only shown in list view */}
      {viewMode === 'list' && title && (
        <Text 
          style={GlobalFontStyleSheet.textXl}
          className={cx(
            "text-center font-medium mb-4",
            isDark ? "text-gray-200" : "text-gray-800"
          )}
        >
          {title}
        </Text>
      )}
    </>
  );
};

export default VocabularyHeader; 
