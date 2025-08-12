import React from 'react';
import { View, Pressable, Text } from 'react-native';
import cx from 'classnames';
import ThemedFontAwesome from '@/components/shared/ThemedFontAwesome';
import { FontAwesome6 } from '@expo/vector-icons'; // Ensure you have the correct import for FontAwesome6/ Adjust the path to your styles file
import { UserStats } from '@/services/api/useUserStats';
import useCello from '@/services/api/useCello';
import { useFeatureFlag } from 'posthog-react-native';

// Import your global CSS file
import "@/assets/stylesheets/global.css"// Adjust the path to where userStats is defined

import { cssInterop, remapProps } from 'nativewind';
import { getIconSize, GlobalFontStyleSheet } from '../../constants/Font';
import useDevice from '@/hooks/useDevice';

cssInterop(FontAwesome6, {
  className: {
    target: "style",
    nativeStyleToProp: { height: true, width: true },
  },
});

const SpeakHeaderLeft = ({userStats, userSettings}: { userStats: UserStats, userSettings?: any })=> {
    const {isTablet, isPhone} = useDevice();
    const { openWidget } = useCello();
    
    // Determine if we should show the cello button
    const shouldShowCelloButton = userSettings?.user?.langua_pro_enabled === true;
    const isCelloIntegrationEnabled = useFeatureFlag('cello-integration');

    return (
        userStats && (
        <View className={cx("flex flex-row gap-2 items-center", {
            'gap-2': isPhone,
            'gap-4': isTablet,
        })}>
            <Pressable onPress={() => {/* Navigate to first anchor */}}>
                <View className={cx("flex flex-row gap-2 items-center", {
                    'gap-2': isPhone,
                    'gap-4': isTablet,
                })}>
                    <ThemedFontAwesome name="fire" size={getIconSize(24)} />
                    <Text style={GlobalFontStyleSheet.textSm} className='text-peach-500 dark:color-white font-bold'>{userStats?.daily_streak}</Text>
                </View>
            </Pressable>
            <Pressable onPress={() => {/* Navigate to second anchor */}}>
                <View className="flex flex-row gap-2 items-center">
                    <ThemedFontAwesome name="award" size={getIconSize(24)} className="color-peach-500 dark:color-white" />
                    <Text style={GlobalFontStyleSheet.textSm} className='text-peach-500 dark:color-white font-bold'>{userStats?.user_leaderboard?.all_time_points}</Text>
                </View>
            </Pressable>
            {shouldShowCelloButton && isCelloIntegrationEnabled && (
                <Pressable 
                    onPress={openWidget}
                    className="bg-peach-500 dark:bg-white py-1.5 px-3 rounded-2xl"
                >
                    <Text className='text-white dark:text-peach-500 font-bold text-xs'>Refer & Earn $20</Text>
                </Pressable>
            )}
        </View> )
    );
};

export default SpeakHeaderLeft;

