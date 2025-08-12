import React, { useEffect } from 'react';
import { View, Text, Animated } from 'react-native';

interface NotificationProps {
  message: string;
  type: 'success' | 'error';
  onDismiss: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onDismiss }) => {
  const opacity = new Animated.Value(0);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(3000),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  }, []);

  const backgroundColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';

  return (
    <Animated.View
      className={`absolute top-4 left-4 right-4 p-4 rounded-md ${backgroundColor}`}
      style={{ opacity }}
    >
      <Text className="text-white font-semibold">{message}</Text>
    </Animated.View>
  );
};

export default Notification;
