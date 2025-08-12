import React, { useState, useEffect } from 'react';
import cx from 'classnames';
import { View, TouchableOpacity, Linking, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Text } from 'react-native';
import { ThemedText } from '@/components/shared/ThemedText';
import Button from '@/components/shared/Button';
import { ThemedView } from '@/components/shared/ThemedView';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { faLeftFromBracket } from '@fortawesome/pro-duotone-svg-icons/faLeftFromBracket';
import { faUserGear } from '@fortawesome/free-solid-svg-icons/faUserGear';
import { faCreditCard } from '@fortawesome/free-solid-svg-icons/faCreditCard';
import { faBell } from '@fortawesome/free-solid-svg-icons/faBell';
import { faComments } from '@fortawesome/free-solid-svg-icons/faComments';
import { faLanguage } from '@fortawesome/free-solid-svg-icons/faLanguage';
import { faUser } from '@fortawesome/free-solid-svg-icons/faUser';
import { faRotate } from '@fortawesome/free-solid-svg-icons/faRotate';
import { faStopwatch } from '@fortawesome/free-solid-svg-icons/faStopwatch';
import { getIconSize, GlobalFontStyleSheet } from '@/constants/Font';
import useDevice from '@/hooks/useDevice';
import { openHelpScout } from '@/components/helpscout';
import useUserSettings from '@/services/api/useUserSettings';
import { identifyUser, presentCustomerCenter } from '@/lib/revenuecat';
import { useFeatureFlag } from 'posthog-react-native';
import * as Updates from 'expo-updates';
import { 
  enableTestingMode, 
  disableTestingMode, 
  isTestingModeEnabled,
  resetTodaysCallTime 
} from '@/services/CallTimeService';

const PRIVACY_POLICY_URL = 'https://languatalk.com/blog/terms-and-privacy/';
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

interface RevenueCatUser {
  activeSubscriptions: string[];
  allExpirationDates: Record<string, string | null>;
  allPurchaseDates: Record<string, string | null>;
  entitlements: {
    active: Record<string, any>;
  };
  managementURL: string | null;
}

