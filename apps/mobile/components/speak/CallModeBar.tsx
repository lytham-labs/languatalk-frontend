import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faPhone, faPause, faPlay, faMicrophone, faMicrophoneSlash, faGear, faSliders, faQuoteRight, faWaveform } from '@fortawesome/pro-solid-svg-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import useDevice from '@/hooks/useDevice';
import { Svg, Path } from 'react-native-svg';

const LightbulbIcon = ({ color = "#00488F" }) => {
  const { isTablet } = useDevice();

  return (
    <Svg 
      width={isTablet ? 25 : 22} 
      height={isTablet ? 25 : 22} 
      viewBox="0 0 576 512"
    >
      <Path
        fill={color}
        d="M310.4 224.7c6.2-15 9.6-31.4 9.6-48.7c0-70.7-57.3-128-128-128S64 105.3 64 176c0 27.2 8.4 52.3 22.8 72.9c3.7 5.3 8.1 11.3 12.8 17.7c0 0 0 0 0 0c12.9 17.7 28.3 38.9 39.8 59.8c10.4 19 15.7 38.8 18.3 57.5L109 384c-2.2-12-5.9-23.7-11.8-34.5c-9.9-18-22.2-34.9-34.5-51.8c0 0 0 0 0 0s0 0 0 0c-5.2-7.1-10.4-14.2-15.4-21.4C27.6 247.9 16 213.3 16 176C16 78.8 94.8 0 192 0s176 78.8 176 176c0 16.6-2.3 32.7-6.6 48L320 224c-3.3 0-6.5 .2-9.6 .7zM192 416l64 0c0 14.4 4.8 27.7 12.8 38.4C259.1 487.7 228.4 512 192 512c-44.2 0-80-35.8-80-80l0-16 80 0zM144 176c0 8.8-7.2 16-16 16s-16-7.2-16-16c0-44.2 35.8-80 80-80c8.8 0 16 7.2 16 16s-7.2 16-16 16c-26.5 0-48 21.5-48 48zm400 78c17.7 0 32 14.3 32 32l0 130c0 17.7-14.3 32-32 32l-64 0 0 48c0 6.5-3.9 12.3-9.9 14.8s-12.9 1.1-17.4-3.5L393.4 448 320 448c-17.7 0-32-14.3-32-32l0-130c0-17.7 14.3-32 32-32l224 0z"
      />
    </Svg>
  );
};

interface CallModeBarProps {
  onMute: () => void;
  onHangUp: () => void;
  onSettings: () => void;
  onSuggestions: () => void;
  isMuted: boolean;
  onOpenSettings: () => void;
  onInteraction?: () => void;
}

export const CallModeBar: React.FC<CallModeBarProps> = ({
  onMute,
  onHangUp,
  onSettings,
  onSuggestions,
  isMuted,
  onOpenSettings,
  onInteraction
}) => {
  const colorScheme = useColorScheme();
  const { isTablet } = useDevice();

  const buttonBgColor = colorScheme === 'dark' ? 'rgba(55, 65, 81, 1)' : 'rgba(244, 245, 248, 1)';
  const iconColor = colorScheme === 'dark' ? "#fff" : "#00488F";
  const borderColor = colorScheme === 'dark' ? 'rgba(120, 155, 255, 0.2)' : 'rgba(0, 72, 143, 0.1)';
  
  return (
    <View className={`absolute bottom-0 left-0 right-0 ${
      colorScheme === 'dark' ? 'bg-gray-800/80' : 'bg-white/80'
    }`}>
      <View 
        className={`flex-1 flex-col rounded-t-[24px] w-full pb-4 ${
          colorScheme === 'dark' ? 'bg-gray-800/80' : 'bg-white/90'
        }`}
        style={{
          shadowColor: colorScheme === 'dark' ? '#7a9fff' : '#004b8f',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 2,
          zIndex: 1,
          position: 'relative'
        }}
      >
        <View className="flex-row justify-center items-center gap-8 py-4">
          <TouchableOpacity
            onPress={() => {
              onInteraction?.();
              onMute();
            }}
            style={{ 
              padding: 12,
              backgroundColor: isMuted ? buttonBgColor : buttonBgColor,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: isMuted ? borderColor : borderColor,
              shadowColor: colorScheme === 'dark' ? '#fff' : '#004b8f',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 3,
              elevation: 2,
            }}
          >
            <FontAwesomeIcon 
              icon={isMuted ? faMicrophoneSlash : faMicrophone}
              color={iconColor}
              size={24} 
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              onInteraction?.();
              onHangUp();
            }}
            style={{ 
              padding: 12,
              backgroundColor: '#ef4444',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.2)',
              shadowColor: colorScheme === 'dark' ? '#fff' : '#004b8f',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 3,
              elevation: 2,
            }}
          >
            <FontAwesomeIcon 
              icon={faPhone} 
              color="white" 
              size={24}
              style={{ transform: [{ rotate: '135deg' }] }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              onInteraction?.();
              onOpenSettings();
            }}
            style={{ 
              padding: 12,
              backgroundColor: buttonBgColor,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: borderColor,
              shadowColor: colorScheme === 'dark' ? '#fff' : '#004b8f',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 3,
              elevation: 2,
            }}
          >
            <FontAwesomeIcon 
              icon={faSliders}
              color={iconColor} 
              size={24} 
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}; 
