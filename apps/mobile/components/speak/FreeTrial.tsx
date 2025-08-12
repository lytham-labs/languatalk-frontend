import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform, Linking } from 'react-native';
import { faSparkles } from '@fortawesome/pro-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { useRouter } from 'expo-router';
import { GlobalFontStyleSheet } from '@/constants/Font';
import SlidingModal from '@/components/shared/SlidingModal';
import { getIconSize } from '@/constants/Font';
import useDevice from '@/hooks/useDevice';
import useUserSubscription from '@/services/api/useUserSubscription';

interface FreeTrialModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const FreeTrialModal: React.FC<FreeTrialModalProps> = ({ isVisible, onClose }) => {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const { isTablet } = useDevice();

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, fadeAnim, scaleAnim]);

  const handleViewPlans = () => {
    onClose();
    router.navigate('/subscription');
  };

  const renderContent = () => (
    <View className="px-4 py-6">
      <Animated.View 
        className="flex-1 space-y-6" 
        style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}
      >
        {/* Header Section */}
        <View className="space-y-4 pb-6">
          <Text style={isTablet ? GlobalFontStyleSheet.textXl : GlobalFontStyleSheet.text2Xl} className="font-bold text-center text-blue-500 dark:text-white pb-6">
            Unlock Full Access - Try Pro For Free{" "}
            <FontAwesomeIcon icon={faSparkles} size={getIconSize(24)} color="#F87171" />
          </Text>

          <Text 
            style={[isTablet ? GlobalFontStyleSheet.textMd : GlobalFontStyleSheet.textBase, { lineHeight: isTablet ? 38 : 24 }]} 
            className="text-center text-gray-800 dark:text-gray-200"
          >
            You're eligible for an extended free trial. See if Langua Pro helps you learn faster, with easy cancellation anytime in Settings.
          </Text>
        </View>

        {/* Button */}
        <View className=" p-6 ">
          <TouchableOpacity
            onPress={handleViewPlans}
            className="p-4 rounded-xl bg-blue-500 dark:bg-peach-500 shadow-lg"
            style={{
              elevation: 4,
            }}
          >
            <Text className="text-lg font-bold text-center text-white">
              View Trial Plans → 
            </Text>

          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );

  return (
    <SlidingModal visible={isVisible} onClose={onClose}>
      <View className="pb-4">{renderContent()}</View>
    </SlidingModal>
  );
};

export default FreeTrialModal; 
