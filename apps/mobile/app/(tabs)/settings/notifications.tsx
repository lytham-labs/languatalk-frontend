import React, { useState, useEffect } from 'react';
import { ScrollView, Switch, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from '@/components/shared/ThemedText';
import { ThemedView } from '@/components/shared/ThemedView';
import useUserSettings from '@/services/api/useUserSettings';
import Notification from '@/components/Notification';

const PUSH_NOTIFICATIONS_KEY = '@settings:pushNotificationsEnabled';

export default function NotificationsScreen() {
  const { userSettings, loading, error, successMessage, updateUserSettings } = useUserSettings();
  const [acceptsMarketing, setAcceptsMarketing] = useState(false);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);

  useEffect(() => {
    if (userSettings) {
      setAcceptsMarketing(userSettings.user.accepts_marketing);
      setEmailNotificationsEnabled(!userSettings.user.email_notifications_disabled);
    }
  }, [userSettings]);

  useEffect(() => {
    if (successMessage) {
      setNotification({ message: successMessage, type: 'success' });
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      setNotification({ message: error, type: 'error' });
    }
  }, [error]);

  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      const savedPreference = await AsyncStorage.getItem(PUSH_NOTIFICATIONS_KEY);
      setPushNotificationsEnabled(status === 'granted' && savedPreference === 'true');
    } catch (error) {
      setNotification({ message: 'Failed to load notification settings', type: 'error' });
    }
  };

  const handlePushNotifications = async (value: boolean) => {
    try {
      if (value) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          setNotification({ 
            message: 'Please enable notifications in your device settings', 
            type: 'error' 
          });
          return;
        }
      }

      setPushNotificationsEnabled(value);
      await AsyncStorage.setItem(PUSH_NOTIFICATIONS_KEY, value.toString());
      
      if (!value) {
        await Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }),
        });
      }
    } catch (error) {
      setNotification({ 
        message: 'Failed to update notification settings', 
        type: 'error' 
      });
    }
  };

  const handleChange = (field: string, value: boolean) => {
    const updatedSettings: Partial<UserSettings> = {
      user: {
        [field]: value,
      },
    };
    updateUserSettings(updatedSettings);
  };

  if (loading && !userSettings) {
    return <ThemedView className="flex-1 justify-center items-center"><ThemedText>Loading...</ThemedText></ThemedView>;
  }

  return (
    <ThemedView className="flex-1 p-4">
      <ScrollView>
        <ThemedView className="flex-row items-center justify-between my-2 pr-2">
          <ThemedText className="text-base flex-1 mr-2">Email me reminders, offers & learning tips</ThemedText>
          <Switch
            value={acceptsMarketing}
            onValueChange={(value) => {
              setAcceptsMarketing(value);
              handleChange('accepts_marketing', value);
            }}
          />
        </ThemedView>
        {/* Temporarily hidden push notifications section
        <ThemedView className="flex-row items-center justify-between my-2 pr-2">
          <ThemedText className="text-base flex-1 mr-2">Help me practice regularly with mobile reminders</ThemedText>
          <Switch
            value={pushNotificationsEnabled}
            onValueChange={handlePushNotifications}
          />
        </ThemedView>
        */}
      </ScrollView>
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
