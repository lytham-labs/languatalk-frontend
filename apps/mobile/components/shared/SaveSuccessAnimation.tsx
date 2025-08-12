import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, ViewStyle, TextStyle } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCircle, faCheck } from '@fortawesome/pro-solid-svg-icons';

interface SaveSuccessAnimationProps {
  text?: string;
  isActive: boolean;
  containerStyle?: ViewStyle;
  textStyle?: TextStyle;
  onAnimationComplete?: () => void;
}

/**
 * A reusable animation component that shows a success animation
 * with a circle transforming into a checkmark and particles
 */
const SaveSuccessAnimation: React.FC<SaveSuccessAnimationProps> = ({
  text = 'Saved!',
  isActive,
  containerStyle,
  textStyle,
  onAnimationComplete
}) => {
  // Animation values
  const circleAnimation = useRef(new Animated.Value(0)).current;
  const particleAnimations = useRef(Array(8).fill(0).map(() => new Animated.Value(0))).current;

  // Play the success animation when isActive changes to true
  useEffect(() => {
    if (isActive) {
      // Reset animations to start state
      circleAnimation.setValue(0);
      particleAnimations.forEach(anim => anim.setValue(0));
      
      // Animate circle to checkmark
      Animated.timing(circleAnimation, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true
      }).start();
      
      // Animate particles with slight delay
      const particleAnimations_promises = particleAnimations.map((anim, index) => {
        return new Promise<void>(resolve => {
          Animated.sequence([
            Animated.delay(100 + (index * 30)), // Stagger the particles
            Animated.timing(anim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true
            })
          ]).start(() => resolve());
        });
      });
      
      // Call onAnimationComplete when all animations finish
      if (onAnimationComplete) {
        Promise.all(particleAnimations_promises).then(() => {
          setTimeout(onAnimationComplete, 300);
        });
      }
    }
  }, [isActive, circleAnimation, particleAnimations, onAnimationComplete]);

  // Render particles for success animation
  const renderParticles = () => {
    return particleAnimations.map((anim, index) => {
      const angle = (index / particleAnimations.length) * Math.PI * 2;
      
      // Calculate end point for particle
      const translateX = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, Math.cos(angle) * 30]
      });
      
      const translateY = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, Math.sin(angle) * 30]
      });
      
      const opacity = anim.interpolate({
        inputRange: [0, 0.7, 1],
        outputRange: [0, 1, 0]
      });
      
      const scale = anim.interpolate({
        inputRange: [0, 0.3, 1],
        outputRange: [0, 1, 0.5]
      });
      
      return (
        <Animated.View
          key={`particle-${index}`}
          style={[
            styles.particle,
            {
              transform: [
                { translateX },
                { translateY },
                { scale }
              ],
              opacity
            }
          ]}
        />
      );
    });
  };

  return (
    <View style={[styles.successContainer, containerStyle]}>
      <Animated.View
        style={[
          styles.successIconContainer,
          {
            transform: [
              {
                scale: circleAnimation.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 1.2, 1]
                })
              }
            ]
          }
        ]}
      >
        {/* Circle transforming to checkmark */}
        <Animated.View
          style={{
            opacity: circleAnimation.interpolate({
              inputRange: [0, 0.5],
              outputRange: [1, 0]
            })
          }}
        >
          <FontAwesomeIcon icon={faCircle} size={14} color="white" />
        </Animated.View>
        
        <Animated.View
          style={[
            styles.checkmarkContainer,
            {
              opacity: circleAnimation.interpolate({
                inputRange: [0.5, 1],
                outputRange: [0, 1]
              })
            }
          ]}
        >
          <FontAwesomeIcon icon={faCheck} size={14} color="white" />
        </Animated.View>
        
        {/* Render particles */}
        {renderParticles()}
      </Animated.View>
      
      {text && (
        <Text style={[styles.text, textStyle]}>
          {text}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  successIconContainer: {
    position: 'relative',
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkContainer: {
    position: 'absolute',
  },
  particle: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'white',
  },
  text: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  }
});

export default SaveSuccessAnimation; 
