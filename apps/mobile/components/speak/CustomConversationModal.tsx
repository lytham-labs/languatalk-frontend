import React, { useState, useRef } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ScrollView, useWindowDimensions, Platform, KeyboardAvoidingView } from 'react-native';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { useColorScheme } from '@/hooks/useColorScheme';
import cx from 'classnames';
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInDown, 
  SlideOutDown,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';

interface CustomConversationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (title: string, prompt: string) => void;
}

export default function CustomConversationModal({ 
  visible, 
  onClose, 
  onConfirm 
}: CustomConversationModalProps) {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [showTips, setShowTips] = useState(false);
  
  // Text input height management
  const LINE_HEIGHT = 20; // Approximate height of a line of text
  const MIN_LINES = 4;
  const MAX_LINES = 7;
  const MIN_HEIGHT = LINE_HEIGHT * MIN_LINES;
  const MAX_HEIGHT = LINE_HEIGHT * MAX_LINES;
  const [textInputHeight, setTextInputHeight] = useState(MIN_HEIGHT);
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const modalHeight = useSharedValue(90);
  const { width } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);

  const getInputHeight = () => {
    if (width >= 440) { 
      return 500;
    } else if (width >= 400) { 
      return 450;
    } else if (width >= 350) {
      return 250;
    } else { 
      return 200;
    }
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      height: withSpring(`${modalHeight.value}%`, {
        damping: 15,
        stiffness: 100,
      }),
    };
  });

  const handleTipsToggle = () => {
    setShowTips(!showTips);
  };

  const handleConfirm = () => {
    if (title.trim() && prompt.trim()) {
      onConfirm(title.trim(), prompt.trim());
      onClose();
    }
  };

  // Function to handle content size changes for auto-growing text input
  const handleContentSizeChange = (event: any) => {
    const { height } = event.nativeEvent.contentSize;
    // Ensure the height stays between min and max values
    const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height));
    setTextInputHeight(newHeight);
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={onClose}
    >
      <Animated.View 
        entering={FadeIn.duration(100)}
        exiting={FadeOut.duration(200)}
        className="flex-1 justify-center items-center bg-black/30"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ width: '90%', maxHeight: '95%' }}
        >
          <Animated.View
            entering={SlideInDown.duration(50).springify().damping(80)}
            exiting={SlideOutDown.duration(200)}
            style={[animatedStyle]}
            className={cx(
              "rounded-2xl p-6 shadow-lg",
              isDark ? "bg-gray-800" : "bg-white"
            )}
          >
            <ScrollView 
              className="flex-1"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              <View className="flex-row justify-between items-start mb-4">
                <View>
                  <Text style={[GlobalFontStyleSheet.textXl]} className={cx(
                    "font-semibold",
                    isDark ? "text-white" : "text-gray-900"
                  )}>
                    Enter your custom prompt
                  </Text>
                  <TouchableOpacity 
                    onPress={handleTipsToggle}
                    className="mt-2"
                  >
                    <Text style={GlobalFontStyleSheet.textSm} className={cx(
                      "font-medium",
                      isDark ? "text-blue-400" : "text-blue-600"
                    )}>
                      (i) See how it works & tips
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {showTips && (
                <Animated.View 
                  entering={FadeIn.duration(200)}
                  exiting={FadeOut.duration(200)}
                  className="mb-4 p-4 rounded-xl bg-gray-100 dark:bg-gray-700"
                >
                  <Text style={GlobalFontStyleSheet.textBase} className={cx(
                    "mb-2",
                    isDark ? "text-gray-300" : "text-gray-600"
                  )}>
                    In every chat on Langua, the AI is given detailed instructions on how to behave. If you can't find a chat that does what you're looking for, you can create your own instructions here.
                  </Text>
                  <Text style={GlobalFontStyleSheet.textBase} className={cx(
                    "mb-2",
                    isDark ? "text-gray-300" : "text-gray-600"
                  )}>
                    We will only include your name, level and target language at the start, then it's down to you!
                  </Text>
                  <Text style={GlobalFontStyleSheet.textBase} className={cx(
                    isDark ? "text-gray-300" : "text-gray-600"
                  )}>
                    Write to the AI directly, being as specific as possible - as well as telling it what you want it to do, you might also state what it must NOT do, and provide an example or two of how it should respond.
                  </Text>
                </Animated.View>
              )}
              
              <View className="mb-4">
                <TextInput
                  ref={inputRef}
                  value={prompt}
                  onChangeText={setPrompt}
                  placeholder="Type here..."
                  placeholderTextColor={isDark ? "#9ca3af" : "#6b7280"}
                  multiline
                  numberOfLines={MIN_LINES}
                  maxLength={20000}
                  onContentSizeChange={handleContentSizeChange}
                  className={cx(
                    "p-3 rounded-xl text-base",
                    isDark ? "bg-gray-700 text-white" : "bg-gray-50 text-gray-900"
                  )}
                  style={[
                    GlobalFontStyleSheet.textBase,
                    { height: textInputHeight, maxHeight: MAX_HEIGHT }
                  ]}
                  textAlignVertical="top"
                />
                <Text style={GlobalFontStyleSheet.textSm} className={cx(
                  "text-right mt-1",
                  isDark ? "text-gray-400" : "text-gray-500"
                )}>
                  {prompt.length}/20000 characters
                </Text>
              </View>

              <View className="mb-4">
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Label your prompt"
                  placeholderTextColor={isDark ? "#9ca3af" : "#6b7280"}
                  maxLength={50}
                  className={cx(
                    "p-3 rounded-xl text-base",
                    isDark ? "bg-gray-700 text-white" : "bg-gray-50 text-gray-900"
                  )}
                  style={[GlobalFontStyleSheet.textBase]}
                />
                <Text style={GlobalFontStyleSheet.textSm} className={cx(
                  "text-right mt-1",
                  isDark ? "text-gray-400" : "text-gray-500"
                )}>
                  {title.length}/50 characters
                </Text>
              </View>

              <View className="flex-row justify-between mt-4 gap-2">
                <TouchableOpacity
                  onPress={onClose}
                  className={cx(
                    "flex-1 py-3.5 rounded-xl items-center",
                    isDark ? "bg-white/10" : "bg-gray-500/90"
                  )}
                >
                  <Text style={GlobalFontStyleSheet.textBase} className="text-white font-semibold">
                    Go back
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirm}
                  disabled={!title.trim() || !prompt.trim()}
                  className={cx(
                    "flex-1 py-3.5 rounded-xl items-center",
                    (!title.trim() || !prompt.trim())
                      ? (isDark ? "bg-white/5" : "bg-[#FC5D5D]/50")
                      : "bg-[#FC5D5D]/85"
                  )}
                >
                  <Text style={GlobalFontStyleSheet.textBase} className={cx(
                    "font-semibold",
                    (!title.trim() || !prompt.trim())
                      ? (isDark ? "text-gray-500" : "text-white")
                      : "text-white"
                  )}>
                    Start chat
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
} 
