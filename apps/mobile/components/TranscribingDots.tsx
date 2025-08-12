import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';

const TranscribingDots = () => {
  const dots = [useRef(new Animated.Value(0)).current, 
                useRef(new Animated.Value(0)).current, 
                useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) => {
      return Animated.sequence([
        Animated.delay(i * 200),
        Animated.loop(
          Animated.sequence([
            Animated.timing(dot, {
              toValue: 1,
              duration: 400,
              easing: Easing.ease,
              useNativeDriver: true,
            }),
            Animated.timing(dot, {
              toValue: 0,
              duration: 400,
              easing: Easing.ease,
              useNativeDriver: true,
            }),
          ])
        ),
      ]);
    });

    Animated.parallel(animations).start();

    return () => {
      animations.forEach(anim => anim.stop());
    };
  }, []);

  return (
    <View className="flex-row items-center h-6">
      {dots.map((dot, index) => (
        <Animated.View
          key={index}
          className="w-2 h-2 mx-1 rounded-full bg-[#00448F] dark:bg-white"
          style={{
            opacity: dot,
            transform: [{
              scale: dot.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 1],
              }),
            }],
          }}
        />
      ))}
    </View>
  );
};

export default TranscribingDots; 