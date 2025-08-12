import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Animated, Pressable, Modal, Dimensions } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faEllipsisVertical } from '@fortawesome/pro-solid-svg-icons';
import { getDeviceType, GlobalFontStyleSheet } from '@/constants/Font';
import { colorScheme } from 'nativewind';

interface DropdownOption {
  label: string;
  onPress: () => void;
  icon?: any;
}

interface DropdownMenuProps {
  options: DropdownOption[];
}

export default function DropdownMenu({ options }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [menuHeight, setMenuHeight] = useState(0);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const buttonRef = useRef<View>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const heightAnim = useRef(new Animated.Value(0)).current;

  const animateDropdown = (open: boolean) => {
    if (open) {
      setIsAnimatingOut(false);
      heightAnim.setValue(0);
      fadeAnim.setValue(0);
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(heightAnim, {
          toValue: 1,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      setIsAnimatingOut(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(heightAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setIsAnimatingOut(false);
          heightAnim.setValue(0);
          fadeAnim.setValue(0);
        }
      });
    }
  };

  const handleClose = () => {
    animateDropdown(false);
    setIsOpen(false);
  };

  useEffect(() => {
    if (isOpen) {
      animateDropdown(true);
    }
  }, [isOpen]);

  const handleToggle = () => {
    if (buttonRef.current) {
      buttonRef.current.measureInWindow((x, y, width, height) => {
        setMenuPosition({
          top: y + height + 4,
          right: 20,
        });
        setIsOpen(true);
      });
    }
  };

  const handleOptionPress = (onPress: () => void) => {
    setIsOpen(false);
    onPress();
  };

  const handleLayout = (event: any) => {
    const { height } = event.nativeEvent.layout;
    setMenuHeight(height);
  };

  const animatedStyle = {
    opacity: fadeAnim,
    transform: [
      {
        translateY: heightAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-20, 0],
        }),
      },
    ],
  };

  return (
    <>
      <View ref={buttonRef}>
        <Pressable
          onPress={handleToggle}
          className="flex-row items-center p-3 px-4 bg-white dark:bg-gray-700 rounded-xl shadow-sm"
        >
          <FontAwesomeIcon
            icon={faEllipsisVertical}
            size={getDeviceType() === "phone" && Dimensions.get('window').width < 400 ? 14 : 18}
            color="#00448F"
          />
          <View className="flex-row items-center">
            <Text
              style={[
                GlobalFontStyleSheet.textSm,
                {
                  marginLeft: 6,
                  fontWeight: "bold",
                  color: colorScheme.get() === "dark" ? "#9ca3af" : "#6b7280",
                },
              ]}
            >
              Actions
            </Text>
          </View>
        </Pressable>
      </View>

      <Modal
        visible={isOpen || isAnimatingOut}
        transparent={true}
        animationType="none"
        onRequestClose={handleClose}
      >
        <Pressable
          className="flex-1"
          onPress={handleClose}
        >
          <View className="flex-1">
            <Animated.View
              onLayout={handleLayout}
              className="absolute bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-[0_4px_40px_-4px_rgba(0,0,0,0.12)] dark:shadow-[0_4px_40px_-4px_rgba(0,0,0,0.24)]"
              style={[
                {
                  top: menuPosition.top,
                  right: menuPosition.right,
                  minWidth: 180,
                },
                animatedStyle
              ]}
            >
              {options.map((option, index) => (
                <Pressable
                  key={index}
                  onPress={() => handleOptionPress(option.onPress)}
                  className={`flex-row items-center px-4 py-4 border-b border-gray-100 dark:border-gray-700 
                    ${index === options.length - 1 ? 'border-b-0' : ''}
                    active:bg-gray-100/10 dark:active:bg-gray-700/10`}
                >
                  {option.icon && (
                    <FontAwesomeIcon
                      icon={option.icon}
                      size={16}
                      color="#00448F"
                      style={{ marginRight: 8 }}
                    />
                  )}
                  <Text
                    style={[
                      GlobalFontStyleSheet.textMd,
                      { color: colorScheme.get() === "dark" ? "#9ca3af" : "#6b7280" }
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </Animated.View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
