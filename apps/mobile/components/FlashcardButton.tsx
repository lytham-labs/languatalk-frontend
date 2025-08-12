import React, { useState, useEffect, useRef } from "react";
import { TouchableOpacity, StyleSheet, Animated, Easing } from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";
import { FlashcardData } from "@/services/FlashcardService";

interface FlashcardButtonProps {
  onPress: () => Promise<void>;
  style?: object;
  type: "add" | "play" | "flag";
  isActive?: boolean;
  isLoading?: boolean;
  isPulsing?: boolean;
  flashcardData: FlashcardData;
  flashcardType: "word" | "sentence";
}

const FlashcardButton: React.FC<FlashcardButtonProps> = ({
  onPress,
  style,
  type,
  isActive,
  isLoading,
  isPulsing = false,
  flashcardData,
  flashcardType,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const scaleAnim = new Animated.Value(1);
  const rotateAnim = new Animated.Value(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isPulsing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isPulsing]);

  useEffect(() => {
    if (type === "add" && isActive) {
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }).start();
    }
  }, [isActive]);

  const handlePress = async () => {
    if (isPressed) return;

    setIsPressed(true);
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 100,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
    ]).start(async () => {
      await onPress();
      setIsPressed(false);
    });
  };

  const getIconName = () => {
    switch (type) {
      case "add":
        return isActive ? "check" : "plus";
      case "play":
        return isLoading ? "spinner" : "volume-high";
      case "flag":
        return isActive ? "check" : "flag";
    }
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={handlePress}
      disabled={isPressed || isLoading}
    >
      <Animated.View
        style={{
          transform: [
            { scale: Animated.multiply(scaleAnim, pulseAnim) },
            { rotate: type === "add" ? rotate : "0deg" },
          ],
        }}
      >
        <FontAwesome6 name={getIconName()} size={20} color="#fff" />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 5,
    backgroundColor: "#007bff",
  },
});

export default FlashcardButton;
