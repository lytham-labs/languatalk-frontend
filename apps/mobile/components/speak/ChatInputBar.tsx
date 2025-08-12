import React, { useRef, useState, useEffect } from 'react';
import { View, TextInput, ActivityIndicator, Animated, Easing, Text, TouchableOpacity, Platform, Keyboard } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faKeyboard, faPause, faLightbulb } from '@fortawesome/free-solid-svg-icons';
import { faMicrophone, faLightbulbMessage, faTrashCan } from '@fortawesome/pro-regular-svg-icons';
import { faPaperPlaneTop } from '@fortawesome/pro-solid-svg-icons';
import { Colors } from '@/constants/Colors';
import { GlobalFontStyleSheet, getIconSize } from '@/constants/Font';
import PulsingButton from '../PulsingButton';
import useDevice from '@/hooks/useDevice';
import TranscribingDots from '@/components/TranscribingDots';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = 'send' | 'mic' | 'lightbulb' | 'lightbulbMessage' | 'pause' | 'trash' | 'keyboard';

interface IconProps {
  name: IconName;
  color?: string;
  size?: number;
  style?: any;
}

const Icon: React.FC<IconProps> = ({ name, color = "#00488F", size = 18, style = {} }) => {
  const { isTablet } = useDevice();
  const finalSize = isTablet ? size * 1.3 : size;

  // Using any here to bypass the type mismatch between Pro and regular icons
  const iconMap: Record<IconName, any> = {
    send: faPaperPlaneTop,
    mic: faMicrophone,
    lightbulb: faLightbulb,
    lightbulbMessage: faLightbulbMessage,
    pause: faPause,
    trash: faTrashCan,
    keyboard: faKeyboard
  };

  const icon = iconMap[name];
  if (!icon) return null;

  return (
    <FontAwesomeIcon 
      icon={icon} 
      size={finalSize} 
      color={color}
      style={[
        name === 'send' && !isTablet && { transform: [{ translateX: 4 }, { rotate: '-45deg' }] },
        name === 'send' && isTablet && { transform: [{ rotate: '-45deg' }] },
        style
      ]}
    />
  );
};

interface ChatInputBarProps {
  message: string;
  setMessage: (text: string) => void;
  isRecording: boolean;
  isTranscribing: boolean;
  isWaitingForResponse: boolean;
  sending: boolean;
  hasText: boolean;
  setHasText: (hasText: boolean) => void;
  isSuggestReplyPulsing: boolean;
  transcriptionText: string;
  colorScheme: 'light' | 'dark';
  transcriptionMode: string;
  transcriptionModel: string;
  isDeepgramConnected: boolean;
  handleSuggestedReplies: () => void;
  startRecording: (isLongPress?: boolean) => void;
  stopRecording: (send?: boolean) => void;
  cancelRecording: () => void;
  sendMessage: () => void;
  triggerHaptic: () => void;
  language: string;
  chatId?: string | string[];
}

