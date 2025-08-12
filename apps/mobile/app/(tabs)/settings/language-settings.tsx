import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, Platform } from 'react-native';
import { useForm, FormProvider, Controller } from 'react-hook-form'; // Import necessary hooks
import { ThemedText } from '@/components/shared/ThemedText';
import { ThemedView } from '@/components/shared/ThemedView';
import useUserSettings from '@/services/api/useUserSettings';
import { UserSettings } from '@/contexts/UserSettingsContext';
import Notification from '@/components/Notification';
import { LANGUAGE_DIALECTS } from '@/constants/Lists';
import { FLASCARDS_ORDERING_TECHNIQUES } from '@/constants/Lists';
import { LearningLanguagePicker, LanguageDialectPicker, NativeLanguagePicker, LearningLevelPicker, fieldLookupTable, SettingsPicker } from '@/components/shared/SettingsForms';
import { AVAILABLE_LANGUAGES } from '@/constants/Lists';
import { LANGUAGE_LEVEL_DESCRIPTIONS } from '@/constants/Lists';

export default function LanguageSettingsScreen() {
  const { userSettings, loading, error, successMessage, updateUserSettings } = useUserSettings();
    // Create separate form contexts for each picker
    const learningLanguageMethods = useForm({mode: 'onChange', defaultValues: {learningLanguage: userSettings?.team.stream_language || ''}});
    const dialectMethods = useForm({mode: 'onChange', defaultValues: {preferredDialect: userSettings?.team.preferred_dialect || ''}});
    const nativeLanguageMethods = useForm({mode: 'onChange', defaultValues: {nativeLanguage: userSettings?.team.langua_native_language || ''}});
    const languageLevelMethods = useForm({mode: 'onChange', defaultValues: {languageLevel: userSettings?.team.stream_language_level || ''}});
    const flashcardsOrderingMethods = useForm({mode: 'onChange', defaultValues: {flashcardsOrdering: userSettings?.team.flashcards_ordering_technique || ''}});

  const learningLanguage = learningLanguageMethods.watch("learningLanguage"); // Watch the learning language value
  const languageLevel = languageLevelMethods.watch("languageLevel"); // Add this line to watch language level

  const dialectOptions = learningLanguage && learningLanguage in LANGUAGE_DIALECTS 
      ? LANGUAGE_DIALECTS[learningLanguage as keyof typeof LANGUAGE_DIALECTS] 
      : null;

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

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
    // Check if the language is untested
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

  const handleChange = async (field: string, value: string) => {
    // Check if the value is different before updating
    let currentValue = '';
    switch (field) {
      case 'learningLanguage':
        currentValue = await learningLanguageMethods.getValues(field);
        break;
      case 'preferredDialect':
        currentValue = await dialectMethods.getValues(field);
        break;
      case 'nativeLanguage':
        currentValue = await nativeLanguageMethods.getValues(field);
        break;
      case 'languageLevel':
        currentValue = await languageLevelMethods.getValues(field);
        break;
      case 'flashcardsOrdering':
        currentValue = await flashcardsOrderingMethods.getValues(field);
        break;
    }
    if (currentValue !== value) {
      // field lookup table
      const fieldLookup = fieldLookupTable[field as keyof typeof fieldLookupTable];
      console.log('fieldLookup:', fieldLookup);
      const updatedSettings: Partial<UserSettings> = {
        team: {
          [fieldLookup]: value,
        } as Partial<UserSettings['team']>,
      };
      updateUserSettings(updatedSettings);

      // Check if the selected language is untested
      if (field === 'learningLanguage' && !Object.keys(AVAILABLE_LANGUAGES).includes(value)) {
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
    }
  };

  if (loading && !userSettings) {
    return <ThemedView className="flex-1 justify-center items-center"><ThemedText>Loading...</ThemedText></ThemedView>;
  }

  return (
    <ThemedView className="flex-1 bg-white">
      <ScrollView className="p-5">
        <View className="pb-5">
          <View className="mb-3">
            <FormProvider {...learningLanguageMethods}>
              <LearningLanguagePicker  rules={{ required: 'Learning language is required' }} onValueChange={(value) => handleChange('learningLanguage', value)} control={learningLanguageMethods.control} label="I'm learning" />
              {warningMessage && (
                <View className="flex-row items-center mt-2">
                  <View style={{ backgroundColor: '#FFB545', borderRadius: 12, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>!</Text>
                  </View>
                  <Text className="text-gray-500 dark:text-gray-100 ml-2">{warningMessage}</Text>
                </View>
              )}
            </FormProvider>
          </View>

          {/* will return null if learningLanguage does not match a language_dialect */}
          { dialectOptions?.length && (
            <View className="mb-3">
              <FormProvider {...dialectMethods}>
                <LanguageDialectPicker rules={{ required: 'Dialect is required' }} dialectOptions={dialectOptions} control={dialectMethods.control} label="Preferred Dialect" onValueChange={(value) => handleChange('preferredDialect', value)}/>
              </FormProvider>
            </View>
          )}
          
          <View className="mb-3">
            <FormProvider {...nativeLanguageMethods}>
              <NativeLanguagePicker rules={{ required: 'Native language is required' }} control={nativeLanguageMethods.control} label="Show translations in" onValueChange={(value) => handleChange('nativeLanguage', value)} />
            </FormProvider>
          </View>

          <View className="mb-5">
            <FormProvider {...languageLevelMethods}>
              <LearningLevelPicker 
                rules={{ required: 'Language level is required' }} 
                control={languageLevelMethods.control} 
                label="My level" 
                onValueChange={(value) => handleChange('languageLevel', value)}
              />
              {languageLevel && (
                <Text className="text-gray-500 dark:text-gray-100 mt-2 ml-2">
                  {LANGUAGE_LEVEL_DESCRIPTIONS[languageLevel as keyof typeof LANGUAGE_LEVEL_DESCRIPTIONS]}
                </Text>
              )}
            </FormProvider>
          </View>

          <View className="mb-3">
            <FormProvider {...flashcardsOrderingMethods}>
              <Controller
                control={flashcardsOrderingMethods.control}
                name="flashcardsOrdering"
                render={({ field: { onChange, value } }) => (
                  <SettingsPicker
                    selectedValue={value}
                    onValueChange={(value) => {
                      handleChange('flashcardsOrdering', value);
                      onChange(value);
                    }}
                    items={Object.entries(FLASCARDS_ORDERING_TECHNIQUES).map(([label, value]) => ({ label, value }))}
                    label="Flashcard ordering mode"
                    placeholderLabel='Select ordering mode'
                  />
                )}
              />
            </FormProvider>
          </View>
          
        </View>
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
