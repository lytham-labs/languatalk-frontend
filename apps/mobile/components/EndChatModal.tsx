import React, { useRef, useEffect } from 'react';
import { View, Modal, Pressable, Dimensions, ScrollView, Animated, PanResponder, TouchableWithoutFeedback, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/shared/ThemedText';
import { useRouter } from 'expo-router';
import { GlobalFontStyleSheet } from '@/constants/Font';
import BottomUpWindow from '@/components/BottomUpWindow';

interface EndChatModalProps {
  isVisible: boolean;
  onClose: () => void;
  userMessagesCount: number;
  chatId: number;
}

const { height } = Dimensions.get('window');
const MAX_MODAL_HEIGHT = height * 0.9;
const DRAG_THRESHOLD = 50;

const EndChatModal: React.FC<EndChatModalProps> = ({
  isVisible,
  onClose,
  userMessagesCount,
  chatId,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const panY = useRef(new Animated.Value(0)).current;
  const translateY = panY.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0, 0, 1],
  });

  const resetPositionAnim = Animated.timing(panY, {
    toValue: 0,
    duration: 300,
    useNativeDriver: true,
  });

  const closeAnim = Animated.timing(panY, {
    toValue: DRAG_THRESHOLD,
    duration: 300,
    useNativeDriver: true,
  });

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dy > 0) {
        panY.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > DRAG_THRESHOLD) {
        closeAnim.start(onClose);
      } else {
        resetPositionAnim.start();
      }
    },
  })).current;

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  useEffect(() => {
    if (isVisible) {
      resetPositionAnim.start();
    }
  }, [isVisible]);

  const handleGetFeedback = () => {
    triggerHaptic();
    onClose();
    router.push({
      pathname: "/(tabs)/speak/feedback",
      params: { id: chatId },
    });
  };

  const handleEndChat = () => {
    triggerHaptic();
    onClose();
    router.push('/speak');
  };

  const chatPoints = userMessagesCount * 2;

  const isAndroid = Platform.OS === 'android';

  const renderContent = () => (
    <>
      <View className="w-10 h-1 bg-gray-300 rounded self-center my-4" />
      <ScrollView className="px-4 py-2">
        <ThemedText style={GlobalFontStyleSheet.textMd} className="text-base mb-4 text-center">
          You've earned <ThemedText style={GlobalFontStyleSheet.textMd} className="font-bold">{chatPoints} points</ThemedText> in this chat, nice work!
        </ThemedText>
        {userMessagesCount > 5 ? (
          <>
            <ThemedText style={GlobalFontStyleSheet.textMd} className="text-base mb-6 text-center">
              You can end the chat below (feel free to come back to it later). Or you can get feedback on what you've said.
            </ThemedText>
            <Pressable
              onPress={handleGetFeedback}
              className={`mb-6 p-4 rounded-lg ${isDark ? 'bg-blue-700' : 'bg-blue-500'}`}
            >
              <ThemedText
                style={GlobalFontStyleSheet.textMd}
                lightColor="white"
                darkColor="white"
                className="text-center font-bold"
              >
                Get my feedback report
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <ThemedText style={GlobalFontStyleSheet.textMd} className="text-base mb-6 text-center">
            Ready to end the chat? You can always come back to it later. Want a feedback report covering today's chat? You'll see that option here after you've replied at least 6 times.
          </ThemedText>
        )}
        <Pressable
          onPress={handleEndChat}
          className={`mb-6 p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`}
        >
          <ThemedText 
            style={GlobalFontStyleSheet.textMd}
            lightColor="white"
            darkColor="white"
            className="text-center font-bold"
          >
            End chat without feedback
          </ThemedText>
        </Pressable>
      </ScrollView>
    </>
  );

  if (isAndroid) {
    return (
      <BottomUpWindow
        isVisible={isVisible}
        onClose={onClose}
        content={renderContent()}
      />
    );
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 justify-end">
          <Animated.View 
            className={`rounded-t-lg ${isDark ? 'bg-gray-900' : 'bg-white'}`}
            style={[
              { 
                maxHeight: MAX_MODAL_HEIGHT,
                transform: [{ translateY }]
              }
            ]}
            {...panResponder.panHandlers}
          >
            {renderContent()}
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default EndChatModal;
