import React, { useRef, useEffect } from 'react';
import { Pressable, Animated, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

interface PulsingButtonProps {
  onPress: () => void;
  onLongPress?: () => void;
  onPressOut?: () => void;
  icon: React.ReactNode;
  isPulsing: boolean;
  style?: ViewStyle;
  disabled?: boolean;
  delayLongPress?: number;
  canLongPress?: boolean;
}

const PulsingButton: React.FC<PulsingButtonProps> = ({
  onPress,
  onLongPress,
  onPressOut,
  icon,
  isPulsing,
  style,
  disabled = false,
  delayLongPress = 500,
  canLongPress = false
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isPulsing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isPulsing]);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePress = () => {
    triggerHaptic();
    onPress();
  };

  const handleLongPress = () => {
    if (onLongPress) {
      triggerHaptic();
      onLongPress();
    }
  };

  const handlePressOut = () => {
    if (onPressOut) {
      onPressOut();
    }
  };

  if (disabled) {
    return (
      <Pressable style={[style, { opacity: 0.5 }]}>
        {icon}
      </Pressable>
    );
  }

  return (
    <Animated.View style={[style, { transform: [{ scale: pulseAnim }] }]}>
      <Pressable 
        onPress={handlePress}
        onLongPress={canLongPress && onLongPress ? handleLongPress : undefined}
        onPressOut={canLongPress && onPressOut ? handlePressOut : undefined}
        delayLongPress={delayLongPress}
        hitSlop={20}
      >
        {icon}
      </Pressable>
    </Animated.View>
  );
};

export default PulsingButton;
