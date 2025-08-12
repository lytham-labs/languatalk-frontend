import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import SlidingModal from '@/components/shared/SlidingModal';
import useUserSettings from '@/services/api/useUserSettings';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { ThemedText } from '../shared/ThemedText';
import useDevice from '@/hooks/useDevice';

interface UpgradeWebModalProps {
    isVisible: boolean;
    onClose: () => void;
}

const UpgradeWebModal: React.FC<UpgradeWebModalProps> = ({
    isVisible,
    onClose,
}) => {
    const { userSettings } = useUserSettings() // Access user from context
    const { isTablet } = useDevice()
    const handleWebUpgrade = async () => {
        onClose();
        // Navigate to the subscription page in the web app in the browser
        if (userSettings && userSettings.user.id) {
            const url = `${process.env.EXPO_PUBLIC_WEB_URL}/account/langua_settings/${userSettings.user.id}/edit?active_tab=subscription`;
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                // Open the URL in a browser
                await WebBrowser.openBrowserAsync(url);
              } else {
                // Handle the case where the device cannot open the URL
                console.log(`Don't know how to open this URL: ${url}`);
            }
        }
    };

    const renderContent = () => (
        <ScrollView className="px-2 py-2">
            <View className="flex flex-column justify-between border-1 border-white">
                <View className='flex-1'>
                    <Text style={GlobalFontStyleSheet.textXl} className="py-10 font-bold text-center text-blue-500 dark:text-white">
                        Upgrade your subscription
                    </Text>
                    <ThemedText style={[GlobalFontStyleSheet.textMd, { lineHeight: isTablet ? 38 : 20 }]} className="text-base mb-4 text-center">
                        You subscribed via our website, so payments are managed by Paddle. If you wish to cancel, upgrade or switch plans, you'll need to log into your account on the website.
                    </ThemedText>
                </View>
                <TouchableOpacity 
                    onPress={handleWebUpgrade} 
                    className={'p-4 rounded-lg border-2 dark:border-peach-500 border-blue-500 bg-blue-500 dark:bg-peach-500 mt-4'}
                >
                    <Text className={'text-base sm:text-xl text-center font-bold text-white'}>
                        Upgrade on Website
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );

    return (
        <SlidingModal visible={isVisible} onClose={onClose}>
            <View className="pb-4">
                {renderContent()}
            </View>
        </SlidingModal>
    );
};

export default UpgradeWebModal;
