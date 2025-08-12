import React from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colorScheme } from "nativewind";

interface BouncingDotProps {
  delay: number;
  size?: number;
  color?: string;
}

const BouncingDot: React.FC<BouncingDotProps> = ({ delay, size = 8, color }) => {
  const bounceAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 600,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [bounceAnim, delay]);

  const dotStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color || (colorScheme.get() === 'dark' ? '#ffffff' : '#00448F'),
    marginHorizontal: size / 3,
    transform: [{
      translateY: bounceAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -(size * 2)],
      }),
    }],
  };

  return <Animated.View style={dotStyle} />;
};

interface BouncingDotsProps {
  size?: number;
  color?: string;
}

const BouncingDots: React.FC<BouncingDotsProps> = ({ size = 8, color }) => {
  return (
    <View style={styles.container}>
      <BouncingDot delay={0} size={size} color={color} />
      <BouncingDot delay={200} size={size} color={color} />
      <BouncingDot delay={400} size={size} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
});

export default BouncingDots; 