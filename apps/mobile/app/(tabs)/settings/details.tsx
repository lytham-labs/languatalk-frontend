import React, { useState, useEffect } from 'react';
import { ScrollView, TextInput, Text, Pressable, View, TouchableOpacity } from 'react-native';
import { useForm, Controller } from "react-hook-form"
import { ThemedText } from '@/components/shared/ThemedText';
import { ThemedView } from '@/components/shared/ThemedView';
import useUserSettings from '@/services/api/useUserSettings';
import { UserSettings, UserUserSettings } from '@/contexts/UserSettingsContext';
import cx from 'classnames';
import Notification from '@/components/Notification';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/constants/api';
import { GlobalFontStyleSheet, getIconSize } from '@/constants/Font';
import { useConfirm } from 'react-native-confirm-dialog';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faTrashCan } from '@fortawesome/pro-duotone-svg-icons/faTrashCan';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useTimezoneOptions } from '@/services/api/useTimezoneOptions';
import TimezonePicker from '@/components/shared/TimezonePicker';

type DetailsFormData = {
  email: string,
  first_name: string
  last_name: string
  time_zone: string
}

type PasswordFormData = {
  currentPassword: string,
  newPassword: string
  passwordConfirmation: string
}

export default function MyDetailsScreen() {
  const router = useRouter();
  const { userSettings, loading, error: userDetailsError, successMessage, updateUserSettings } = useUserSettings();
  const { timezoneOptions, loading: timezoneLoading } = useTimezoneOptions();
  const [passwordFormError, setPasswordFormError] = useState<string | null>(null);
  const [detailsFormError, setDetailsFormError] = useState<string | null>(null);
  const {
    control,
    getValues,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: "",
      first_name: "",
      last_name: "",
      time_zone: "",
      currentPassword: "",
      newPassword: "",
      passwordConfirmation: "",
    },
  })

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const { token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('details'); // 'details' or 'password'
  const confirm = useConfirm();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (userSettings) {
      setValue('email', userSettings.user.email);
      setValue('first_name', userSettings.user.first_name);
      setValue('last_name', userSettings.user.last_name);
      setValue('time_zone', userSettings.user.time_zone);
    }
  }, [userSettings]);

  useEffect(() => {
    if (successMessage) {
      setNotification({ message: successMessage, type: 'success' });
    }
  }, [successMessage]);

  useEffect(() => {
    if (userDetailsError) {
      setDetailsFormError(userDetailsError);
    }
  }, [userDetailsError]);

  const handleSave = async (data: DetailsFormData) => {
    // Check if any values actually changed
    const hasChanges = 
      data.email !== userSettings?.user.email ||
      data.first_name !== userSettings?.user.first_name ||
      data.last_name !== userSettings?.user.last_name ||
      data.time_zone !== userSettings?.user.time_zone;
    
    if (!hasChanges) {
      router.back();
      return;
    }
    
    setDetailsFormError(null);
    const updatedSettings = {
      user: {
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        time_zone: data.time_zone,
      },
    };
    updateUserSettings(updatedSettings as Partial<UserSettings>);
    router.back();
  };

  const handleUpdatePassword = async (formData: PasswordFormData) => {
    setPasswordFormError(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/user/password`, {
        method: 'PATCH',
        headers: {
          'Authorization': `${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: {
            current_password: formData.currentPassword,
            password: formData.newPassword,
            password_confirmation: formData.passwordConfirmation,
          },
        }),
      });

      const data = await response.json();
      if (response.ok) {
        console.log('password update complete');
        setNotification({ message: data.status.message, type: 'success' });
      } else {
        console.log('password update errored');
        console.log(data.status.message);
        setPasswordFormError(data.status.message);
        setNotification({ message: data.status.message, type: 'error' });
      }
    } catch (error) {
      console.error('Error updating password:', error);
      setNotification({ message: 'Failed to update password', type: 'error' });
    } finally {
      setValue('currentPassword', '');
      setValue('newPassword', '');
      setValue('passwordConfirmation', '');
    }
  };

  const resetPasswordForm = () => {
    setPasswordFormError(null);
    setValue('currentPassword', '');
    setValue('newPassword', '');
    setValue('passwordConfirmation', '');
  }

  const handleDeleteAccount = async () => {
    confirm({
      title: 'Delete Account',
      body: 'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.',
      confirmLabel: 'Delete Account',
      cancelLabel: 'Cancel',
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_URL}/api/v1/delete_accounts`, {
            method: 'DELETE',
            headers: {
              'Authorization': `${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error('Failed to delete account');
          }

          await logout();

          router.replace({
            pathname: '/login',
            params: { message: 'Your account is being deleted. Thank you for using our service.' }
          });
        } catch (error) {
          setNotification({
            message: 'Failed to delete account. Please try again.',
            type: 'error'
          });
        }
      },
    });
  };

  if (loading && !userSettings) {
    return <ThemedView className="flex-1 justify-center items-center"><ThemedText>Loading...</ThemedText></ThemedView>;
  }

  const DetailsTab = () => (
    <>
      <ThemedText className="text-base my-2">Email</ThemedText>
      <Controller
        control={control}
        rules={{
          required: true,
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={GlobalFontStyleSheet.textInput}
            className="border border-gray-300 bg-white rounded-md p-3"
            placeholder="Email"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
        name="email"
      />
      {errors.email && <Text className={'text-red-500'}>{errors.email.message}</Text>}

      <ThemedText className="text-base my-2">First Name</ThemedText>
      <Controller
        control={control}
        rules={{
          required: true,
          maxLength: 80
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={GlobalFontStyleSheet.textInput}
            className="border border-gray-300 bg-white rounded-md p-3"
            placeholder="First Name"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
        name="first_name"
      />
      {errors.first_name && <Text className={'text-red-500'}>{errors.first_name.message}</Text>}
      <ThemedText className="text-base my-2">Last Name</ThemedText>
      <Controller
        control={control}
        rules={{
          required: true,
          maxLength: 100
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={GlobalFontStyleSheet.textInput}
            className="border border-gray-300 bg-white rounded-md p-3"
            placeholder="Last Name"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
        name="last_name"
      />
      {errors.last_name && <Text className={'text-red-500'}>{errors.last_name.message}</Text>}
      
      <ThemedText className="text-base my-2">Time Zone</ThemedText>
      <Controller
        control={control}
        rules={{
          required: false,
        }}
        render={({ field: { onChange, value } }) => {
          
          if (timezoneLoading) {
            return (
              <View style={{ height: 48, justifyContent: 'center', alignItems: 'center' }}>
                <Text>Loading timezone options...</Text>
              </View>
            );
          }
          
          if (timezoneOptions.length === 0) {
            return (
              <View style={{ height: 48, justifyContent: 'center', alignItems: 'center' }}>
                <Text>No timezone options available</Text>
              </View>
              );
          }
          
          return (
            <TimezonePicker
              selectedValue={value}
              onValueChange={onChange}
              items={timezoneOptions}
              placeholder="Select your timezone"
              disabled={timezoneLoading}
            />
          );
        }}
        name="time_zone"
      />
      {errors.time_zone && <Text className={'text-red-500'}>{errors.time_zone.message}</Text>}
      
      {detailsFormError && (
        <View
          className={`mt-4 p-4 rounded-md bg-red-500`}
        >
          <Text className="text-white font-semibold">{detailsFormError}</Text>
        </View>
      )}
      <Pressable
        className={cx(
          'bg-white dark:bg-gray-500 p-4 rounded-lg items-center shadow-sm flex-1 mt-4',
          'bg-blue-500'
        )}
        onPress={handleSubmit(handleSave)}
      >
        <ThemedText className={cx('text-gray-500 dark:text-white text-base font-medium', 'text-white')}>
          Save Details
        </ThemedText>
      </Pressable>
    </>
  );

  const PasswordTab = () => (
    <>
      <ThemedText className="text-base mt-2">Current Password</ThemedText>
      <Controller
        control={control}
        rules={{
          required: true,
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            secureTextEntry={true}
            style={GlobalFontStyleSheet.textInput}
            className="border border-gray-300 p-3 my-1 rounded-md text-black bg-white"
            placeholder="Current Password"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
        name="currentPassword"
      />
      {errors.currentPassword && <Text className={'text-red-500'}>{errors.currentPassword.message}</Text>}

      <ThemedText className="text-base mt-2">New Password</ThemedText>
      <Controller
        control={control}
        rules={{
          required: true,
          minLength: 6
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={GlobalFontStyleSheet.textInput}
            secureTextEntry={true}
            className="border border-gray-300 p-3 my-1 rounded-md text-black bg-white"
            placeholder="New Password"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
        name="newPassword"
      />
      {errors.newPassword && <Text className={'text-red-500'}>{errors.newPassword.message}</Text>}
      <ThemedText className="text-base mt-2">Confirm New Password</ThemedText>
      <Controller
        control={control}
        rules={{
          required: true,
          minLength: 6,
          validate: {
            newPasswordEqual: value => (value === getValues().newPassword) || 'Passwords need to match'
          }
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            secureTextEntry={true}
            style={GlobalFontStyleSheet.textInput}
            className="border border-gray-300 p-3 my-1 rounded-md text-black bg-white"
            placeholder="Confirm Password"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
        name="passwordConfirmation"
      />
      {errors.passwordConfirmation && <Text className={'text-red-500'}>{errors.passwordConfirmation.message}</Text>}

      {passwordFormError && (
        <View
          className={`mt-4 p-4 rounded-md bg-red-500`}
        >
          <Text className="text-white font-semibold">{passwordFormError}</Text>
        </View>
      )}
      <Pressable
        className={cx(
          'bg-white dark:bg-gray-500 p-4 rounded-lg items-center shadow-sm flex-1 mt-4',
          'bg-blue-500'
        )}
        onPress={handleSubmit(handleUpdatePassword)}
      >

        <ThemedText className={cx('text-gray-500 dark:text-white text-base font-medium', 'text-white')}>
          Update Password
        </ThemedText>
      </Pressable>
    </>
  );



  return (
    <>
      <ThemedView className="flex-1 p-4">
        <View className="flex-row mb-6">
          <TouchableOpacity
            className={`flex-1 py-2 ${activeTab === 'details' ? 'border-b-2 border-blue-500' : ''}`}
            onPress={() => {
                setActiveTab('details');
                resetPasswordForm();
                // setDetailsFormError(null);
              }
            }
          >
            <ThemedText className="text-center font-bold">Details</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2 ${activeTab === 'password' ? 'border-b-2 border-blue-500' : ''}`}
            onPress={() => {
              setActiveTab('password');
              resetPasswordForm();
              // setDetailsFormError(null);
            }
          }
          >
            <ThemedText className="text-center font-bold">Password</ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView>
          {activeTab === 'details' ? <DetailsTab /> : <PasswordTab />}
        </ScrollView>

        <View className="mt-8">
          <Pressable
            onPress={handleDeleteAccount}
            style={({ pressed }) => [
              pressed && { opacity: 0.7 }
            ]}
            className="flex-row items-center justify-center py-3 px-4 rounded-lg bg-gray-200 dark:bg-gray-700"
          >
            <FontAwesomeIcon
              icon={faTrashCan}
              size={getIconSize(20)}
              style={{
                color: Colors[colorScheme].text,
                marginRight: 8
              }}
            />
            <ThemedText
              style={[GlobalFontStyleSheet.textBase]}
              className="font-semibold"
            >
              Delete Account
            </ThemedText>
          </Pressable>

          <ThemedText
            style={GlobalFontStyleSheet.textSm}
            className="text-gray-500 dark:text-gray-400 mt-2 text-center"
          >
            Deleting your account will permanently remove all your data
          </ThemedText>
        </View>
      </ThemedView>
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onDismiss={() => setNotification(null)}
        />
      )}
    </>
  );
}
