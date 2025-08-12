import React from 'react';
import { View, Text } from 'react-native';
import Slider from '@react-native-community/slider';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface VoiceSliderProps {
  value: number;
  onChange: (value: string) => void;
  label?: string;
  subLabel?: string;
}

export default function VoiceSlider({ 
  value, 
  onChange, 
  subLabel
}: VoiceSliderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Function to convert voice value to slider position (0, 1, or 2)
  const voiceToPosition = (voice: number): number => {
    const numVoice = typeof voice === 'string' ? parseFloat(voice) : voice;
    switch (numVoice) {
      case 2: return 0;
      case 4: return 2;
      default: return 1; // 3.3 or any other value defaults to medium
    }
  };

  // Function to convert slider position to voice value
  const positionToVoice = (position: number): string => {
    switch (position) {
      case 0: return '2';
      case 2: return '4';
      default: return '3.3';
    }
  };

  return (
    <View className="mb-3">
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
        value={voiceToPosition(value)}
        onValueChange={(position: number) => {
          onChange(positionToVoice(position));
        }}
        minimumTrackTintColor={isDark ? Colors.dark.text : Colors.light.text}
        maximumTrackTintColor={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"}
        thumbTintColor={isDark ? Colors.dark.text : Colors.light.text}
        tapToSeek={true}
      />
      <View className="flex-row justify-between mt-1">
        <Text className={`text-sm ${isDark ? 'text-gray-50' : 'text-gray-500'}`}>Fast (2s)</Text>
        <Text className={`text-sm ${isDark ? 'text-gray-50' : 'text-gray-500'}`}>Normal (3s)</Text>
        <Text className={`text-sm ${isDark ? 'text-gray-50' : 'text-gray-500'}`}>Slow (4s)</Text>
      </View>
      <Text style={{...GlobalFontStyleSheet.textSm, lineHeight: 20}} className="font-medium mt-3 text-gray-400 dark:text-gray-300">
        Faster = better for quick exchanges, but trickier as it sends if you hesitate.
      </Text>
    </View>
  );
} 
