import React, { useRef, useEffect } from "react";
import {
  View,
  Modal,
  Animated,
  PanResponder,
  TouchableWithoutFeedback,
  ScrollView,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import useDevice from '@/hooks/useDevice';
import cx from 'classnames';

interface SlidingModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  isClosing?: boolean;
  isFull?: boolean;
  bgColor?: string;
  showCloseButton?: boolean;
}

export default function SlidingModal({
  visible,
  onClose,
  children,
  isClosing,
  isFull = false,
  bgColor = 'bg-white dark:bg-gray-800',
  showCloseButton = true,
}: SlidingModalProps) {
  const { height: SCREEN_HEIGHT } = Dimensions.get("window");
  const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const { isTablet } = useDevice();

  useEffect(() => {
    if (visible && !isClosing) {
      Animated.spring(panY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
        speed: 14,
      }).start();
    } else if (isClosing) {
      Animated.spring(panY, {
        toValue: SCREEN_HEIGHT,
        useNativeDriver: true,
        bounciness: 0,
        speed: 14,
      }).start();
    }
  }, [visible, isClosing]);

  const resetPositionAnim = Animated.spring(panY, {
    toValue: 0,
    useNativeDriver: true,
    bounciness: 0,
    speed: 14,
  });

  const closeAnim = Animated.timing(panY, {
    toValue: SCREEN_HEIGHT,
    duration: 250,
    useNativeDriver: true,
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isFull,
      onMoveShouldSetPanResponder: () => !isFull,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 50) {
          closeAnim.start(() => onClose());
        } else {
          resetPositionAnim.start();
        }
      },
    })
  ).current;

  const handleClose = () => {
    closeAnim.start(() => onClose());
  };

  if (!visible) return null;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 bg-black/50">
          {!isFull && (
            <TouchableWithoutFeedback onPress={handleClose}>
              <View className="flex-1" />
            </TouchableWithoutFeedback>
          )}

          <Animated.View
            className={`absolute ${isFull ? 'top-0' : 'bottom-0'} left-0 right-0 ${bgColor} 
              ${isFull ? '' : 'rounded-t-3xl'}
              ${isTablet ? 'px-16' : ''}
              `}
            style={{
              transform: [{ translateY: panY }],
              maxHeight: isFull ? '100%' : '90%',
              height: isFull ? '100%' : 'auto',
            }}
          >
            {!isFull && (
              <View {...panResponder.panHandlers} className="w-full">
                <View className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mt-4" />
              </View>
            )}
            
            { showCloseButton && (
              <TouchableOpacity 
                onPress={handleClose}
                className={cx("absolute top-4 right-4 z-10", 
                {
                  'top-[3.5rem] right-6 ': isFull,
                  'top-4 right-4': !isFull
                })}
              >
                <FontAwesomeIcon 
                  icon={faXmark} 
                  size={24}
                  color="#6B7280"
                />
              </TouchableOpacity>
            )}

            <ScrollView 
              className={`${isFull ? 'px-6 pt-12' : 'px-6'} pb-10`}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
