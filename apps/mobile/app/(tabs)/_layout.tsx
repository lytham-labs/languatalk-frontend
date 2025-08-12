import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faComments } from '@fortawesome/pro-duotone-svg-icons/faComments';
import { faBookHeart } from '@fortawesome/pro-solid-svg-icons/faBookHeart';
import { faUser } from '@fortawesome/pro-duotone-svg-icons/faUser';
import { faGears } from '@fortawesome/pro-duotone-svg-icons/faGears';
import { faLanguage } from '@fortawesome/pro-duotone-svg-icons/faLanguage';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { usePathname } from 'expo-router';
import { getFontSize, getIconSize } from '@/constants/Font';
import useDevice from '@/hooks/useDevice';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const { isTablet } = useDevice()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        unmountOnBlur: true,
        tabBarStyle: pathname.includes('/speak/chat') || pathname.includes('/speak/call') || pathname.includes('/speak/summary') || pathname.includes('/speak/feedback') || pathname.includes('/cards/recall') || pathname.includes('/cards/listen') || pathname.includes('/cards/produce') || pathname.includes('/cards/cloze') || pathname.includes('/speak/practice') ? { display: 'none' } : { },
        tabBarLabelStyle: {
          fontSize: getFontSize(12),
        },
      }}>
      <Tabs.Screen
        name="speak"
        options={{
          title: 'Speak',
          tabBarIcon: ({ color }) => <FontAwesomeIcon icon={faComments} size={getIconSize(28)} color={color} style={ isTablet ? tabStyles.tabIconTablet : {}} />,
          unmountOnBlur: false
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <FontAwesomeIcon icon={faBookHeart} size={getIconSize(28)} color={color}  style={ isTablet ? tabStyles.tabIconTablet : {}}/>,
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          title: 'Cards',
          tabBarIcon: ({ color }) => <FontAwesomeIcon icon={faLanguage} size={getIconSize(28)} color={color}  style={ isTablet ? tabStyles.tabIconTablet : {}}/>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <FontAwesomeIcon icon={faGears} size={getIconSize(28)} color={color}  style={ isTablet ? tabStyles.tabIconTablet : {}} />,
        }}
      />
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  tabIconTablet: { marginRight: 20 }
});
