import React, { useState } from 'react';
import { View, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getIconSize } from '@/constants/Font';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

type Props = {
  title: React.ReactNode;
  children: React.ReactNode;
  initiallyExpanded?: boolean;
};

export default function CollapsibleSection({ title, children, initiallyExpanded = false }: Props) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const colorScheme = useColorScheme();

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  return (
    <View className="mb-4 rounded-lg overflow-hidden border border-gray-200/40 dark:border-gray-700">
      <TouchableOpacity
        onPress={toggleExpand}
        className="flex-row justify-between items-center p-4 bg-gray-50/50 dark:bg-gray-800"
      >
        <View className="flex-1">{title}</View>
        <FontAwesomeIcon
          icon={isExpanded ? faChevronUp : faChevronDown}
          size={getIconSize(16)}
          color={Colors[colorScheme ?? 'light'].text}
        />
      </TouchableOpacity>
      {isExpanded && (
        <View className="p-2 bg-white dark:bg-gray-900">{children}</View>
      )}
    </View>
  );
} 