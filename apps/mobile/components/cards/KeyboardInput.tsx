import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Text,
  Animated,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faKeyboard, faCheck, faXmark, faArrowLeft, faArrowUp } from '@fortawesome/pro-solid-svg-icons';
import { colorScheme } from "nativewind";
import { GlobalFontStyleSheet } from "@/constants/Font";
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import BouncingDots from "@/components/BouncingDots";

interface KeyboardInputProps {
  onSubmit: (text: string, isAudio: boolean) => void;
  wordToGuess: string;
  onKeyboardShow?: () => void;
  onKeyboardHide?: () => void;
}

const KeyboardInput: React.FC<KeyboardInputProps> = ({ 
  onSubmit, 
  wordToGuess,
  onKeyboardShow,
  onKeyboardHide,
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [inputText, setInputText] = useState('');
  const isDark = colorScheme.get() === 'dark';
  const scaleAnim = new Animated.Value(1); 
  const [isLoading, setIsLoading] = useState(false);

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleSubmit = () => {
    if (inputText.trim()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSubmit(inputText.trim(), false);
      setInputText('');
      onKeyboardHide?.();
      setIsLoading(true);
    }
    setIsModalVisible(false);
  };

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => onKeyboardShow?.()
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => onKeyboardHide?.()
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  return (
    <>
      {isLoading && <BouncingDots />}
      {!isLoading && (
      <TouchableOpacity
        onPress={() => {
          setIsModalVisible(true);
          onKeyboardShow?.();
        }}
        style={styles.keyboardButton}
      >
        <FontAwesomeIcon
          icon={faKeyboard}
          size={28}
          color={isDark ? '#ffffff' : '#00448F'}
        />
      </TouchableOpacity>
      )}

      <Modal
        visible={isModalVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => {
          setIsModalVisible(false);
          onKeyboardHide?.();
        }}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setIsModalVisible(false);
            onKeyboardHide?.();
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <TouchableWithoutFeedback>
              <View style={[
                styles.modalContent,
              ]}>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[
                      GlobalFontStyleSheet.textXl,
                      styles.input,
                      { 
                        color: isDark ? '#ffffff' : '#000000',
                        backgroundColor: isDark ? '#393E42' : '#fff',
                      }
                    ]}
                    placeholder="Type your answer..."
                    placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                    value={inputText}
                    onChangeText={setInputText}
                    autoFocus
                    multiline
                    numberOfLines={2}
                  />
                  
                  <TouchableOpacity
                    style={[
                      styles.submitCircle,
                      { opacity: inputText.trim() ? 1 : 0.5 }
                    ]}
                    onPress={handleSubmit}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={!inputText.trim()}
                  >
                    <FontAwesomeIcon 
                      icon={faArrowUp} 
                      size={18} 
                      color="#ffffff"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  keyboardButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  modalOverlay: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  inputContainer: {
    position: 'relative',
    width: '100%',
  },
  input: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 12,
    paddingRight: 50,
    minHeight: 50,
    maxHeight: 80,
    borderBottomWidth: 0.5,
  },
  submitCircle: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -15 }],
    backgroundColor: '#F87171',
    width: 30,
    height: 30,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default KeyboardInput; 