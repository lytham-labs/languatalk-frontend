import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, ColorValue, ViewStyle, Easing } from 'react-native';
import { AgentState, TrackReferenceOrPlaceholder } from '@livekit/components-react';

export interface AvatarVisualizerProps {
  /** If set, the visualizer will transition between different voice assistant states */
  state?: AgentState;
  /** The URL of the avatar image to display */
  avatarUrl?: string;
  /** Track reference (kept for compatibility with BarVisualizer) */
  trackRef?: TrackReferenceOrPlaceholder;
  /** Custom React Native styles for the container */
  style?: ViewStyle;
  /** Border color for the pulsing effect */
  borderColor?: ColorValue;
  /** Size of the avatar (width and height) */
  size?: number;
  /** Maximum border width during animation */
  maxBorderWidth?: number;
  /** Whether the call is muted */
  isMuted?: boolean;
}

/**
 * Displays an avatar image with animated border based on the AgentState
 */
export const AvatarVisualizer: React.FC<AvatarVisualizerProps> = ({
  style,
  state = 'disconnected',
  avatarUrl,
  borderColor = '#007AFF',
  size = 200,
  maxBorderWidth = 10,
  isMuted = false,
}) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Set up animations based on state
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    // If muted, don't animate
    if (isMuted) {
      pulseAnim.setValue(0);
      return;
    }

    switch (state) {
      case 'listening':
        console.log('listening');
        // Breathing-like pulsing animation for listening state
        // Mimics attentive, calm listening with natural breathing rhythm
        animation = Animated.loop(
          Animated.sequence([
            // Slow inhale (gradual expansion)
            Animated.timing(pulseAnim, {
              toValue: 0.8,
              duration: 2000, // 2 seconds to expand
              useNativeDriver: false,
              easing: Easing.bezier(0.4, 0.0, 0.2, 1), // Ease in-out cubic approximation
            }),
            // Slow exhale (gradual contraction)
            Animated.timing(pulseAnim, {
              toValue: 0.2,
              duration: 2000, // 2 seconds to contract
              useNativeDriver: false,
              easing: Easing.bezier(0.4, 0.0, 0.2, 1), // Ease in-out cubic approximation
            }),
          ])
        );
        break;
      
      case 'speaking':
        console.log('speaking');
        // More dynamic, speech-like pulsing for speaking state
        // Mimics the cadence and energy of speech
        animation = Animated.loop(
          Animated.sequence([
            // Quick expansion for emphasis
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: false,
              easing: Easing.bezier(0.0, 0.0, 0.2, 1), // Ease out cubic approximation
            }),
            // Hold briefly at peak
            Animated.timing(pulseAnim, {
              toValue: 0.9,
              duration: 100,
              useNativeDriver: false,
              easing: Easing.linear,
            }),
            // Moderate contraction
            Animated.timing(pulseAnim, {
              toValue: 0.4,
              duration: 400,
              useNativeDriver: false,
              easing: Easing.bezier(0.4, 0.0, 0.2, 1), // Ease in-out cubic approximation
            }),
            // Brief pause
            Animated.timing(pulseAnim, {
              toValue: 0.5,
              duration: 200,
              useNativeDriver: false,
              easing: Easing.linear,
            }),
          ])
        );
        break;
      
      case 'thinking':
        console.log('thinking');
        // Asymmetrical, processing-like animation for thinking state
        // Mimics cognitive processing with irregular pattern
        animation = Animated.loop(
          Animated.sequence([
            // Gradual expansion (considering)
            Animated.timing(pulseAnim, {
              toValue: 0.7,
              duration: 1500,
              useNativeDriver: false,
              easing: Easing.bezier(0.4, 0.0, 0.2, 1), // Ease in-out quad approximation
            }),
            // Quick partial contraction (processing)
            Animated.timing(pulseAnim, {
              toValue: 0.4,
              duration: 700,
              useNativeDriver: false,
              easing: Easing.bezier(0.0, 0.0, 0.2, 1), // Ease out cubic approximation
            }),
            // Small expansion (insight)
            Animated.timing(pulseAnim, {
              toValue: 0.6,
              duration: 500,
              useNativeDriver: false,
              easing: Easing.bezier(0.4, 0.0, 1.0, 1.0), // Ease in cubic approximation
            }),
            // Final contraction (conclusion)
            Animated.timing(pulseAnim, {
              toValue: 0.3,
              duration: 800,
              useNativeDriver: false,
              easing: Easing.bezier(0.4, 0.0, 0.2, 1), // Ease in-out quad approximation
            }),
          ])
        );
        break;
      
      case 'connecting' :
        console.log('connecting');
        // Subtle but noticeable pulsing to indicate establishing connection
        animation = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 0.6,
              duration: 800,
              useNativeDriver: false,
              easing: Easing.linear,
            }),
            Animated.timing(pulseAnim, {
              toValue: 0.1,
              duration: 800,
              useNativeDriver: false,
              easing: Easing.linear,
            }),
          ])
        );
        break;
      
      default:
        console.log('default');
        // Minimal animation for disconnected/idle states
        // Subtle presence indicator
        animation = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 0.3,
              duration: 3000,
              useNativeDriver: false,
              easing: Easing.bezier(0.4, 0.0, 0.2, 1), // Ease in-out sine approximation
            }),
            Animated.timing(pulseAnim, {
              toValue: 0.1,
              duration: 3000,
              useNativeDriver: false,
              easing: Easing.bezier(0.4, 0.0, 0.2, 1), // Ease in-out sine approximation
            }),
          ])
        );
        break;
    }

    if (animation) {
      animation.start();
    }

    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [state, pulseAnim, isMuted]);

  // Calculate border width based on animation value
  const borderWidth = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, maxBorderWidth],
  });

  // Placeholder image for when avatarUrl is not available
  const placeholderImage = 'https://via.placeholder.com/200';

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.avatarBorder,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: isMuted ? '#ef4444' : borderColor as string,
            borderWidth: isMuted ? 2 : borderWidth,
          },
        ]}
      >
        <Image
          source={{ uri: avatarUrl || placeholderImage }}
          style={{
            width: size - 20,
            height: size - 20,
            borderRadius: (size - 20) / 2,
          }}
          resizeMode="cover"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBorder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
  },
}); 
