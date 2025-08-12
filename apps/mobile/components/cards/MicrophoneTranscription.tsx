import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Text } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faMicrophone, faStop } from '@fortawesome/free-solid-svg-icons';
import { Audio } from 'expo-av';
import { useAuth } from '@/contexts/AuthContext';
import { GeminiTranscriptionService } from '@/services/GeminiTranscriptionService';
import * as Haptics from 'expo-haptics';
import { colorScheme } from "nativewind";
import BouncingDots from '@/components/BouncingDots';
import { GlobalFontStyleSheet } from "@/constants/Font";
import MicrophonePermissionRequest from '@/components/speak/MicrophonePermissionRequest';

interface MicrophoneTranscriptionProps {
  language?: string;
  onTranscriptionComplete?: (text: string, isAudio: boolean) => void;
  wordToGuess?: string;
  onPermissionError?: (type: 'permission' | 'initialization' | 'connection' | 'generic') => void;
}

const MicrophoneTranscription: React.FC<MicrophoneTranscriptionProps> = ({ 
  language,
  onTranscriptionComplete,
  onPermissionError
}) => {
  const { token } = useAuth();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimeout = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);
  
  // Animation values
  const scaleAnim = new Animated.Value(1);
  const pulseAnim = new Animated.Value(1);
  const hintOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let pulseAnimation: Animated.CompositeAnimation;
    
    if (isRecording && isLongPress.current) {  // Only pulse if it's a long press recording
      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      if (pulseAnimation) {
        pulseAnimation.stop();
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // First ensure any existing recording is stopped and unloaded
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
        } catch (error) {
          console.log('Error cleaning up existing recording:', error);
        }
        setRecording(null);
      }

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        console.error('Permission to access microphone was denied');
        onPermissionError?.('permission');
        return;
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recordingInstance = new Audio.Recording();
      try {
        await recordingInstance.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await recordingInstance.startAsync();
        setRecording(recordingInstance);
        setIsRecording(true);
      } catch (error) {
        console.error('Failed to start recording:', error);
        onPermissionError?.('initialization');
        // Clean up the failed recording instance
        try {
          await recordingInstance.stopAndUnloadAsync();
        } catch (cleanupError) {
          console.log('Error cleaning up failed recording:', cleanupError);
        }
        setRecording(null);
        setIsRecording(false);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      onPermissionError?.('initialization');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!recording) {
      setIsRecording(false);
      return;
    }

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      
      // Reset audio mode after stopping recording - match the working implementation
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        // Remove staysActiveInBackground as it causes conflicts on iOS
      });
      
      if (uri) {
        await transcribeAudio(uri);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
      setRecording(null);
      
      // Make sure we reset audio mode even if there's an error
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      } catch (audioError) {
        console.error('Failed to reset audio mode:', audioError);
      }
    }
  };

  // Clean up recording on component unmount
  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync()
          .then(() => {
            // Reset audio mode when component unmounts
            return Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              playsInSilentModeIOS: true,
            });
          })
          .catch(error => {
            console.log('Error cleaning up recording on unmount:', error);
          });
      }
    };
  }, [recording]);

  const showHintMessage = () => {
    setShowHint(true);
    Animated.sequence([
      Animated.timing(hintOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(hintOpacity, {
        toValue: 0,
        duration: 200,
        delay: 2000,
        useNativeDriver: true,
      }),
    ]).start(() => setShowHint(false));
  };

  const handlePressIn = () => {
    if (hintTimeoutRef.current) {
      clearTimeout(hintTimeoutRef.current);
    }
    
    isLongPress.current = false;
    
    // Set a timeout to determine if this is a long press
    longPressTimeout.current = setTimeout(() => {
      isLongPress.current = true;
      startRecording();
    }, 200); // Wait 200ms to determine if it's a long press

    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
    }

    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    if (isLongPress.current && isRecording) {
      stopRecording();
    }
    isLongPress.current = false;
  };

  const handlePress = () => {
    if (!isLongPress.current) {
      showHintMessage();
    }
  };

  const transcribeAudio = async (audioUri: string) => {
    try {
      setIsTranscribing(true);
      const geminiService = new GeminiTranscriptionService(token!);
      const result = await geminiService.transcribe({
        audioUri,
        language: language || '',
        variant: 'gemini',
      });
      
      if (onTranscriptionComplete) {
        onTranscriptionComplete(result, true);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      setIsTranscribing(false);
    } 
  };

  return (
    <View style={styles.container}>
      {isTranscribing ? (
        <View style={styles.loadingContainer}>
          <BouncingDots size={10} />
        </View>
      ) : (
        <View>
          <TouchableOpacity
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.8}
          >
            <Animated.View
              style={[
                styles.buttonContainer,
                {
                  transform: [
                    { scale: scaleAnim },
                    { scale: isRecording ? pulseAnim : 1 }
                  ],
                },
                isRecording && styles.recordingContainer
              ]}
            >
              <View style={[
                styles.button,
                isRecording && styles.recordingButton
              ]}>
                <FontAwesomeIcon
                  icon={faMicrophone}
                  size={28}
                  color={colorScheme.get() === 'dark' ? '#fff' : isRecording ? '#fff' : '#00448F'}
                />
              </View>
            </Animated.View>
          </TouchableOpacity>
          
          <Animated.View 
            style={[
              styles.hintContainer,
              { opacity: hintOpacity }
            ]}
            pointerEvents="none"
          >
            <Text style={[GlobalFontStyleSheet.textSm, styles.hintText]}>
              Press and hold to record
            </Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    maxHeight: 40,
  },
  buttonContainer: {
    borderRadius: 40,
    padding: 8,
    overflow: 'hidden',
  },
  recordingContainer: {
    backgroundColor: 'rgba(255, 75, 75, 0.1)',
  },
  button: {
    backgroundColor: 'transparent',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingButton: {
    backgroundColor: '#FF4B4B',
  },
  loadingContainer: {
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintContainer: {
    position: 'absolute',
    left: -60,
    right: -60,
    alignItems: 'center',
  },
  hintText: {
    color: colorScheme.get() === 'dark' ? '#ffffff' : '#666666',
    textAlign: 'center',
  },
});

export default MicrophoneTranscription; 
