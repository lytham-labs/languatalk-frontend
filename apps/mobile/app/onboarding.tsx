import React, { useState, useEffect } from 'react';
import { Dimensions, Text, View, ScrollView, TouchableOpacity, Platform, Pressable, Alert } from 'react-native';
import { useForm, FormProvider } from 'react-hook-form';
import { FirstNameInput, NativeLanguagePicker, LanguageDialectPicker, LearningLanguagePicker, LearningLevelPicker } from '@/components/shared/SettingsForms'; 
import NativePicker from '@/components/shared/NativePicker';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/shared/ThemedText';
import { ThemedView } from '@/components/shared/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import useUserSettings from '@/services/api/useUserSettings';
import { UserSettings, UserUserSettings } from '@/contexts/UserSettingsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import cx from 'classnames';
import {  NATIVE_LANGUAGES_ARRAY, LEVELS_OPTIONS_ARRAY, LANGUAGE_DIALECTS, AVAILABLE_LANGUAGES, LANGUAGE_LEVEL_DESCRIPTIONS } from '@/constants/Lists';
import { GlobalFontStyleSheet } from '@/constants/Font';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DAYS_OF_WEEK_ARRAY = [
  { value: 'Mon', label: 'Mo' },
  { value: 'Tue', label: 'Tu' },
  { value: 'Wed', label: 'We' },
  { value: 'Thu', label: 'Th' },
  { value: 'Fri', label: 'Fr' },
  { value: 'Sat', label: 'Sa' },
  { value: 'Sun', label: 'Su' }
];

