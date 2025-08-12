import React, { useState, useContext } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { getFontSize } from '@/constants/Font';
import {
  LANGUAGE_FLAGS,
  DIALECT_FLAGS,
  LEARNING_LANGUAGES_ARRAY,
} from '@/constants/Lists';
import { UserSettingsContext, UserSettings } from '@/contexts/UserSettingsContext';
import LanguageSwitcherModal from './LanguageSwitcherModal';
import * as Haptics from 'expo-haptics';

export default function SpeakHeaderCenter() {
  const colorScheme = useColorScheme();
  const { userSettings, updateUserSettings } = useContext(UserSettingsContext)!;
  const [showLanguageSwitcher, setShowLanguageSwitcher] = useState(false);

  // Helper function to get current language flag
  const getLanguageFlag = () => {
    const language = userSettings?.team.stream_language || 'english';
    const dialect = userSettings?.team.preferred_dialect;
    
    if (dialect && DIALECT_FLAGS[dialect as keyof typeof DIALECT_FLAGS]) {
      return DIALECT_FLAGS[dialect as keyof typeof DIALECT_FLAGS];
    }
    return LANGUAGE_FLAGS[language as keyof typeof LANGUAGE_FLAGS] || '🌐';
  };

  // Helper function to get language display name
  const getLanguageDisplayName = () => {
    const language = userSettings?.team.stream_language || 'english';
    const langOption = LEARNING_LANGUAGES_ARRAY.find(l => l.value === language);
    return langOption?.label || 'English';
  };

  // Handle language change
  const handleLanguageChange = async (newLanguage: string, newDialect?: string, newLevel?: string) => {
    try {
      // Update user settings with new language, dialect, and level
      const updatedSettings: Partial<UserSettings> = {
        team: {
          ...userSettings?.team,
          stream_language: newLanguage,
          ...(newDialect ? { preferred_dialect: newDialect } : {}),
          ...(newLevel ? { stream_language_level: newLevel } : {})
        }
      };
      
      await updateUserSettings(updatedSettings);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowLanguageSwitcher(true);
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.languageButton,
          { backgroundColor: `${Colors[colorScheme ?? 'light'].tint}20` }
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Text style={[styles.languageButtonText, { color: Colors[colorScheme ?? 'light'].text }]}>
          {getLanguageFlag()} {getLanguageDisplayName()}
        </Text>
        <FontAwesome6 
          name="chevron-down" 
          size={10} 
          color={Colors[colorScheme ?? 'light'].text} 
          style={styles.chevron}
        />
      </TouchableOpacity>

      <LanguageSwitcherModal
        visible={showLanguageSwitcher}
        onClose={() => setShowLanguageSwitcher(false)}
        currentLanguage={userSettings?.team.stream_language || 'english'}
        currentDialect={userSettings?.team.preferred_dialect}
        currentLanguageLevel={userSettings?.team.stream_language_level}
        onLanguageChange={handleLanguageChange}
      />
    </>
  );
}

const styles = StyleSheet.create({
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 100,
    justifyContent: 'center',
  },
  languageButtonText: {
    fontSize: getFontSize(14),
    fontWeight: '500',
    marginRight: 4,
  },
  chevron: {
    marginTop: 1,
  },
});