export default function SettingsScreen() {
  const { logout } = useAuth();
  const router = useRouter();
  const { isTablet, isPhone } = useDevice();
  const { fetchUserSettings, userSettings } = useUserSettings();
  const [isRevenuecatUser, setIsRevenuecatUser] = useState(false);
  const [revenueCatData, setRevenueCatData] = useState<RevenueCatUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const showCheckForUpdates = useFeatureFlag('check_for_updates');
  const [callLimitsTestingMode, setCallLimitsTestingMode] = useState(false);
  const [callLimitsMessage, setCallLimitsMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchUserSettings();
  }, []);

  useEffect(() => {
    // Check call limits testing mode status
    const checkTestingMode = async () => {
      try {
        const isEnabled = await isTestingModeEnabled();
        setCallLimitsTestingMode(isEnabled);
      } catch (error) {
        console.error('Error checking call limits testing mode:', error);
      }
    };

    if (__DEV__) {
      checkTestingMode();
    }
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const revenueCatUser = await identifyUser({
          uuid: userSettings?.user.uuid || '',
          email: userSettings?.user.email || ''
        });

        if (revenueCatUser) {
          setRevenueCatData(revenueCatUser as unknown as RevenueCatUser);
          setIsRevenuecatUser(true);
        } else {
          setIsRevenuecatUser(false);
        }
      } catch (err) {
        console.error('Error identifying RevenueCat user:', err);
        setIsRevenuecatUser(false);
      }
    };

    if (userSettings?.user) {
      checkUser();
    }
  }, [userSettings?.user]);

  const hasRevenueCatSubscription = revenueCatData?.activeSubscriptions && revenueCatData.activeSubscriptions.length > 0;
  const showRevenuecatManageSubscription = isRevenuecatUser && hasRevenueCatSubscription;

  const navigateToOnboarding = () => {
    router.push('/onboarding'); // Adjust the path as necessary
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/landing');
    } catch (error) {
      console.error('Logout failed:', error);
      // You can add an alert or some UI feedback here
      alert('Logout failed. Please try again.');
    }
  };

  const handleSubscriptionPress = async () => {
    if (Platform.OS === 'android') {
      router.push('/settings/subscription');
    } else if (showRevenuecatManageSubscription) {
      try {
        // Present the RevenueCat Customer Center for subscription management
        await presentCustomerCenter();
      } catch (err) {
        console.error('Failed to open subscription management:', err);
        // Fall back to the subscription screen if presenting the Customer Center fails
        router.push('/settings/subscription');
      }
    } else {
      // Default behavior - navigate to subscription screen
      router.push('/settings/subscription');
    }
  };

  const handleCheckForUpdates = async () => {
    try {
      setIsCheckingUpdate(true);
      setUpdateMessage(null);

      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setUpdateMessage('Update available! Downloading...');
        await Updates.fetchUpdateAsync();
        setUpdateMessage('Update downloaded! Restarting app...');
        await Updates.reloadAsync();
      } else {
        setUpdateMessage('You are using the latest version!');
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      // More detailed error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setUpdateMessage(`Failed to check for updates: ${errorMessage}`);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleCallLimitsTestingToggle = async () => {
    try {
      setCallLimitsMessage(null);
      
      if (callLimitsTestingMode) {
        await disableTestingMode();
        setCallLimitsTestingMode(false);
        setCallLimitsMessage('Testing mode disabled - using normal limits');
        
        // Reset any existing call time for clean testing
        if (userSettings?.user?.id) {
          await resetTodaysCallTime(userSettings.user.id.toString());
        }
      } else {
        await enableTestingMode();
        setCallLimitsTestingMode(true);
        setCallLimitsMessage('Testing mode enabled - Free: 6s, Communicate: 30s');
        
        // Reset any existing call time for clean testing
        if (userSettings?.user?.id) {
          await resetTodaysCallTime(userSettings.user.id.toString());
        }
      }
    } catch (error) {
      console.error('Error toggling call limits testing mode:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setCallLimitsMessage(`Failed to toggle testing mode: ${errorMessage}`);
    }
  };

  return (
    <ThemedView className="flex-1">
      <ScrollView className={`flex-1 ${isTablet ? 'px-14 ' : 'px-4'}`}>
        <View className={` pb-8 ${isTablet ? 'gap-4 pt-8' : 'pt-4'}`}>
          <Button
              btnType = 'secondary'
              containerClassNames={`text-center px-4 mb-4 ${isTablet ? 'rounded-xl' : ''}`}
              titleSize={isTablet ? 'text-sm' : 'text-lg'}
              iconSize={isTablet ? getIconSize(14) : getIconSize(18)}
              useChevron={true}
              title="Chat Settings"
              icon={faComments}
              href="/settings/chat-settings"
          />

          <Button
              btnType = 'secondary'
              containerClassNames={`text-center px-4 mb-4 ${isTablet ? 'rounded-xl' : ''}`}
              titleSize={isTablet ? 'text-sm' : 'text-lg'}
              iconSize={isTablet ? getIconSize(14) : getIconSize(18)}
              useChevron={true}
              title="Learning Settings"
              icon={faLanguage}
              href="/settings/language-settings"
          />

          <Button
              btnType = 'secondary'
              containerClassNames={`text-center px-4 mb-4 ${isTablet ? 'rounded-xl' : ''}`}
              titleSize={isTablet ? 'text-sm' : 'text-lg'}
              iconSize={isTablet ? getIconSize(14) : getIconSize(18)}
              useChevron={true}
              title="My Details"
              icon={faUser}
              href="/settings/details"
          />

          <Button
              btnType = 'secondary'
              containerClassNames={`text-center px-4 mb-4 ${isTablet ? 'rounded-xl' : ''}`}
              titleSize={isTablet ? 'text-sm' : 'text-lg'}
              iconSize={isTablet ? getIconSize(14) : getIconSize(18)}
              useChevron={true}
              title="Notifications"
              icon={faBell}
              href="/settings/notifications"
          />

          <Button
              btnType = 'secondary'
              containerClassNames={`text-center px-4 mb-4 ${isTablet ? 'rounded-xl' : ''}`}
              titleSize={isTablet ? 'text-sm' : 'text-lg'}
              iconSize={isTablet ? getIconSize(14) : getIconSize(18)}
              useChevron={true}
              title="My Subscription"
              icon={faCreditCard}
              onPress={handleSubscriptionPress}
          />

          <Button
              containerClassNames={`text-center px-4 mb-4 ${isTablet ? 'rounded-xl' : ''}`}
              useChevron={false}
              titleSize={isTablet ? 'text-sm' : 'text-lg'}
              iconSize={isTablet ? getIconSize(14) : getIconSize(18)}
              title="Log Out"
              btnType='logout'
              icon={faLeftFromBracket}
              onPress={handleLogout}
          />

          {showCheckForUpdates && (
            <Button
              btnType="secondary"
              containerClassNames={`text-center px-4 mt-4 ${isTablet ? 'rounded-xl' : ''}`}
              titleSize={isTablet ? 'text-sm' : 'text-lg'}
              iconSize={isTablet ? getIconSize(14) : getIconSize(18)}
              useChevron={false}
              title={isCheckingUpdate ? "Checking for Updates..." : "Check for Updates"}
              icon={faRotate}
              onPress={isCheckingUpdate ? () => {} : () => { handleCheckForUpdates(); }}
            />
          )}

          {updateMessage && (
            <ThemedText
              style={isTablet ? GlobalFontStyleSheet.textSm : GlobalFontStyleSheet.textBase}
              className="text-center mt-2 px-2"
            >
              {updateMessage}
            </ThemedText>
          )}


          {__DEV__ && (
            <Button
              containerClassNames={`text-center px-4 mb-4 ${isTablet ? 'rounded-xl' : ''}`}
              useChevron={true}
              titleSize={isTablet ? 'text-sm' : 'text-lg'}
              iconSize={isTablet ? getIconSize(14) : getIconSize(18)}
              title="Onboarding"
              icon={faUserGear}
              onPress={navigateToOnboarding}
            />
          )}

          {__DEV__ && (
            <Button
              btnType={callLimitsTestingMode ? "primary" : "secondary"}
              containerClassNames={`text-center px-4 ${isTablet ? 'rounded-xl' : ''}`}
              useChevron={false}
              titleSize={isTablet ? 'text-sm' : 'text-lg'}
              iconSize={isTablet ? getIconSize(14) : getIconSize(18)}
              title={callLimitsTestingMode ? "Disable Call Limits Testing" : "Enable Call Limits Testing"}
              icon={faStopwatch}
              onPress={handleCallLimitsTestingToggle}
            />
          )}

          {__DEV__ && callLimitsMessage && (
            <ThemedText
              style={isTablet ? GlobalFontStyleSheet.textSm : GlobalFontStyleSheet.textBase}
              className="text-center mt-2 px-2"
            >
              {callLimitsMessage}
            </ThemedText>
          )}

          {Platform.OS === 'ios' ? (
            <TouchableOpacity
              className="mt-4"
              onPress={() => openHelpScout(userSettings?.user)}
            >
              <ThemedText style={isTablet ? GlobalFontStyleSheet.textSm : GlobalFontStyleSheet.textBase} className="text-blue-600 underline px-2">Help Articles / Contact Us</ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className="mt-4"
              onPress={() => router.push('/help')}
            >
              <ThemedText style={isTablet ? GlobalFontStyleSheet.textSm : GlobalFontStyleSheet.textBase} className="text-blue-600 underline px-2">Help Articles / Contact Us</ThemedText>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            className="mt-4"
            onPress={() => Linking.openURL('https://roadmap.languatalk.com/b/n0oo8d06/feature-requests')}
          >
            <ThemedText style={isTablet ? GlobalFontStyleSheet.textSm : GlobalFontStyleSheet.textBase} className="text-blue-600 underline px-2">Suggest Improvements</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-4"
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          >
            <ThemedText style={isTablet ? GlobalFontStyleSheet.textSm : GlobalFontStyleSheet.textBase} className={cx("text-blue-600 underline px-2", {})}>Privacy Policy</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-4"
            onPress={() => Linking.openURL(TERMS_URL)}
          >
            <ThemedText style={isTablet ? GlobalFontStyleSheet.textSm : GlobalFontStyleSheet.textBase} className={cx("text-blue-600 underline px-2", {})}>Terms of Use</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
}