export default function OnboardingScreen() {
  const methods = useForm({ mode: 'onChange' }); // Initialize the form methods
  const learningLanguage = methods.watch("learningLanguage"); // Watch the learning language value
  const firstName = methods.watch('firstName'); // Watch the first name value
  const languageLevel = methods.watch("languageLevel"); // Add this line to watch language level

  const dialectOptions = learningLanguage && learningLanguage in LANGUAGE_DIALECTS 
      ? LANGUAGE_DIALECTS[learningLanguage as keyof typeof LANGUAGE_DIALECTS] 
      : null;
  const [step, setStep] = useState(-1);

  const [selectedDays, setSelectedDays] = useState<string[]>(DAYS_OF_WEEK);
  const { userSettings, updateUserSettings, fetchUserSettings } = useUserSettings();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = Dimensions.get('window');
  const isTablet = width >= 768;
  const [initialLoad, setInitialLoad] = useState(true);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchUserSettings();
  }, []);

  useEffect(() => {
    if (userSettings && initialLoad) {
      methods.setValue('firstName', userSettings.user.first_name);
      methods.setValue('learningLanguage', userSettings.team?.stream_language);
      methods.setValue('preferredDialect', userSettings.team?.preferred_dialect);
      methods.setValue('nativeLanguage', userSettings.team?.langua_native_language);
      methods.setValue('languageLevel', userSettings.team?.stream_language_level);
      if (step === -1) {
        setStep(userSettings.user.first_name ? 1 : 0);
      }
      setInitialLoad(false); // Mark initial load as complete
    }
  }, [userSettings]);

  useEffect(() => {
    // Check if the language is NOT in AVAILABLE_LANGUAGES
    if (learningLanguage && !Object.keys(AVAILABLE_LANGUAGES).includes(learningLanguage)) {
      if (learningLanguage === 'chinese' || learningLanguage === 'japanese') {
        setWarningMessage('Heads up: we\'re working on getting the app to work flawlessly with this language. For now, we recommend using the website.');
      } else if (learningLanguage === 'thai') {
        setWarningMessage('This language isn\'t fully supported at this time (e.g. no transliteration).');
      } else {
        setWarningMessage(null);
      }
    } else {
      setWarningMessage(null);
    }
  }, [learningLanguage]);

  const handleBack = () => {
    switch (step) {
      case 2:
        if (dialectOptions?.length) {
          setStep(10);
        } else {
          setStep(step - 1);  
        }
      break;
      case 10:
        setStep(1);
        break;
      default:
        if (step > 0) {
          setStep(step - 1);
        }
        break;
    }
  };

  const handleNext = async () => {
    let isValid = true; // Track overall validity

    switch (step) {
      case 0:
        const isFirstNameValid = await methods.trigger('firstName');
        if (!isFirstNameValid || !firstName || firstName.trim().length === 0) {
          isValid = false; // Mark as invalid if first name is not valid
        }
        break;
      case 1:
        const isLearningLanguageValid = await methods.trigger('learningLanguage');
        if (!isLearningLanguageValid) {
          isValid = false; // Mark as invalid if learning language is not valid
        }
        break;
      case 2:
        const isLanguageLevelValid = await methods.trigger('languageLevel');
        if (!isLanguageLevelValid || !languageLevel) {
          isValid = false;
        }
        break;
      case 10:
        const isPreferredDialectValid = await methods.trigger('preferredDialect');
        if (!isPreferredDialectValid) {
          isValid = false; // Mark as invalid if language level is not valid
        }
        break;
      case 3:
        const isNativeLanguageValid = await methods.trigger('nativeLanguage');
        if (!isNativeLanguageValid) {
          isValid = false; // Mark as invalid if language level is not valid
        }
        break;
      // Add more cases for other steps if needed
    }

    if (isValid) {
      switch (step) {
        case 0:
          setStep(1);
          break;
        case 1:
          if (dialectOptions?.length) {
            setStep(10);
          } else {
            setStep(step + 1);  
          }
          break;
        case 10:
          setStep(2);
          break;
        case 4:
          methods.handleSubmit(handleSave)();
          break;
        default:
          setStep(step + 1);
          break;
      }
    }
  };

  const handleLearningLanguageChange = (value: string) => {
    console.log('handleLearningLanguageChange: ', value);
    if (!initialLoad) {
      // methods.setValue('preferredDialect', null); // Set to null or default based on your logic
    }
    // methods.setValue('preferredDialect', null);

    // Check if the selected language is untested
    if (!Object.keys(AVAILABLE_LANGUAGES).includes(value)) {
      if (value === 'chinese' || value === 'japanese') {
        setWarningMessage('Heads up: we\'re working on getting the app to work flawlessly with this language. For now, we recommend using the website.');
      } else if (value === 'thai') {
        setWarningMessage('This language isn\'t fully supported at this time (e.g. no transliteration).');
      } else {
        setWarningMessage(null);
      }
    } else {
      setWarningMessage(null);
    }
  };

  const handleSave = async (data:any) => {
    console.log(selectedDays);
    const updatedSettings: Partial<UserSettings> = {
      user: {
        first_name: data.firstName,
      } as any,
      team: {
        stream_language: data.learningLanguage,
        stream_language_level: data.languageLevel,
        preferred_dialect: data.preferredDialect,
        langua_native_language: data.nativeLanguage,
        day_streak: selectedDays,
        stream_onboarding_complete: true,
        stream_onboarding_completed_at: new Date().toISOString()
      } as any,
    };

    try {
      await updateUserSettings(updatedSettings);
      await AsyncStorage.setItem('onboardingCompleted', 'true');

      router.replace('/(tabs)/speak');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      // Optionally handle the error in the UI
      Alert.alert(
        'Error',
        'Failed to complete onboarding. Please try again.'
      );
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            {/* <ThemedText className="font-medium mb-1 text-gray-700 dark:text-gray-300" type="default">What's your first name?</ThemedText> */}
            <FirstNameInput control={methods.control}/>
          </>
        );
      case 1:
        return (
          <>
            <LearningLanguagePicker control={methods.control} rules={{ required: 'Learning language is required' }} onValueChange={handleLearningLanguageChange} />
            {warningMessage && (
              <View className="flex-row items-center mt-2">
                <View style={{ backgroundColor: '#FFB545', borderRadius: 12, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>!</Text>
                </View>
                <Text className="text-gray-500 dark:text-gray-100 ml-2">{warningMessage}</Text>
              </View>
            )}
          </>
        );
      case 10:
        return (
          <LanguageDialectPicker onValueChange={() => null} control={methods.control} dialectOptions={dialectOptions} rules={{ required: 'Dialect is required' }}/>
        );
      case 2:
        return (
          <>
            <ThemedText className="text-lg font-medium mb-4">What's your current level?</ThemedText>
            {LEVELS_OPTIONS_ARRAY.map((option) => (
              <TouchableOpacity
                key={option.value}
                className={`mb-4 p-4 rounded-lg border ${
                  languageLevel === option.value 
                    ? 'border-blue-400 dark:border-blue-300'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
                style={{
                  backgroundColor: languageLevel === option.value 
                    ? isDark ? 'rgba(96, 165, 250, 0.05)' : '#EFF6FF'
                    : 'transparent',
                }}
                onPress={() => {
                  if (languageLevel === option.value) {
                    methods.setValue('languageLevel', '');
                  } else {
                    methods.setValue('languageLevel', option.value);
                  }
                }}
              >
                <View className="flex-row items-center">
                  <View 
                    className="w-6 h-6 rounded-full border-2 mr-3 items-center justify-center"
                    style={{
                      borderColor: languageLevel === option.value 
                        ? isDark ? '#93C5FD' : '#3B82F6'
                        : isDark ? '#4B5563' : '#D1D5DB',
                    }}
                  >
                    {languageLevel === option.value && (
                      <View className="w-3 h-3 rounded-full bg-blue-400 dark:bg-blue-300" />
                    )}
                  </View>
                  <View className='flex-1'>
                    <Text className={`font-medium text-base ${
                      languageLevel === option.value 
                        ? 'text-blue-500 dark:text-blue-300'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {option.label}
                    </Text>
                    <Text className={`mt-2 pr-8 ${
                      languageLevel === option.value 
                        ? 'text-blue-500 dark:text-blue-300'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {LANGUAGE_LEVEL_DESCRIPTIONS[option.value as keyof typeof LANGUAGE_LEVEL_DESCRIPTIONS]}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        );
      case 3:
        return (
          <NativeLanguagePicker onValueChange={() => null} control={methods.control} rules={{ required: 'Native language is required' }} />
        );
      case 4:
        return (
          <>
            <ThemedText className="font-medium mb-2 text-gray-700 dark:text-gray-300" type="default">
              Practising a little every day is ideal to make consistent progress. But feel free to remove practice days below.
            </ThemedText>
            <View className="flex-row flex-wrap justify-between">
              {DAYS_OF_WEEK_ARRAY.map(({value:dayValue, label}) => (
                <TouchableOpacity
                  key={dayValue}
                  className={cx('justify-center items-center rounded-full mb-4', {
                    'w-12 h-12': !isTablet,
                    'w-24 h-24': isTablet,
                    'bg-peach-500': selectedDays.includes(dayValue),
                    'bg-white': !selectedDays.includes(dayValue),
                  })}
                  onPress={() => {
                    if (selectedDays.includes(dayValue)) {
                      setSelectedDays(selectedDays.filter((d) => d !== dayValue));
                    } else {
                      setSelectedDays([...selectedDays, dayValue]);
                    }
                  }}
                >
                  <Text style={GlobalFontStyleSheet.textBase} className={cx('font-bold',{
                    'text-white': selectedDays.includes(dayValue),
                    'text-gray-900': !selectedDays.includes(dayValue)
                    })
                  }>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );
    }
  };

  return (
    <FormProvider {...methods}>
      <ThemedView className="flex-1 bg-white dark:bg-gray-900">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
          {renderStep()}
          <View className="flex-row justify-between mt-4">
            {step > 0 && (
              <Pressable
                className={cx('p-4 bg-gray-100 dark:bg-gray-700 rounded-lg items-center shadow-sm flex-1 mr-2')}
                onPress={handleBack}
              >
                <ThemedText type="default" className="text-gray-700 dark:text-white font-medium">
                  Back
                </ThemedText>
              </Pressable>
            )}
            <Pressable
              className={cx(
                'bg-white dark:bg-gray-500 p-4 rounded-lg items-center shadow-sm flex-1',
                { 'bg-blue-500': step === 4 },
                { 'ml-2': step > 0 },
              )}
              onPress={handleNext}
            >
              <ThemedText 
              type='default'
                className={cx(
                  'text-gray-500 dark:text-white font-medium',
                  { 'text-white': step === 4 }
                )}
              >
                {step === 4 ? 'Finish' : 'Next'}
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </ThemedView>
    </FormProvider>
  );
}

