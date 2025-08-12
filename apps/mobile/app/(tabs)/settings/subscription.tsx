import React, { useState, useEffect } from 'react';
import { View, Pressable, Linking, Platform } from 'react-native';
import { ThemedText } from '@/components/shared/ThemedText';
import { ThemedView } from '@/components/shared/ThemedView';
import useUserSubscription from '@/services/api/useUserSubscription';
import Notification from '@/components/Notification';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import useUserSettings from '@/services/api/useUserSettings';
import { identifyUser, presentCustomerCenter } from '@/lib/revenuecat';
import cx from 'classnames';
import useDevice from '@/hooks/useDevice';

interface RevenueCatUser {
  activeSubscriptions: string[];
  allExpirationDates: Record<string, string>;
  allPurchaseDates: Record<string, string>;
  entitlements: {
    active: Record<string, any>;
  };
  managementURL: string | null;
}

export default function SubscriptionScreen() {
  const { subscriptionInfo, loading, error } = useUserSubscription();
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const router = useRouter();
  const { isTablet, isPhone } = useDevice();
  const colorScheme = useColorScheme();
  const { fetchUserSettings, userSettings } = useUserSettings();
  const [isRevenuecatUser, setIsRevenuecatUser] = useState(false);
  const [revenueCatData, setRevenueCatData] = useState<RevenueCatUser | null>(null);

  useEffect(() => {
    fetchUserSettings();
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const revenueCatUser = await identifyUser({
        uuid: userSettings?.user.uuid || '',
        email: userSettings?.user.email || ''
      });

      setRevenueCatData(revenueCatUser);
      setIsRevenuecatUser(revenueCatUser !== null);
    };

    checkUser();
  }, [userSettings?.user]);

  useEffect(() => {
    if (error) {
      setNotification({ message: error, type: 'error' });
    }
  }, [error]);

  if (loading && !subscriptionInfo) {
    return <ThemedView className="flex-1 justify-center items-center"><ThemedText>Loading...</ThemedText></ThemedView>;
  }

  const hasRevenueCatSubscription = revenueCatData?.activeSubscriptions.length > 0;
  const showRevenuecatManageSubscription = 
    isRevenuecatUser && (
      hasRevenueCatSubscription || 
      !userSettings?.user.langua_pro_enabled
    );

    const getActiveSubscriptionInfo = () => {
      if (!revenueCatData || !hasRevenueCatSubscription) return null;
      
      const activeSubscriptionId = revenueCatData.activeSubscriptions[0];
      return {
        name: activeSubscriptionId.split('_')[0].charAt(0).toUpperCase() + 
              activeSubscriptionId.split('_')[0].slice(1),
        expirationDate: revenueCatData.allExpirationDates[activeSubscriptionId],
        purchaseDate: revenueCatData.allPurchaseDates[activeSubscriptionId]
      };
    };

  const activeSubscription = getActiveSubscriptionInfo();

  return (
    <ThemedView className="flex-1">
      <View className={cx('p-4 bg-background-light dark:bg-gray-800', {
        'p-4': isPhone,
        'p-5': isTablet,
      })}>
        <ThemedText
          style={[GlobalFontStyleSheet.textBase, { color: Colors[colorScheme].text }]}
          className="font-bold mb-2"
        >
          Your Plan
        </ThemedText>
        <ThemedText
          style={[GlobalFontStyleSheet.textBase]}
          className="text-gray-500 dark:text-white mb-4"
        >
          {isRevenuecatUser && activeSubscription
            ? (activeSubscription?.name || 'Free Plan')
            : (subscriptionInfo?.plan?.name || 'Free Plan')}
        </ThemedText>

        {isRevenuecatUser && activeSubscription ? (
          <>
            <ThemedText
              style={[GlobalFontStyleSheet.textBase, { color: Colors[colorScheme].text }]}
              className="font-bold mb-2"
            >
              Renewal Date
            </ThemedText>
            <ThemedText
              style={[GlobalFontStyleSheet.textBase]}
              className="text-gray-500 dark:text-white mb-4"
            >
              {format(new Date(activeSubscription.expirationDate), 'MMMM d, yyyy')}
            </ThemedText>

            <ThemedText
              style={[GlobalFontStyleSheet.textBase, { color: Colors[colorScheme].text }]}
              className="font-bold mb-2"
            >
              Subscription Status
            </ThemedText>
            <ThemedText
              style={[GlobalFontStyleSheet.textBase]}
              className="text-gray-500 dark:text-white mb-8"
            >
              Active
            </ThemedText>
          </>
        ) : (
          <>
            {subscriptionInfo?.billing?.next_billing_date && (
              <>
                <ThemedText
                  style={[GlobalFontStyleSheet.textBase, { color: Colors[colorScheme].text }]}
                  className="font-bold mb-2"
                >
                  Next Billing Date
                </ThemedText>
                <ThemedText
                  style={[GlobalFontStyleSheet.textBase]}
                  className="text-gray-500 dark:text-white mb-4"
                >
                  {subscriptionInfo?.billing?.next_billing_date 
                    ? format(new Date(subscriptionInfo.billing.next_billing_date), 'MMMM d, yyyy')
                    : 'No billing date available'}
                </ThemedText>
              </>
            )}

            {subscriptionInfo?.billing && (
              <>
                <ThemedText
                  style={[GlobalFontStyleSheet.textBase, { color: Colors[colorScheme].text }]}
                  className="font-bold mb-2"
                >
                  Billing Amount
                </ThemedText>
                <ThemedText
                  style={[GlobalFontStyleSheet.textBase]}
                  className="text-gray-500 dark:text-white mb-4"
                >
                  {`${subscriptionInfo.billing.currency === 'USD' ? '$' + (subscriptionInfo.billing.amount / 100).toFixed(2) : `${subscriptionInfo.billing.currency} ${(subscriptionInfo.billing.amount / 100).toFixed(2)}`}`}
                </ThemedText>
              </>
            )}

            {subscriptionInfo?.status?.state && (
              <>
                <ThemedText
                  style={[GlobalFontStyleSheet.textBase, { color: Colors[colorScheme].text }]}
                  className="font-bold mb-2"
                >
                  Subscription Status
                </ThemedText>
                <ThemedText
                  style={[GlobalFontStyleSheet.textBase]}
                  className="text-gray-500 dark:text-white mb-8"
                >
                  {subscriptionInfo.status.state.charAt(0).toUpperCase() + subscriptionInfo.status.state.slice(1)}
                  {subscriptionInfo.status.canceled_at && ' (Canceled)'}
                </ThemedText>
              </>
            )}
          </>
        )}

        {showRevenuecatManageSubscription ? (
          <>
            {Platform.OS === 'android' ? (
              <Pressable
                onPress={async () => {
                  try {
                    await presentCustomerCenter();
                  } catch (err) {
                    console.error('Failed to open customer center:', err);
                    if (revenueCatData?.managementURL) {
                      Linking.openURL(revenueCatData.managementURL);
                    }
                  }
                }}
                style={({ pressed }) => [
                  pressed && { opacity: 0.7 }
                ]}
                className="flex-row items-center justify-center mt-4 py-3 px-4 rounded-lg bg-gray-200 dark:bg-gray-700"
              >
                <ThemedText
                  style={[GlobalFontStyleSheet.textBase]}
                  className="font-semibold"
                >
                  Manage Subscription
                </ThemedText>
              </Pressable>
            ) : revenueCatData?.managementURL && (
              <Pressable
                onPress={() => Linking.openURL(revenueCatData.managementURL)}
                style={({ pressed }) => [
                  pressed && { opacity: 0.7 }
                ]}
                className="flex-row items-center justify-center mt-4 py-3 px-4 rounded-lg bg-gray-200 dark:bg-gray-700"
              >
                <ThemedText
                  style={[GlobalFontStyleSheet.textBase]}
                  className="font-semibold"
                >
                  Manage Subscription
                </ThemedText>
              </Pressable>
            )}

            <Pressable
              onPress={() => router.push('/(tabs)/settings/manage-subscription')}
              style={({ pressed }) => [
                pressed && { opacity: 0.7 }
              ]}
              className="flex-row items-center justify-center mt-4 py-3 px-4 rounded-lg bg-gray-200 dark:bg-gray-700"
            >
              <ThemedText
                style={[GlobalFontStyleSheet.textBase]}
                className="font-semibold"
              >
                Change Plan
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <View className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-8">
            <ThemedText
              style={[GlobalFontStyleSheet.textBase]}
              className="text-center text-gray-600 dark:text-gray-300"
            >
              Your subscription is managed on our website. Please visit our web portal to manage your account.
            </ThemedText>
          </View>
        )}

      </View>

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onDismiss={() => setNotification(null)}
        />
      )}
    </ThemedView>
  );
}