const ChatInputBar: React.FC<ChatInputBarProps> = ({
  message,
  setMessage,
  isRecording,
  isTranscribing,
  isWaitingForResponse,
  sending,
  hasText,
  setHasText,
  isSuggestReplyPulsing,
  transcriptionText,
  colorScheme,
  transcriptionMode,
  transcriptionModel,
  isDeepgramConnected,
  handleSuggestedReplies,
  startRecording,
  stopRecording,
  cancelRecording,
  sendMessage,
  triggerHaptic,
  chatId,
  language,
}) => {
  // DEBUG: Set to true to test timeout scenarios
  const DEBUG_SIMULATE_TIMEOUT = false;
  const DEBUG_TIMEOUT_DELAY = DEBUG_SIMULATE_TIMEOUT ? 5000 : 25000; // 5 seconds for testing, 25 seconds for production
  const { isTablet } = useDevice();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLongPressRecording, setIsLongPressRecording] = useState(false);
  const [isLongPressActive, setIsLongPressActive] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [typingMode, setTypingMode] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [shouldShowRecordingUI, setShouldShowRecordingUI] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTime = useRef<number | null>(null);
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const pingAnimation = useRef(new Animated.Value(0)).current;
  const textInputRef = useRef<TextInput | null>(null);
  const [isStoppingRecording, setIsStoppingRecording] = useState(false);
  
  // Add timeout state for stuck transcription
  const [showTranscriptionTimeout, setShowTranscriptionTimeout] = useState(false);
  const transcriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
      if (transcriptionTimeoutRef.current) {
        clearTimeout(transcriptionTimeoutRef.current);
        transcriptionTimeoutRef.current = null;
      }
    };
  }, []);
  
  // Track keyboard height for Android 15
  useEffect(() => {
    if (Platform.OS === 'android' && Platform.Version >= 35) {
      const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      });
      
      const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardHeight(0);
      });
      
      return () => {
        keyboardDidShowListener.remove();
        keyboardDidHideListener.remove();
      };
    }
  }, []);
  
  // Reset states when recording stops
  useEffect(() => {
    if (!isRecording && !isStoppingRecording) {
      // Only reset if we're not in the middle of stopping/transcribing
      setIsLongPressRecording(false);
      setIsLongPressActive(false);
      setShowTranscriptionTimeout(false);
      
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
      
      if (transcriptionTimeoutRef.current) {
        clearTimeout(transcriptionTimeoutRef.current);
        transcriptionTimeoutRef.current = null;
      }
      
      pulseAnimation.stopAnimation();
      pulseAnimation.setValue(1);
      pingAnimation.stopAnimation();
      pingAnimation.setValue(0);
      recordingStartTime.current = null;
    }
  }, [isRecording, isStoppingRecording]);
  
  // Update recording UI state based on recording states
  useEffect(() => {
    if (isRecording && !isLongPressRecording && !isStoppingRecording) {
      setShouldShowRecordingUI(true);
    } else if (isLongPressRecording && !isStoppingRecording) {
      if (isLongPressActive) {
        // During active long press, don't show recording UI
        setShouldShowRecordingUI(false);
      } else {
        // After long press ends but still recording, show recording UI
        setShouldShowRecordingUI(true);
      }
    } else if (DEBUG_SIMULATE_TIMEOUT && isStoppingRecording) {
      // Keep recording UI visible during debug timeout simulation
      setShouldShowRecordingUI(true);
    } else {
      setShouldShowRecordingUI(false);
    }
  }, [isRecording, isLongPressRecording, isLongPressActive, isStoppingRecording]);
  
  // Start pulsating animation when recording
  useEffect(() => {
    if ((isRecording || isLongPressRecording) && !isStoppingRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      // Start timer to track recording duration
      setRecordingDuration(0);
      recordingStartTime.current = Date.now();
      
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
      
      recordingTimer.current = setInterval(() => {
        if (recordingStartTime.current) {
          const elapsedSeconds = Math.floor((Date.now() - recordingStartTime.current) / 1000);
          setRecordingDuration(elapsedSeconds);
        }
      }, 500); // Update twice per second for smoother display
    } else {
      pulseAnimation.stopAnimation();
      pulseAnimation.setValue(1);
      
      if (isStoppingRecording) {
        // Freeze the timer at current value when stopping
        if (recordingTimer.current) {
          clearInterval(recordingTimer.current);
          recordingTimer.current = null;
        }
      } else {
        recordingStartTime.current = null;
        setRecordingDuration(0);
        
        if (recordingTimer.current) {
          clearInterval(recordingTimer.current);
          recordingTimer.current = null;
        }
      }
    }
  }, [isRecording, isLongPressRecording, isStoppingRecording]);

  // Ping animation for long press
  useEffect(() => {
    if (isLongPressActive && !isStoppingRecording) {
      pingAnimation.setValue(0);
      
      Animated.loop(
        Animated.sequence([
          // Animate ping outward with fading
          Animated.timing(pingAnimation, {
            toValue: 0.3,
            duration: 1200,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
          // Reset value instantly
          Animated.timing(pingAnimation, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          // Small delay before next ping starts
        ])
      ).start();
    } else {
      pingAnimation.stopAnimation();
      pingAnimation.setValue(0);
    }
  }, [isLongPressActive, isStoppingRecording]);

  // Add effect to switch to typing mode when transcription is complete
  // Reset isStoppingRecording when transcription completes
  useEffect(() => {
    if (!isTranscribing && isStoppingRecording) {
      // Transcription has completed, reset the stopping state
      setIsStoppingRecording(false);
      
      // Clear any pending timeouts
      if (transcriptionTimeoutRef.current) {
        clearTimeout(transcriptionTimeoutRef.current);
        transcriptionTimeoutRef.current = null;
      }
      setShowTranscriptionTimeout(false);
    }
  }, [isTranscribing, isStoppingRecording]);
  
  // Debug effect to monitor timeout state
  useEffect(() => {
    if (DEBUG_SIMULATE_TIMEOUT) {
      console.log('[DEBUG] ChatInputBar state changed:', {
        isRecording,
        isTranscribing,
        isStoppingRecording,
        showTranscriptionTimeout
      });
    }
  }, [isRecording, isTranscribing, isStoppingRecording, showTranscriptionTimeout]);
  
  // Effect to handle transcription timeout when isTranscribing becomes true
  useEffect(() => {
    if (isTranscribing && DEBUG_SIMULATE_TIMEOUT) {
      console.log('[DEBUG] isTranscribing became true, starting timeout');
      
      // Set timeout for stuck transcription
      transcriptionTimeoutRef.current = setTimeout(() => {
        console.log('[DEBUG] Transcription timeout triggered (from isTranscribing) after', DEBUG_TIMEOUT_DELAY, 'ms');
        setShowTranscriptionTimeout(true);
        setIsStoppingRecording(true); // Ensure this is set
        
        // Auto-cancel after showing timeout for 5 more seconds
        setTimeout(() => {
          console.log('[DEBUG] Auto-cancelling transcription');
          forceStopTranscription();
        }, 5000);
      }, DEBUG_TIMEOUT_DELAY);
    }
    
    return () => {
      if (transcriptionTimeoutRef.current) {
        clearTimeout(transcriptionTimeoutRef.current);
        transcriptionTimeoutRef.current = null;
      }
    };
  }, [isTranscribing]);
  
  // Force cancel function for stuck transcription
  const forceStopTranscription = async () => {
    console.log('[DEBUG] Force stop transcription called');
    
    if (transcriptionTimeoutRef.current) {
      clearTimeout(transcriptionTimeoutRef.current);
      transcriptionTimeoutRef.current = null;
    }
    
    setIsStoppingRecording(false);
    setShowTranscriptionTimeout(false);
    
    if (DEBUG_SIMULATE_TIMEOUT) {
      console.log('[DEBUG] Skipping actual cancelRecording in debug mode');
      // In debug mode, just reset the state without calling the actual function
      setTypingMode(false); // Stay in recording mode UI
      // Also trigger parent to reset transcribing state
      // Call parent's cancelRecording to reset states
      await cancelRecording();
    } else {
      await cancelRecording();
    }
    
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
    
    console.log('[DEBUG] Force stop completed');
  };
  
  const handleCancelOrClear = async () => {
    triggerHaptic();
    if (isRecording) {
      setIsStoppingRecording(true);
      await cancelRecording();
    }
    setMessage('');
    setHasText(false);
  };

  const sendButtonScale = useRef(new Animated.Value(1)).current;

  const animateSendButton = () => {
    Animated.sequence([
      Animated.timing(sendButtonScale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
        easing: Easing.ease,
      }),
      Animated.timing(sendButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
        easing: Easing.ease,
      }),
    ]).start();
  };

  const handleSend = () => {
    if (sendMessage) {
      animateSendButton();
      sendMessage();
      setMessage('');
    }
  };

  const handleStopRecording = async (send: boolean = false) => {
    console.log('[DEBUG] handleStopRecording called with send=', send);
    setIsStoppingRecording(true);
    
    // Set timeout for stuck transcription
    transcriptionTimeoutRef.current = setTimeout(() => {
      console.log('[DEBUG] Transcription timeout triggered after', DEBUG_TIMEOUT_DELAY, 'ms');
      console.log('[DEBUG] Current states: isStoppingRecording=', isStoppingRecording, 'showTranscriptionTimeout=', showTranscriptionTimeout);
      setShowTranscriptionTimeout(true);
      // Auto-cancel after showing timeout for 5 more seconds
      setTimeout(() => {
        console.log('[DEBUG] Auto-cancelling transcription');
        forceStopTranscription();
      }, 5000);
    }, DEBUG_TIMEOUT_DELAY);
    
    try {
      // DEBUG: Simulate stuck transcription by not calling stopRecording
      if (DEBUG_SIMULATE_TIMEOUT) {
        console.log('[DEBUG] Simulating stuck transcription - NOT calling stopRecording');
        // Don't call the actual stopRecording function
        // Just keep the UI in "processing" state
        return; // Exit early without calling stopRecording
      }
      
      // Normal flow (when not in debug mode)
      if (!send) {
        // Don't switch to typing mode when pausing, wait for transcription
        await stopRecording(send);
        if (!isTranscribing) {
          setTypingMode(true);
        }
      } else {
        await stopRecording(send);
      }
      
      // Clear timeout on successful completion
      if (transcriptionTimeoutRef.current) {
        clearTimeout(transcriptionTimeoutRef.current);
        transcriptionTimeoutRef.current = null;
      }
      setShowTranscriptionTimeout(false);
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('Error during transcription:', error);
      forceStopTranscription();
    }
  };

  const handleCancelRecording = async () => {
    setIsStoppingRecording(true);
    await cancelRecording();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
  };

  const handleMicLongPress = () => {
    // Set flag that long press is active
    setIsLongPressActive(true);
    
    // Set a short timer before actually starting to record
    // This helps prevent accidental recording on slightly longer taps
    longPressTimer.current = setTimeout(() => {
      setIsLongPressRecording(true);
      startRecording(true);
    }, 150);
  };

  const handleMicPressOut = async () => {
    // Clear the timer if user releases before recording starts
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    if (isLongPressRecording) {
      setIsLongPressRecording(false);
      setIsStoppingRecording(true);
      await stopRecording(true); // Call stopRecording directly instead of handleStopRecording
    }
    setIsLongPressActive(false);
  };

  const navigateToCallMode = () => {
    router.push({
      pathname: '/(tabs)/speak/call',
      params: chatId ? { chatId } : {}
    });
  };
  
  const toggleInputMode = () => {
    setTypingMode(!typingMode);
    triggerHaptic();
    
    // For Android 15, manually focus after a delay to ensure layout is ready
    if (!typingMode && Platform.OS === 'android' && Platform.Version >= 35) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  };

  // Format recording duration into MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Determine if controls should be disabled
  const areControlsDisabled = isWaitingForResponse || isTranscribing || 
    (transcriptionModel === 'deepgram' && !isDeepgramConnected) || isStoppingRecording;
  
  // Typing mode UI
  if (typingMode && !isRecording) {
    // Add margin for Android 15+ keyboard - add responsive padding based on device type
    const extraPadding = isTablet ? 40 : 25; // More padding for tablets
    const androidMargin = Platform.OS === 'android' && Platform.Version >= 35 && keyboardHeight > 0
      ? { marginBottom: keyboardHeight + extraPadding }
      : {};
    
    const content = (
      <View className={`flex-row items-center  ${
        colorScheme === 'dark' ? 'bg-gray-800 ' : ' '
      }
      
      `} style={[{ position: 'relative' }, androidMargin]}>
        
        {/* Input container */}
        <View className={`flex-1 flex-col  rounded-t-[24px] w-full pb-4 ${
          colorScheme === 'dark' ? 'bg-gray-700/80' : 'bg-white'
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
          {/* Input row - now spans full width */}
          <View className="w-full flex-row items-center px-4">
            <TextInput
            className={`flex-1 px-3 text-lg opacity-100 ${
              colorScheme === 'dark' ? 'text-white' : 'text-gray-800'
            }`}
              value={message}
              placeholder="Type here or record via mic ↓"
              placeholderTextColor={colorScheme === 'dark' ? "#9CA3AF" : "#6B7280"}
              multiline
              onChangeText={(text) => {
                setMessage(text);
                setHasText(text.trim().length > 0);
              }}
              selectionColor={Colors[colorScheme]?.placeholderText}
              editable={!isRecording && !isStoppingRecording}
              style={[ 
                isTablet ? GlobalFontStyleSheet.textMd : GlobalFontStyleSheet.textLg,
                { 
                  textAlignVertical: 'center',
                  minHeight: isTablet ? 60 : 48,
                  maxHeight: isTablet ? 190 : 160,
                  paddingTop: isTablet ? 15 : 12,
                  paddingBottom: isTablet ? 15 : 12,
                  lineHeight: isTablet ? 24 : 20,
                }
              ]}
              autoFocus={Platform.OS === 'ios' || Platform.Version < 35}
              ref={textInputRef}
            />

            <View className="pr-4 flex justify-center">
              <Animated.View style={{ transform: [{ scale: sendButtonScale }] }}>
                
              </Animated.View>
            </View>
          </View>
          {/* Floating icons row */}
          <View 
            style={{ 
              paddingTop: 5,
              position: 'relative', 
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: 24,
            }}
          >
            <View className="flex-row">
              <PulsingButton
                onPress={handleCancelOrClear}
                icon={
                  <Icon name="trash" color={!hasText ? "#687076" : "#FF8620"}/>
                }
                isPulsing={false}
                disabled={!hasText || isStoppingRecording}
                style={{ 
                  padding: 8,
                  height: 35,
                  width: 35,
                  borderRadius: 100,
                  backgroundColor: colorScheme === 'dark' ? 'rgba(55, 65, 81, 1)' : 'rgba(55, 65, 81, 0.03)',
                  shadowColor: colorScheme === 'dark' ? '#fff' : '#004b8f',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                  elevation: 2,
                  borderWidth: 1,
                  borderColor: colorScheme === 'dark' ? 'rgba(120, 155, 255, 0.15)' : 'rgba(0, 72, 143, 0.1)',
                }}
                canLongPress={false}
              />

              <PulsingButton
                onPress={handleSuggestedReplies}
                icon={
                  <Icon name="lightbulb" color={colorScheme === 'dark' ? "#fff" : "#000"} />
                }
                isPulsing={isSuggestReplyPulsing}
                disabled={isWaitingForResponse || isTranscribing || isStoppingRecording}
                canLongPress={false}
                style={{ 
                  padding: 8,
                  height: 35,
                  marginLeft: 20,
                  borderRadius: 100,
                  backgroundColor: colorScheme === 'dark' ? 'rgba(55, 65, 81, 1)' : 'rgba(55, 65, 81, 0.03)',
                  shadowColor: colorScheme === 'dark' ? '#fff' : '#004b8f',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                  elevation: 2,
                  borderWidth: 1,
                  borderColor: colorScheme === 'dark' ? 'rgba(120, 155, 255, 0.15)' : 'rgba(0, 72, 143, 0.1)',
                }}
              />

              <PulsingButton
                onPress={() => {
                  setTypingMode(false);
                  triggerHaptic();
                  startRecording();
                }}
                icon={
                  <Icon name="mic"
                    color={colorScheme === 'dark' ? "#fff" : "#000"}
                    size={18}
                  />
                }
                isPulsing={false}
                disabled={areControlsDisabled}
                style={{ 
                  padding: 8, 
                  marginLeft: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 35,
                  width: 35,
                  borderRadius: 100,
                  backgroundColor: colorScheme === 'dark' ? 'rgba(55, 65, 81, 1)' : 'rgba(55, 65, 81, 0.03)',
                  shadowColor: colorScheme === 'dark' ? '#fff' : '#004b8f',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                  elevation: 2,
                  borderWidth: 1,
                  borderColor: colorScheme === 'dark' ? 'rgba(120, 155, 255, 0.15)' : 'rgba(0, 72, 143, 0.1)',
                }}
                canLongPress={false}
              />
            </View>
            <View className="flex-row">
            
              <PulsingButton
                style={{ 
                  padding: 8,
                  width: 45,
                  height: 45,
                  backgroundColor: !hasText ? 'transparent' : colorScheme === 'dark' ? 'rgba(120, 155, 255, 0.15)' : 'rgba(0, 72, 143, 0.08)',
                  borderRadius: 50,
                  borderWidth: hasText ? 1 : 0,
                  borderColor: colorScheme === 'dark' ? 'rgba(120, 155, 255, 0.2)' : 'rgba(0, 72, 143, 0.1)',
                }}
                onPress={handleSend}
                disabled={!hasText || sending || isWaitingForResponse || isRecording || isStoppingRecording}
                isPulsing={false}
                icon={
                  sending ? (
                    <ActivityIndicator size="small" color={colorScheme === 'dark' ? "#fff" : "#00488F"} />
                  ) : (
                    <Icon name="send" 
                      color={!hasText ? "#687076" : colorScheme === 'dark' ? "#fff" : "#00488F"} 
                      size={22}
                    />
                  )
                }
                canLongPress={false}
              />
            </View>
            
          </View>
        </View>
      </View>
    );
    
    return content;
  }

  // Speaking mode UI (default) or Recording UI
  return (
    <View className={`flex-row items-center  ${
      colorScheme === 'dark' ? 'bg-gray-800' : ''
    }
    `} style={{ position: 'relative' }}>
      
       <View className={`flex-1 flex-col rounded-t-[24px] w-full pb-2 items-center  ${
          colorScheme === 'dark' ? 'bg-gray-700/80' : 'bg-white'
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
        
        {/* Speaking mode layout */}
        <View className="flex-row justify-center items-center w-full py-4 z-10">
          {/* Left Icon: Suggestion or Cancel */}
          {!isLongPressRecording && (
            <View className="flex justify-center px-7">
              <PulsingButton
                onPress={shouldShowRecordingUI ? handleCancelRecording : handleSuggestedReplies}
              icon={
                shouldShowRecordingUI ? (
                  <Icon name="trash" color={"#FF8620"}/>
                ) : (
                  <Icon name="lightbulbMessage" color={colorScheme === 'dark' ? "#fff" : "#00488F"} />
                )
              }
              isPulsing={!shouldShowRecordingUI && isSuggestReplyPulsing}
              disabled={isWaitingForResponse || isTranscribing || isStoppingRecording}
              canLongPress={false}
              style={{ 
                padding: 12,
                backgroundColor: colorScheme === 'dark' ? 'rgba(55, 65, 81, 1)' : 'rgba(55, 65, 81, 0.03)',
                borderRadius: 50,
                borderWidth: 1,
                borderColor: colorScheme === 'dark' ? 'rgba(120, 155, 255, 0.2)' : 'rgba(0, 72, 143, 0.1)',
              }}
            />
          </View>
          )}
          
          {/* Center: Mic/Record button or Send button when recording */}
          <View className="flex items-center justify-center"
          style={{
              padding: 2,
              borderWidth: 2,
              borderColor: colorScheme === 'dark' ? 'rgba(120, 155, 255, 0.2)' : 'rgba(0, 72, 143, 0.2)',
              borderRadius: 100
          }}
          >
            {isLongPressActive && !shouldShowRecordingUI && !isStoppingRecording && (
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  backgroundColor: 'transparent',
                  borderWidth: 2,
                  borderColor: colorScheme === 'dark' ? 'rgba(120, 155, 255, 0.5)' : 'rgba(0, 72, 143, 0.3)',
                  transform: [{
                    scale: pingAnimation.interpolate({
                      inputRange: [0, 0.3],
                      outputRange: [1, 3]
                    })
                  }],
                  opacity: pingAnimation.interpolate({
                    inputRange: [0, 0.3],
                    outputRange: [0.8, 0]
                  })
                }}
              />
            )}
            <Animated.View style={[
              shouldShowRecordingUI && !isStoppingRecording ? { transform: [{ scale: pulseAnimation }]} : {}
            ]}>
              <PulsingButton
                onPress={shouldShowRecordingUI ? () => {
                  console.log('[DEBUG] Tap-to-record: Stopping recording, shouldShowRecordingUI=', shouldShowRecordingUI);
                  console.log('[DEBUG] isRecording=', isRecording, 'isStoppingRecording=', isStoppingRecording);
                  handleStopRecording(true);
                } : () => {
                  console.log('[DEBUG] Tap-to-record: Starting recording');
                  startRecording();
                }}
                onLongPress={shouldShowRecordingUI || isStoppingRecording ? undefined : handleMicLongPress}
                onPressOut={shouldShowRecordingUI || isStoppingRecording ? undefined : handleMicPressOut}
                disabled={areControlsDisabled}
                isPulsing={false}
                style={{ 
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 80,
                  width: 80,
                  borderRadius: 100,
                  backgroundColor: colorScheme === 'dark' ? 'rgba(55, 65, 81, 1)' : 'rgba(55, 65, 81, 0.03)',
                  shadowColor: colorScheme === 'dark' ? '#fff' : '#004b8f',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                  elevation: 2,
                  borderWidth: 1,
                  borderColor: colorScheme === 'dark' ? 'rgba(120, 155, 255, 0.15)' : 'rgba(0, 72, 143, 0.3)',
                }}
                icon={
                  isStoppingRecording ? (
                    <ActivityIndicator size="small" color={colorScheme === 'dark' ? "#fff" : "#00488F"} />
                  ) : shouldShowRecordingUI ? (
                    <Icon name="send" 
                      color={colorScheme === 'dark' ? "#fff" : "#00488F"} 
                      size={38}
                    />
                  ) : isTranscribing ? (
                    <TranscribingDots />
                  ) : (
                    <Icon name="mic" 
                      color={
                        areControlsDisabled
                          ? "#687076"
                          : colorScheme === 'dark' ? "#fff" : "rgba(0, 72, 143, 0.8)"
                      } 
                      size={38}
                    />
                  )
                }
                delayLongPress={300}
                canLongPress={!shouldShowRecordingUI && !isStoppingRecording}
              />
            </Animated.View>
          </View>
          
          {/* Right Icon: Keyboard toggle or Pause */}
          {!isLongPressRecording && (
            <View className="flex justify-center px-7">
              <PulsingButton
                onPress={shouldShowRecordingUI ? () => handleStopRecording(false) : toggleInputMode}
              icon={
                shouldShowRecordingUI ? (
                  <Icon name="pause" color={colorScheme === 'dark' ? "#fff" : "#3A3A3C"} />
                ) : (
                  <Icon 
                    name="keyboard"
                    size={getIconSize(18)}
                    color={colorScheme === 'dark' ? "#fff" : "#00488F"}
                  />
                )
              }
              isPulsing={false}
              disabled={isWaitingForResponse || isTranscribing || isStoppingRecording}
              canLongPress={false}
              style={{ 
                padding: 12,
                backgroundColor: colorScheme === 'dark' ? 'rgba(55, 65, 81, 1)' : 'rgba(55, 65, 81, 0.03)',
                borderRadius: 50,
                borderWidth: 1,
                borderColor: colorScheme === 'dark' ? 'rgba(120, 155, 255, 0.2)' : 'rgba(0, 72, 143, 0.1)',
              }}
            />
            </View>
          )}
        </View>
        
        {/* Status text or Recording duration - same position for both states */}
        <View 
          className="mb-3 px-3 py-1 rounded-full"
         
        >
          {/* Debug log */}
          {isStoppingRecording && showTranscriptionTimeout ? (
            <TouchableOpacity onPress={forceStopTranscription}>
              <Text 
                className={`text-xs font-medium`}
                style={[
                  GlobalFontStyleSheet.textSm,
                  {
                    fontWeight: '300',
                    letterSpacing: 0.3,
                    textDecorationLine: 'underline',
                    color: '#0F75E0'
                  }
                ]}
              >
                Still processing... Tap to try again
              </Text>
            </TouchableOpacity>
          ) : (
            <Text 
              className={`text-xs font-medium ${
                colorScheme === 'dark'  ? 'text-blue-200' : 'text-blue-800'
              }`}
              style={[
                GlobalFontStyleSheet.textSm,
                {
                  fontWeight: '300',
                  letterSpacing: 0.3,
                  textShadowColor: 'rgba(0, 0, 0, 0.1)',
                  textShadowOffset: {width: 0, height: 1},
                  textShadowRadius: 2,
                }
              ]}
            >
              {isStoppingRecording 
                ? ""
                : (isRecording || isLongPressRecording)
                  ? formatDuration(recordingDuration)
                  : (transcriptionText || "Tap or hold to record")
              }
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

export default ChatInputBar;

