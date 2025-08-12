import React from 'react';
import { View, Animated, Image, Text, TouchableOpacity, Easing } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import useDevice from '@/hooks/useDevice';
import cx from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faArrowRotateRight, faClockRotateLeft, faWifi, faCircleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons';

interface AnimatedDotProps {
  delay: number;
}

const AnimatedDot: React.FC<AnimatedDotProps> = ({ delay }) => {
  const opacity = React.useState(new Animated.Value(0))[0];
  const scale = React.useState(new Animated.Value(0.8))[0];
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 600,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 600,
            delay,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.8,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, [opacity, scale, delay]);

  return (
    <Animated.View
      style={[
        {
          width: 6,
          height: 6,
          borderRadius: 3,
          marginHorizontal: 3,
          opacity,
          transform: [{ scale }],
          backgroundColor: isDark ? '#9CA3AF' : '#6B7280',
        },
      ]}
    />
  );
};

// Pulse animation component
interface PulseCircleProps {
  color: string;
  size: number;
  delay?: number;
}

const PulseCircle: React.FC<PulseCircleProps> = ({ color, size, delay = 0 }) => {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim, delay]);
  
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: 0.3,
        transform: [{ scale: pulseAnim }],
      }}
    />
  );
};

interface LoadingDotsProps {
  avatarUrl?: string;
  showTimeout?: boolean;
  showIntermediateTimeout?: boolean;
  onRefresh?: () => void;
  newMessageArrived?: boolean;
  isRefreshing?: boolean;
  onDismiss?: () => void;
}

