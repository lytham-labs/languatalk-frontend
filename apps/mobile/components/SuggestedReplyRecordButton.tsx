import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faMicrophone, faStop, faCheck } from '@fortawesome/free-solid-svg-icons';
import { getIconSize, GlobalFontStyleSheet } from '@/constants/Font';
import PulsingButton from '@/components/PulsingButton';
import { Text } from 'react-native';
import { useColorScheme } from 'react-native';
import useDevice from '@/hooks/useDevice';

interface SuggestedReplyRecordButtonProps {
  onStartRecording: () => void;
  onStopRecording: () => void;
  isRecording: boolean;
  isCompleted?: boolean;
  variant?: 'alternate' | 'suggestion';
}

export default function SuggestedReplyRecordButton({ 
  onStartRecording, 
  onStopRecording, 
  isRecording,
  isCompleted = false,
  variant = 'suggestion'
}: SuggestedReplyRecordButtonProps) {
  const isDark = useColorScheme() === 'dark';
  const { isTablet } = useDevice();
  
  const buttonStyle: ViewStyle = {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: isCompleted 
      ? '#4CAF50'  // Green when completed
      : isRecording 
        ? '#FC5D5D'
        : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minWidth: 36,
    borderWidth: 1,
    borderColor: isCompleted
      ? '#4CAF50'  // Green when completed
      : isRecording
        ? '#FC5D5D'
        : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
    transform: [{ scale: isRecording ? 1.05 : 1 }],
  };

  const getButtonText = () => {
    if (isCompleted) return '';
    if (isRecording) {
      return variant === 'alternate' ? 'Stop' : 'Stop and send';
    }
    return 'Say it';
  };

  return (
    <PulsingButton
      onPress={isRecording ? onStopRecording : onStartRecording}
      style={buttonStyle}
      isPulsing={isRecording}
      icon={
        <View style={styles.container} className='flex-row items-center'>
          {/* Animated recording indicator */}
          {isRecording && (
            <View className="absolute -top-1 -right-1">
              <View className="w-1 h-1 rounded-full bg-[] animate-pulse" />
            </View>
          )}
          
          {/* Icon with pulsing background */}
          <View className={`rounded-full ${
            isRecording ? 'bg-white/20' : 'bg-transparent'
          } p-2`}>
            <FontAwesomeIcon 
              icon={isCompleted ? faCheck : isRecording ? faStop : faMicrophone} 
              size={getIconSize(14)}
              color={isCompleted 
                ? '#ffffff'
                : isRecording 
                  ? '#ffffff'
                  : (isDark ? '#ffffff' : '#FC5D5D')} 
            />
          </View>
          
          {/* Dynamic text that changes color when recording */}
          <Text className={`${isTablet ? 'text-xl' : 'text-lg'} ${
            isCompleted ? 'text-white' : isRecording ? 'text-white' : 'text-[#FC5D5D]'
          }`}>
            {getButtonText()}
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
    position: 'relative',
  },
  buttonText: {
    marginLeft: 4,
    fontWeight: '600',
    fontSize: 12,
  },
}); 