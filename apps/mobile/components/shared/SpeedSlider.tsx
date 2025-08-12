import React from 'react';
import { View, Text } from 'react-native';
import Slider from '@react-native-community/slider';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SPEED_MULTIPLIER } from '@/constants/Lists';

interface SpeedSliderProps {
  value: number;
  onChange: (value: string) => void;
  label?: string;
  subLabel?: string;
}

export default function SpeedSlider({ 
  value, 
  onChange, 
  label = "How fast should they speak?",
  subLabel
}: SpeedSliderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Function to convert speed value to slider position (0, 1, or 2)
  const speedToPosition = (speed: number): number => {
    const numSpeed = typeof speed === 'string' ? parseFloat(speed) : speed;
    switch (numSpeed) {
      case SPEED_MULTIPLIER.slow: return 0;
      case SPEED_MULTIPLIER.fast: return 2;
      default: return 1; // 0.92 or any other value defaults to normal
    }
  };

  // Function to convert slider position to speed value
  const positionToSpeed = (position: number): number => {
    switch (position) {
      case 0: return SPEED_MULTIPLIER.slow;
      case 2: return SPEED_MULTIPLIER.fast;
      default: return SPEED_MULTIPLIER.normal;
    }
  };

  return (
    <View className="my-3">
      <Text style={GlobalFontStyleSheet.textBase} className="font-medium mb-1 text-gray-600 dark:text-gray-300">
        {label}
      </Text>
      {subLabel && (
        <Text style={GlobalFontStyleSheet.textSm} className="font-light mb-1 text-gray-600 dark:text-gray-300">
          {subLabel}
        </Text>
      )}
      <Slider
        style={{width: '100%', height: 40}}
        minimumValue={0}
        maximumValue={2}
        step={1}
        value={speedToPosition(value)}
        onValueChange={(position: number) => {
          onChange(positionToSpeed(position).toString());
        }}
        minimumTrackTintColor={isDark ? Colors.dark.text : Colors.light.text}
        maximumTrackTintColor={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"}
        thumbTintColor={isDark ? Colors.dark.text : Colors.light.text}
        tapToSeek={true}
      />
      <View className="flex-row justify-between mt-1">
        <Text className={`text-sm ${isDark ? 'text-gray-50' : 'text-gray-500'}`}>Slower</Text>
        <Text className={`text-sm ${isDark ? 'text-gray-50' : 'text-gray-500'}`}>Normal</Text>
        <Text className={`text-sm ${isDark ? 'text-gray-50' : 'text-gray-500'}`}>Faster</Text>
      </View>
    </View>
  );
} 