const LoadingDots: React.FC<LoadingDotsProps> = ({ 
  avatarUrl, 
  showTimeout = false, 
  showIntermediateTimeout = false,
  onRefresh,
  newMessageArrived = false,
  isRefreshing = false,
  onDismiss
}) => {
  const { isTablet } = useDevice();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Animation for the timeout card
  const cardOpacity = React.useRef(new Animated.Value(0)).current;
  const cardTranslateY = React.useRef(new Animated.Value(10)).current;
  
  // Animation for the refresh icon rotation
  const refreshRotation = React.useRef(new Animated.Value(0)).current;
  const [refreshPressed, setRefreshPressed] = React.useState(false);
  
  // Create interpolated rotation value with smoother transition
  const spin = refreshRotation.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ['0deg', '90deg', '180deg', '270deg', '360deg'],
  });
  
  const handleRefresh = () => {
    if (isRefreshing) return;
    
    setRefreshPressed(true);
    console.log('[TIMEOUT] Refresh button pressed in LoadingDots');
    
    // Reset rotation value to start fresh
    refreshRotation.setValue(0);
    
    // Custom animation with easing to create a slow-then-fast effect
    Animated.timing(refreshRotation, {
      toValue: 1,
      duration: 1200,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1.0), // Custom cubic-bezier curve for smooth acceleration
      useNativeDriver: true,
    }).start(() => {
      if (onRefresh) onRefresh();
      
      // Continue showing refreshing state for a few seconds after button press
      setTimeout(() => {
        setRefreshPressed(false);
      }, 3000);
    });
  };
  
  React.useEffect(() => {
    if (showTimeout || showIntermediateTimeout) {
      console.log('[TIMEOUT] LoadingDots rendering with timeout UI');
      
      // Animate the card in
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animations when not showing timeout
      cardOpacity.setValue(0);
      cardTranslateY.setValue(10);
    }
  }, [showTimeout, showIntermediateTimeout, cardOpacity, cardTranslateY]);

  React.useEffect(() => {
    if (newMessageArrived) {
      console.log('[TIMEOUT] New message arrived, hiding timeout UI');
      cardOpacity.setValue(0);
      cardTranslateY.setValue(10);
    }
  }, [newMessageArrived, cardOpacity, cardTranslateY]);

  return (
    <View className={`mb-4 ${isTablet ? 'ml-[54px]' : 'ml-2'}`}>
      <View className="flex-row items-start">
        {/* AI Avatar - Keep at the top */}
        <View>
          <Image
            source={{ uri: avatarUrl }}
            className={`${isTablet ? 'w-16 h-16' : 'w-10 h-10'} rounded-full`}
          />
        </View>
        
        {!showTimeout && !showIntermediateTimeout && (
          /* Normal loading dots chat bubble */
          <View 
            className={cx(
              "ml-2 px-4 py-3 rounded-2xl",
              isDark ? 'bg-gray-700' : 'bg-white'
            )}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
              alignSelf: 'flex-start',
              marginTop: 2
            }}
          >
            <View className="flex-row items-center h-6">
              <AnimatedDot delay={0} />
              <AnimatedDot delay={150} />
              <AnimatedDot delay={300} />
            </View>
          </View>
        )}
        
        {showIntermediateTimeout && (
          <View className="flex-row items-center justify-center gap-3">

          <View 
              className={cx(
                "ml-2 px-4 py-3 rounded-2xl flex-row",
                isDark ? 'bg-gray-700' : 'bg-white'
              )}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
                alignSelf: 'flex-start',
                marginTop: 2
              }}
            >
              <View className="flex-row items-center h-6">
                <AnimatedDot delay={0} />
                <AnimatedDot delay={150} />
                <AnimatedDot delay={300} />
              </View>
              
            </View>
            <Text className={cx(
                "flex-row",
                isDark ? 'text-orange-300' : 'text-orange-500'
              )}>
                Sorry, I'm thinking for longer than usual...
              </Text>
          </View>
        )}
      </View>
      
      {showTimeout && !newMessageArrived && (
        <Animated.View 
          className={`mt-2 max-w-[95%] justify-center items-center`}
          style={{
            opacity: cardOpacity,
            transform: [{ translateY: cardTranslateY }],
            alignSelf: 'center',
            width: '100%'
          }}
        >
          {/* Status Card Design */}
          <View 
            className={cx(
              "rounded-2xl overflow-hidden w-[95%]",
              isDark ? "bg-gray-800" : "bg-white"
            )}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 3,
              elevation: 2,
            }}
          >
            {/* Main content */}
            <View className="p-4 border-x-2 border-[#F87171] relative">
              {console.log('[TIMEOUT UI] onDismiss provided:', !!onDismiss)}
              {/* Close/Dismiss button in top right - only for timeout UI */}
              {onDismiss && (
                <TouchableOpacity 
                  className="absolute top-3 right-3 z-10"
                  onPress={onDismiss}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <FontAwesomeIcon 
                    icon={faXmark} 
                    color="#0F75E0" 
                    size={16} 
                  />
                </TouchableOpacity>
              )}
              
              {/* Refresh button in bottom right */}
              <TouchableOpacity 
                className="absolute bottom-6 right-3 z-10"
                onPress={handleRefresh}
                disabled={isRefreshing}
              >
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <FontAwesomeIcon 
                    icon={faArrowRotateRight} 
                    color="#0F75E0" 
                    size={16} 
                  />
                </Animated.View>
              </TouchableOpacity>
              
              <Text 
                className={cx(
                  "text-sm mb-3",
                  isDark ? "text-gray-100" : "text-gray-800"
                )}
                style={{ 
                  fontWeight: '500', 
                  lineHeight: 20,
                  paddingRight: onDismiss ? 32 : 16  // Extra padding when close button is present
                }}
              >
                {isRefreshing 
                  ? "Fetching latest messages..." 
                  : refreshPressed 
                    ? "Continuing to look for a response..." 
                    : "AI model is taking longer than normal."
                }{" "}
                <Text 
                  onPress={handleRefresh}
                  style={{ textDecorationLine: 'underline', color: '#0F75E0' }}
                >
                  {isRefreshing ? "Refreshing..." : refreshPressed ? "Refresh again" : "Try refreshing"}
                </Text>
              </Text>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

export default LoadingDots; 

/* Could be useful
const LoadingDots = memo(() => {
  return (
    <View style={styles.loadingDotsContainer}>
      <AnimatedDots />
    </View>
  );
});

// Constants for VAD-like detection
const POSITIVE_SPEECH_THRESHOLD = -45; // Above this is definitely speech
const NEGATIVE_SPEECH_THRESHOLD = -50; // Below this is definitely silence
const REDEMPTION_FRAMES = 50; // Number of silent frames before stopping (6s at 100ms intervals)
const MIN_SPEECH_FRAMES = 10; // Minimum frames of speech to consider valid for auto-stop
const MIN_MANUAL_SPEECH_FRAMES = 3; // Minimum frames of speech for manual stop
const MONITORING_INTERVAL = 100; // Check every 100ms

// State tracking variables
let recordingInstance: Audio.Recording | null = null;
let monitoringInterval: NodeJS.Timeout | null = null;
let isSpeaking = false;
let silentFrameCount = 0;
let speechFrameCount = 0;
*/
