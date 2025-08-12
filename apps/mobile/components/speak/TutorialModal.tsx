import React, { useEffect, useState } from 'react';
import { View, Text, Dimensions, Platform } from 'react-native';
import { Video, ResizeMode, Audio } from 'expo-av';
import { useColorScheme } from '@/hooks/useColorScheme';
import { GlobalFontStyleSheet } from '@/constants/Font';
import SlidingModal from '@/components/shared/SlidingModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '@/components/shared/Button';
import { faArrowRight, faSparkles } from '@fortawesome/pro-solid-svg-icons';
import { getIconSize } from '@/constants/Font';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import PermissionRequestModal from './PermissionRequestModal';

interface TutorialModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

export default function TutorialModal({ visible, onClose, userId }: TutorialModalProps) {
  const colorScheme = useColorScheme();
  const { width } = Dimensions.get('window');
  const isTablet = width >= 768;
  const videoWidth = Math.min(width - 48, isTablet ? 400 : 300);
  const videoHeight = videoWidth * 1.78;
  const [showPermissions, setShowPermissions] = useState(true);

  // Configure audio to play in silent mode when the component mounts
  useEffect(() => {
    if (visible) {
      const configureAudio = async () => {
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
          });
        } catch (error) {
          console.error('Error configuring audio:', error);
        }
      };
      
      configureAudio();
    }
  }, [visible]);

  const handleClose = async () => {
    try {
      await AsyncStorage.setItem(`tutorial_shown_${userId}`, 'true');
      onClose();
    } catch (error) {
      console.error('Error saving tutorial status:', error);
      onClose();
    }
  };

  const handlePermissionsClose = () => {
    setShowPermissions(false);
  };

  if (showPermissions) {
    return (
      <PermissionRequestModal 
        visible={visible} 
        onClose={handlePermissionsClose} 
      />
    );
  }

  return (
    <SlidingModal 
      visible={visible} 
      onClose={handleClose} 
      isFull={true} 
      bgColor="bg-white dark:bg-gray-900"
      showCloseButton={true}
    >
      <View className="flex-1 items-center justify-center pt-6 pb-12">
        {/* Header Section */}
        <View className="w-full max-w-lg mb-6">
          <Text 
            style={[GlobalFontStyleSheet.textXl]}
            className="font-bold text-gray-900 dark:text-gray-100 text-center mb-3"
          >
            Get the most out of Langua <FontAwesomeIcon icon={faSparkles} size={getIconSize(18)} color="#F87171" />
          </Text>
          <Text 
            style={GlobalFontStyleSheet.textMd}
            className="text-[#044f0] dark:text-gray-300 text-center leading-relaxed"
          >
            There's a lot more to Langua than meets the eye. Take a moment to discover all the features that will accelerate your progress.
          </Text>
        </View>
        
        {/* Enhanced Video Container with double border effect */}
        <View 
          className="mb-8 p-[2px] rounded-3xl"
          style={{
            width: videoWidth + 20, // Add extra space for the outer border
            height: videoHeight + 20,
            backgroundColor: '#F87171',
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                padding: 6,
                borderRadius: 24,
              },
              android: {
                elevation: 8,
              },
            }),
          }}
        >
          {/* Inner border container */}
          <View 
            className="rounded-3xl p-[2px] bg-white dark:bg-gray-800"
            style={{ flex: 1 }}
          >
            {/* Video container */}
            <View 
              className="rounded-2xl overflow-hidden"
              style={{ flex: 1, backgroundColor: '#F87171' }}
            >
              <Video
                source={{
                  uri: 'https://customer-ljken78317krymb6.cloudflarestream.com/d54c795806f9ec26837ad51f5dc7345a/manifest/video.m3u8'
                }}
                posterSource={{
                  uri: 'https://customer-ljken78317krymb6.cloudflarestream.com/d54c795806f9ec26837ad51f5dc7345a/thumbnails/thumbnail.jpg?time=10s'
                }}
                usePoster={true}
                posterStyle={{
                  zIndex: -1
                }}
                useNativeControls
                resizeMode={ResizeMode.COVER}
                isLooping
                shouldPlay
                volume={1.0}
                isMuted={false}
                style={{
                  width: '100%',
                  height: '100%',
                }}
              />
            </View>
          </View>
        </View>

        {/* Action Button */}
        <View className="w-full max-w-sm">
          <Button 
            onPress={handleClose}
            icon={faArrowRight}
            iconSize={getIconSize(16)}
            btnType={{ 
              bg: 'bg-[#F87171]',
              textColor: 'text-white'
            }}
            titleSize='text-lg'
            title="Continue"
            centeredItems={true}
            containerClassNames={`flex-none mb-4 text-center ${Platform.OS === 'ios' ? 'shadow-lg' : ''}`}
          />
        </View>
      </View>
    </SlidingModal>
  );
}
