import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated } from 'react-native';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { GlobalFontStyleSheet } from '@/constants/Font';
import * as Haptics from 'expo-haptics';

interface CallModeTimeoutModalProps {
  isVisible: boolean;
  onStayInCall: () => void;
  onEndCall: () => void;
  countdownSeconds: number;
}

interface CallModeLimitWarningModalProps {
  isVisible: boolean;
  onContinueCall: () => void;
  onEndCall: () => void;
  remainingMinutes: number;
  countdownSeconds: number;
}

const CallModeTimeoutModal: React.FC<CallModeTimeoutModalProps> = ({
  isVisible,
  onStayInCall,
  onEndCall,
  countdownSeconds
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (isVisible) {
      // Trigger haptic feedback when modal appears
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Animate modal in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animations when modal closes
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [isVisible, fadeAnim, scaleAnim]);

  const handleStayInCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onStayInCall();
  };

  const handleEndCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEndCall();
  };

  if (!isVisible) return null;

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={isVisible}
      onRequestClose={onEndCall}
    >
      <Animated.View 
        style={[
          {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 20,
          },
          { opacity: fadeAnim }
        ]}
      >
        <Animated.View
          style={[
            {
              backgroundColor: colors.background,
              borderRadius: 20,
              padding: 24,
              width: '100%',
              maxWidth: 320,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 4,
              },
              shadowOpacity: 0.25,
              shadowRadius: 12,
              elevation: 8,
            },
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          {/* Title */}
          <Text 
            style={[
              GlobalFontStyleSheet.textXl, 
              { 
                color: colors.text,
                fontWeight: '600',
                marginBottom: 12,
                textAlign: 'center'
              }
            ]}
          >
            Are you still there?
          </Text>
          

          {/* Message */}
          <Text 
            style={[
              GlobalFontStyleSheet.textBase,
              { 
                color: colors.text,
                textAlign: 'center',
                marginBottom: 24,
                opacity: 0.8
              }
            ]}
          >
            The call will end automatically in {countdownSeconds} seconds if no action is taken.
          </Text>

          {/* Buttons */}
          <View style={{ 
            flexDirection: 'row', 
            gap: 12,
            width: '100%'
          }}>

            {/* Stay in Call Button */}
            <TouchableOpacity
              onPress={handleStayInCall}
              style={{
                flex: 1,
                backgroundColor: colors.tint,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text 
                style={[
                  GlobalFontStyleSheet.textBase,
                  { 
                    color: 'white',
                    fontWeight: '600'
                  }
                ]}
              >
                Yes, I'm here
              </Text>
            </TouchableOpacity>

            {/* End Call Button */}
            <TouchableOpacity
              onPress={handleEndCall}
              style={{
                flex: 1,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text 
                style={[
                  GlobalFontStyleSheet.textBase,
                  { 
                    color: Colors.primary.DEFAULT,
                    fontWeight: '600'
                  }
                ]}
              >
                End Call
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export const CallModeLimitWarningModal: React.FC<CallModeLimitWarningModalProps> = ({
  isVisible,
  onContinueCall,
  onEndCall,
  remainingMinutes,
  countdownSeconds
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (isVisible) {
      // Trigger haptic feedback when modal appears
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Animate modal in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animations when modal closes
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [isVisible, fadeAnim, scaleAnim]);

  const handleContinueCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onContinueCall();
  };

  const handleEndCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEndCall();
  };

  if (!isVisible) return null;

  const formatCountdown = (seconds: number) => {
    if (seconds <= 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={isVisible}
      onRequestClose={onEndCall}
    >
      <Animated.View 
        style={[
          {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 20,
          },
          { opacity: fadeAnim }
        ]}
      >
        <Animated.View
          style={[
            {
              backgroundColor: colors.background,
              borderRadius: 20,
              padding: 24,
              width: '100%',
              maxWidth: 320,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 4,
              },
              shadowOpacity: 0.25,
              shadowRadius: 12,
              elevation: 8,
            },
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          {/* Title */}
          <Text 
            style={[
              GlobalFontStyleSheet.textXl, 
              { 
                color: colors.text,
                fontWeight: '600',
                marginBottom: 12,
                textAlign: 'center'
              }
            ]}
          >
            Time's almost up!
          </Text>
          

          {/* Message with Countdown */}
          <Text 
            style={[
              GlobalFontStyleSheet.textBase,
              { 
                color: colors.text,
                textAlign: 'center',
                marginBottom: 8,
                opacity: 0.8
              }
            ]}
          >
            You will reach your daily call limit in:
          </Text>

          {/* Countdown Display */}
          <Text 
            style={[
              GlobalFontStyleSheet.textBase,
              { 
                color: colors.tint,
                fontWeight: '700',
                marginBottom: 24,
                textAlign: 'center'
              }
            ]}
          >
            {formatCountdown(countdownSeconds)}
          </Text>

          {/* Buttons */}
          <View style={{ 
            flexDirection: 'row', 
            gap: 12,
            width: '100%'
          }}>

            {/* Continue Call Button */}
            <TouchableOpacity
              onPress={handleContinueCall}
              style={{
                flex: 1,
                backgroundColor: colors.tint,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text 
                style={[
                  GlobalFontStyleSheet.textBase,
                  { 
                    color: 'white',
                    fontWeight: '600'
                  }
                ]}
              >
                Continue Call
              </Text>
            </TouchableOpacity>

            {/* End Call Button */}
            <TouchableOpacity
              onPress={handleEndCall}
              style={{
                flex: 1,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text 
                style={[
                  GlobalFontStyleSheet.textBase,
                  { 
                    color: Colors.primary.DEFAULT,
                    fontWeight: '600'
                  }
                ]}
              >
                End Call
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default CallModeTimeoutModal; 
