import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { GlobalFontStyleSheet } from '@/constants/Font';
import cx from 'classnames';

interface VocabularyLoadingViewProps {
  isDark: boolean;
}

export const VocabularyLoadingView: React.FC<VocabularyLoadingViewProps> = ({ isDark }) => {
  return (
    <View className={cx(
      "flex-1 px-4 pt-4 justify-center items-center",
      isDark ? "bg-gray-900" : "bg-gray-50"
    )}>
      <ActivityIndicator size="large" color={isDark ? "#4B5563" : "#6B7280"} />
      <Text 
        style={GlobalFontStyleSheet.textLg}
        className={cx(
          "text-center mt-4",
          isDark ? "text-gray-300" : "text-gray-600"
        )}
      >
        Loading vocabulary...
      </Text>
    </View>
  );
};

export default VocabularyLoadingView; 
