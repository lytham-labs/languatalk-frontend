"use client"

import type React from "react"
import { View, Text, TouchableOpacity, ScrollView, Platform, Linking, Animated } from "react-native"
import { WebView } from "react-native-webview"
import { faSparkles } from "@fortawesome/pro-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome"
import SlidingModal from "@/components/shared/SlidingModal"
import { ThemedText } from "@/components/shared/ThemedText"
import { useRouter } from "expo-router"
import { GlobalFontStyleSheet } from "@/constants/Font"
import BottomUpWindow from "@/components/BottomUpWindow"
import { useEffect, useRef } from "react"
import { openHelpScoutArticle } from '@/components/helpscout';
import useUserSettings from '@/services/api/useUserSettings';
import useDevice from "@/hooks/useDevice"

interface UpgradeProModalProps {
  isVisible: boolean
  onClose: () => void
  usageContext?: 'call' | 'chat';
}

const UpgradeProModal: React.FC<UpgradeProModalProps> = ({ isVisible, onClose, usageContext = 'chat' }) => {
  const router = useRouter()
  const { userSettings } = useUserSettings();
  const isAndroid = Platform.OS === "android"
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.95)).current
  const { isTablet } = useDevice()

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
      ]).start()
    }
  }, [isVisible, fadeAnim, scaleAnim]) // Added fadeAnim and scaleAnim to dependencies

  const handleUpgrade = () => {
    onClose()
    router.navigate("/subscription")
  }

  const handleExplainerVideoPress = () => {
    if (Platform.OS === "ios") {
      openHelpScoutArticle(userSettings?.user, '65bba0e8a421cb0773894bb5')
    } else {
      Linking.openURL("https://support.languatalk.com/article/145-how-does-langua-work-explainer-video")
    }
  }

  const handleGuidePress = () => {
    if (Platform.OS === "ios") {
      openHelpScoutArticle(userSettings?.user, '6776cfef912e1b468be799b7')
    } else {
      Linking.openURL("https://support.languatalk.com/article/160-learn-how-to-use-langua-effectively-conversations-help-guide")
    }
  }

  const renderContent = () => (
    <ScrollView className="px-4 py-4" showsVerticalScrollIndicator={false}>
      <Animated.View className="flex-1 space-y-6" style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
        {/* Header Section */}
        <View className="space-y-4 pb-10">
          <Text style={isTablet ? GlobalFontStyleSheet.textXl : GlobalFontStyleSheet.text2Xl} className="font-bold text-center text-blue-500 dark:text-white pb-6 ">
            {isAndroid
              ? "Try Pro risk-free for 30 days"
              : "Unlock Pro Access & Become Fluent Faster"}
            {!isAndroid && (
              <>
                {" "}
                <FontAwesomeIcon icon={faSparkles} size={28} color="#F87171" />
              </>
            )}
          </Text>

          <ThemedText style={[isTablet ? GlobalFontStyleSheet.textMd : GlobalFontStyleSheet.textBase, { lineHeight: isTablet ? 38 : 24 }]} className="text-center">
            {isAndroid ? (
              <>
                {usageContext === 'call'
                  ? "You\'ve used your free minutes for today. We don\'t yet offer an extended free trial on Android, but we believe in our product & offer a 30-day guarantee for peace of mind. You can try again tomorrow or upgrade now."
                  : "You\'ve used your free messages for today. We don\'t yet offer an extended free trial on Android, but we believe in our product & offer a 30-day guarantee for peace of mind. You can try again tomorrow or upgrade now."}
              </>
            ) : (
              <>
                {usageContext === 'call'
                  ? "You\'ve used your free minutes, but you\'re eligible for an"
                  : "You\'ve completed your free messages, but you\'re eligible for an"}
                <Text style={{ fontWeight: 'bold' }}> extended free trial</Text>
                {". Cancel anytime in a few clicks."}
              </>
            )}
          </ThemedText>
        </View>

        {/* Pricing Block */}
        <View className="bg-blue-50 dark:bg-gray-800 p-6 rounded-xl border-2 border-blue-200 dark:border-gray-700">
          <TouchableOpacity
            onPress={handleUpgrade}
            className="p-4 rounded-xl bg-blue-500 dark:bg-peach-500 shadow-lg"
            style={{
              elevation: 4,
            }}
          >
            <Text className="text-lg font-bold text-center text-white">
              {isAndroid ? "Explore Premium Features →" : "Learn More →"}
            </Text>
          </TouchableOpacity>

          <ThemedText style={[isTablet ? GlobalFontStyleSheet.textSm : GlobalFontStyleSheet.textMd, { lineHeight: isTablet ? 38 : 24 }]} className="text-center mt-5">
            P.S. Not sure exactly how Langua works?{" "}
            <Text
              className="text-blue-500 dark:text-peach-500 font-medium"
              onPress={handleGuidePress}
            >
              Read our guide
            </Text>{" "}
            or{" "}
            <Text
              className="text-blue-500 dark:text-peach-500 font-medium"
              onPress={handleExplainerVideoPress}
            >
              watch the explainer video
            </Text>
          </ThemedText>
        </View>
      </Animated.View>
    </ScrollView>
  )

  if (isAndroid) {
    return <BottomUpWindow isVisible={isVisible} onClose={onClose} content={renderContent()} />
  }

  return (
    <SlidingModal visible={isVisible} onClose={onClose} >
      <View className="pb-4">{renderContent()}</View>
    </SlidingModal>
  )
}

export default UpgradeProModal

