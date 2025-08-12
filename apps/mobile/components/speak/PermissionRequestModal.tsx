import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking, Image, PixelRatio } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faMicrophone, faGear, faRotateRight, faCheck, faXmark } from '@fortawesome/pro-solid-svg-icons';
import { GlobalFontStyleSheet, getIconSize } from '@/constants/Font';
import { useColorScheme } from '@/hooks/useColorScheme';
import SlidingModal from '@/components/shared/SlidingModal';
import { Audio } from 'expo-av';
import Voice from '@react-native-voice/voice';
import Button from '@/components/shared/Button';
import { PERMISSIONS, RESULTS, check, request, openSettings } from 'react-native-permissions';

interface PermissionRequestModalProps {
  visible: boolean;
  onClose: () => void;
}

const PermissionRequestModal: React.FC<PermissionRequestModalProps> = ({ visible, onClose }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [microphonePermission, setMicrophonePermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [voiceRecognitionPermission, setVoiceRecognitionPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (visible) {
      checkPermissions();
    }
  }, [visible]);

  const checkPermissions = async () => {
    try {
      // Check microphone permission using react-native-permissions
      const micPermission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.MICROPHONE 
        : PERMISSIONS.ANDROID.RECORD_AUDIO;
      
      const micStatus = await check(micPermission);
      setMicrophonePermission(
        micStatus === RESULTS.GRANTED ? 'granted' : 
        micStatus === RESULTS.BLOCKED ? 'denied' : 'pending'
      );

      // For iOS, check speech recognition permission
      if (Platform.OS === 'ios') {
        const speechStatus = await check(PERMISSIONS.IOS.SPEECH_RECOGNITION);
        setVoiceRecognitionPermission(
          speechStatus === RESULTS.GRANTED ? 'granted' : 
          speechStatus === RESULTS.BLOCKED ? 'denied' : 'pending'
        );
      } else {
        // On Android, we don't need to check voice recognition separately
        setVoiceRecognitionPermission('granted');
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  const requestMicrophonePermission = async () => {
    setIsRequesting(true);
    try {
      const micPermission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.MICROPHONE 
        : PERMISSIONS.ANDROID.RECORD_AUDIO;
      
      const status = await request(micPermission);
      setMicrophonePermission(
        status === RESULTS.GRANTED ? 'granted' : 
        status === RESULTS.BLOCKED ? 'denied' : 'pending'
      );
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      setMicrophonePermission('denied');
    } finally {
      setIsRequesting(false);
    }
  };

  const requestVoiceRecognitionPermission = async () => {
    if (Platform.OS !== 'ios') return;
    
    setIsRequesting(true);
    try {
      const status = await request(PERMISSIONS.IOS.SPEECH_RECOGNITION);
      setVoiceRecognitionPermission(
        status === RESULTS.GRANTED ? 'granted' : 
        status === RESULTS.BLOCKED ? 'denied' : 'pending'
      );
    } catch (error) {
      console.error('Error requesting voice recognition permission:', error);
      setVoiceRecognitionPermission('denied');
    } finally {
      setIsRequesting(false);
    }
  };

  const openAppSettings = async () => {
    await openSettings();
  };

  const handleContinue = () => {
    if (!allPermissionsGranted) {
      return;
    }
    onClose();
  };

  const allPermissionsGranted = 
    microphonePermission === 'granted' && 
    (Platform.OS !== 'ios' || voiceRecognitionPermission === 'granted');

  return (
    <SlidingModal 
      visible={visible} 
      onClose={onClose} 
      isFull={true} 
      bgColor="bg-white dark:bg-gray-900"
      showCloseButton={false}
    >
      <View className="flex-1 items-center justify-between py-8 px-4">
        {/* Header Section */}
        <View className="w-full items-center mt-8">
          <View className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-500/50 items-center justify-center mb-4">
            <FontAwesomeIcon 
              icon={faMicrophone} 
              size={getIconSize(32)} 
              color={isDark ? '#60A5FA' : '#3B82F6'} 
            />
          </View>
          <Text 
            style={[GlobalFontStyleSheet.textXl, styles.boldText]}
            className="text-gray-900 dark:text-gray-100 text-center mb-3"
          >
            Enable Permissions
          </Text>
          <Text 
            style={GlobalFontStyleSheet.textMd}
            className="text-gray-600 dark:text-gray-400 text-center leading-relaxed max-w-md"
          >
            Please enable microphone and voice recognition access below so that you can learn with Langua.
          </Text>
        </View>
        
        {/* Permissions List */}
        <View className="w-full max-w-md gap-4 my-8">
          {/* Microphone Permission */}
          <View className={`p-5 rounded-2xl flex-row items-center justify-between ${isDark ? 'bg-gray-800' : 'bg-gray-50/40'}`}>
            <View className="flex-row items-center">
              <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${isDark ? 'bg-blue-500/50' : 'bg-blue-100'}`}>
                <FontAwesomeIcon 
                  icon={faMicrophone} 
                  size={getIconSize(18)} 
                  color={isDark ? '#60A5FA' : '#3B82F6'} 
                />
              </View>
              <View>
                <Text 
                  style={[GlobalFontStyleSheet.textLg, styles.boldText]} 
                  className={`${isDark ? 'text-gray-100' : 'text-gray-900'}`}
                >
                  Microphone
                </Text>
                <Text 
                  style={GlobalFontStyleSheet.textSm}
                  className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                >
                  {microphonePermission === 'granted' 
                    ? 'Access granted' 
                    : microphonePermission === 'denied' 
                      ? 'Access denied' 
                      : 'Permission needed'}
                </Text>
              </View>
            </View>
            {microphonePermission === 'granted' ? (
              <View className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 items-center justify-center">
                <FontAwesomeIcon 
                  icon={faCheck} 
                  size={getIconSize(16)} 
                  color={isDark ? '#34D399' : '#10B981'} 
                />
              </View>
            ) : (
              <TouchableOpacity 
                onPress={microphonePermission === 'denied' ? openAppSettings : requestMicrophonePermission}
                disabled={isRequesting}
                className={`px-4 py-2 rounded-xl ${microphonePermission === 'denied' 
                  ? 'bg-[#F87171]'
                  : isDark ? 'bg-blue-600' : 'bg-blue-500'}`}
              >
                <Text 
                  style={GlobalFontStyleSheet.textSm}
                  className="text-white font-medium"
                >
                  {microphonePermission === 'denied' ? 'Settings' : 'Allow'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Voice Recognition Permission (iOS only) */}
          {Platform.OS === 'ios' && (
            <View className={`p-5 rounded-2xl flex-row items-center justify-between ${isDark ? 'bg-gray-800' : 'bg-gray-50/30'}`}>
              <View className="flex-row items-center">
                <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${isDark ? 'bg-purple-900' : 'bg-purple-100'}`}>
                  <FontAwesomeIcon 
                    icon={faMicrophone} 
                    size={getIconSize(18)} 
                    color={isDark ? '#C084FC' : '#9333EA'} 
                  />
                </View>
                <View>
                  <Text 
                    style={[GlobalFontStyleSheet.textLg, styles.boldText]}
                    className={`${isDark ? 'text-gray-100' : 'text-gray-900'}`}
                  >
                    Voice Recognition
                  </Text>
                  <Text 
                    style={GlobalFontStyleSheet.textSm}
                    className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    {voiceRecognitionPermission === 'granted' 
                      ? 'Access granted' 
                      : voiceRecognitionPermission === 'denied' 
                        ? 'Access denied' 
                        : 'Permission needed'}
                  </Text>
                </View>
              </View>
              {voiceRecognitionPermission === 'granted' ? (
                <View className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 items-center justify-center">
                  <FontAwesomeIcon 
                    icon={faCheck} 
                    size={getIconSize(16)} 
                    color={isDark ? '#34D399' : '#10B981'} 
                  />
                </View>
              ) : (
                <TouchableOpacity 
                  onPress={voiceRecognitionPermission === 'denied' ? openAppSettings : requestVoiceRecognitionPermission}
                  disabled={isRequesting}
                  className={`px-4 py-2 rounded-xl ${voiceRecognitionPermission === 'denied' 
                    ? 'bg-[#F87171]'
                    : isDark ? 'bg-purple-600' : 'bg-purple-500'}`}
                >
                  <Text 
                    style={GlobalFontStyleSheet.textSm}
                    className="text-white font-medium"
                  >
                    {voiceRecognitionPermission === 'denied' ? 'Settings' : 'Allow'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        
        {/* Action Button */}
        <View className="w-full max-w-sm">
          {!allPermissionsGranted && (
            <Text 
              style={GlobalFontStyleSheet.textSm}
              className="text-center text-gray-500 dark:text-gray-400 mb-3"
            >
              Please grant all required permissions to continue
            </Text>
          )}
          <Button 
            onPress={handleContinue}
            icon={faCheck}
            iconSize={getIconSize(16)}
            btnType={{
              bg: allPermissionsGranted ? 'bg-[#F87171]' : 'bg-gray-100 dark:bg-gray-700',
              textColor: allPermissionsGranted ? 'text-white' : 'text-gray-400 dark:text-gray-900'
            }}
            title="Continue"
            centeredItems={true}
            containerClassNames={`flex-none mb-4 text-center ${Platform.OS === 'ios' ? 'shadow-lg' : ''}`}
          />
        </View>
      </View>
    </SlidingModal>
  );
};

// Add custom styles
const styles = StyleSheet.create({
  boldText: {
    fontFamily: 'Lato-Bold',
  },
});

export default PermissionRequestModal; 
