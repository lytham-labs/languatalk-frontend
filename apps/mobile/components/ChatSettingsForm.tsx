import React, { useState, useEffect, useMemo } from 'react';
import { ScrollView, View, Pressable, Modal, FlatList, Switch, Alert, Platform, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/shared/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { UserSettings, UserSettings as UserSettingsProps } from '@/contexts/UserSettingsContext';
import { MutableChatSettingsData } from '@/types/chat';
import { SettingsPicker } from '@/components/shared/SettingsForms';
import { Ionicons } from '@expo/vector-icons';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { Text } from 'react-native';
import useUserSettings from '@/services/api/useUserSettings';
import SpeedSlider from '@/components/shared/SpeedSlider';
import VoiceSlider from '@/components/shared/VoiceSlider';
import { SPEED_MULTIPLIER, AUTO_SEND_THRESHOLD } from '@/constants/Lists';
import Animated, { withTiming, useAnimatedStyle, FadeIn, FadeOut } from 'react-native-reanimated';

interface ChatSettingsFormProps {
  hideMode?: boolean;
  hideVoice?: boolean;
  disableGuidedMode?: boolean;
  showTranscriptionMode?: boolean;
  showAutoSend?: boolean;
  showAdvancedSettings?: boolean;
  initialChatSettings: MutableChatSettingsData;
  initialChatOptions: UserSettingsProps['chat_form_options'];
  onSettingChange: (field: string, value: string | boolean) => void;
  isJapaneseReadingAidFlagged?: boolean;
}

export default function ChatSettingsForm({ 
  hideVoice, 
  hideMode, 
  disableGuidedMode = false,
  showTranscriptionMode = true,
  showAutoSend = true,
  showAdvancedSettings = false,
  initialChatSettings, 
  initialChatOptions, 
  onSettingChange,
  isJapaneseReadingAidFlagged = false,
}: ChatSettingsFormProps) {
  const { userSettings, updateUserSettings } = useUserSettings();
  const [localChatSettings, setLocalChatSettings] = useState(initialChatSettings);
  const [localChatOptions, setLocalChatOptions] = useState(initialChatOptions);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textColor = isDark ? Colors.dark.text : Colors.light.text;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [defaultSpeedMultiplier, setDefaultSpeedMultiplier] = useState<number>(SPEED_MULTIPLIER.normal);
  const [defaultVoiceThreshold, setDefaultVoiceThreshold] = useState<number>(AUTO_SEND_THRESHOLD.normal); // Default voice level
  const [isGuidedModeReplyVisible, setIsGuidedModeReplyVisible] = useState(false);
  useEffect(() => {
    if (userSettings) {
      // Set default speed_multiplier if it's null

        const isBeginnerLevel = userSettings.team.stream_language_level === 'beginner' 
        if (isBeginnerLevel) {
          setDefaultSpeedMultiplier(SPEED_MULTIPLIER.slow);
        } else {
          setDefaultSpeedMultiplier(SPEED_MULTIPLIER.normal);
        }

        if (userSettings.team.stream_language_level === 'beginner' || userSettings.team.stream_language_level === 'basic') {
          setDefaultVoiceThreshold(AUTO_SEND_THRESHOLD.normal);
        } else {
          setDefaultVoiceThreshold(AUTO_SEND_THRESHOLD.fast);
        }
        // Enable guided mode toggle for all language levels
        setIsGuidedModeReplyVisible(true);
    }
  }, [userSettings]);
  useEffect(() => {
    setLocalChatSettings(initialChatSettings);
    setLocalChatOptions(initialChatOptions);
  }, [initialChatSettings, initialChatOptions]);

  const handleLocalChange = (field: string, value: string | boolean) => {
    setLocalChatSettings(prev => ({ ...prev, [field]: value }));
    onSettingChange(field, value);
  };

  const voiceSettingOptions = useMemo(() => {
    if (!localChatOptions.voice_options) {
      return [];
    }
    return Object.entries(localChatOptions.voice_options).map(([label, value]) => {
      return { label, value };
    });
  }, [localChatOptions.voice_options]);

  const modeOptions = useMemo(() => {
    if (!localChatOptions.mode_options) {
      return [];
    }
    return Object.entries(localChatOptions.mode_options).map(([label, value]) => {
      return { label, value };
    });
  }, [localChatOptions.mode_options]);

  const aiModelOptions = useMemo(() => {
    if (!localChatOptions.ai_model_options) {
      return [];
    }
    if (Array.isArray(localChatOptions.ai_model_options)) {
      return localChatOptions.ai_model_options.map(([label, value]: [string, string]) => {
        return { label, value };
      });
    } else {  
      return Object.entries(localChatOptions.ai_model_options).map(([value, label]) => {
        return { label, value };
      });
    }
  }, [localChatOptions.ai_model_options]);

  const transcriptionModeOptions = useMemo(() => {
    if (!localChatOptions.transcription_mode_options) {
      return [];
    }
    if (Array.isArray(localChatOptions.transcription_mode_options)) {
      return localChatOptions.transcription_mode_options.map(([label, value]: [string, string]) => {
        return { label, value };
      });
    } else {
      return Object.entries(localChatOptions.transcription_mode_options).map(([value, label]) => {
        return { label, value };
      });
    }
  }, [localChatOptions.transcription_mode_options]);

  const pronunciationOptions = useMemo(() => {
    if (!localChatOptions.pronunciation_options) {
      return [];
    }
    return localChatOptions.pronunciation_options.map(([label, value]: [string, string]) => {
      return { label, value };
    });
  }, [localChatOptions.pronunciation_options]);

  // Determine current correction mode based on auto_correct and repeat_corrections values
  const getCurrentCorrectionMode = () => {
    if (localChatSettings.auto_correct && !localChatSettings.repeat_corrections) {
      return 'written';
    } else if (!localChatSettings.auto_correct && localChatSettings.repeat_corrections) {
      return 'verbal';
    } else {
      return 'off';
    }
  };

  // Handle correction mode change
  const handleCorrectionModeChange = (mode: string) => {
    let autoCorrect = false;
    let repeatCorrections = false;
    
    switch (mode) {
      case 'written':
        autoCorrect = true;
        repeatCorrections = false;
        break;
      case 'verbal':
        autoCorrect = false;
        repeatCorrections = true;
        break;
      case 'off':
      default:
        autoCorrect = false;
        repeatCorrections = false;
        break;
    }

    handleLocalChange('auto_correct', autoCorrect);
    handleLocalChange('repeat_corrections', repeatCorrections);
  };

  return (
    <ScrollView className="bg-white dark:bg-gray-800"> 
      <View className="p-5">
        {/* Core Settings Group */}
        {!hideVoice && (
          <View className="my-4 space-y-2">
            <SettingsPicker
              selectedValue={localChatSettings.voice || ''}
              items={voiceSettingOptions}
              onValueChange={(value) => handleLocalChange('voice', value)}
              label="Who do you want to chat with?"
              placeholderLabel=''
            />
          </View>
        )}

        <SpeedSlider
          value={localChatSettings?.speed_multiplier || defaultSpeedMultiplier}
          onChange={(value) => handleLocalChange('speed_multiplier', value)}
          subLabel="Applies to new replies"
        />

        {/* Pronunciation Characters */}
        { isJapaneseReadingAidFlagged && pronunciationOptions.length > 0 && (
        <View className="my-3">
          <SettingsPicker
            selectedValue={localChatSettings.pronunciation_characters}
            items={pronunciationOptions}
            onValueChange={(value) => handleLocalChange('pronunciation_characters', value)}
            label="Pronunciation characters"
            placeholderLabel=''
          />
        </View>
        )}

        {showTranscriptionMode && (
          <View className="my-3">
            <SettingsPicker
                  selectedValue={localChatSettings.transcription_mode}
                  items={transcriptionModeOptions}
                  onValueChange={(value) => handleLocalChange('transcription_mode', value)}
                  label="Tech to transcribe what you say"
              placeholderLabel=''
            />
          </View>
        )}

        {Platform.OS === 'ios' && (
          <View className="my-3">
            <SettingsPicker
              selectedValue={localChatSettings.highlight_mode}
              items={[
                { label: 'Full sentence', value: 'sentence' },
                { label: 'Word by word', value: 'word' },
                { label: 'Off', value: 'off' }
              ]}
              onValueChange={(value) => handleLocalChange('highlight_mode', value)}
              label="Highlight spoken words or sentences?"
              placeholderLabel=''
            />
          </View>
        )}

        {/* Auto Settings Group */}
        <View className="mb-4 mt-6">
          {isGuidedModeReplyVisible && (
            <View className={`mb-3 ${disableGuidedMode ? 'opacity-50' : ''}`}>
              <View className="flex-row items-center justify-between">
                <ThemedText style={{ color: textColor }} className="text-base font-semibold">Guided mode?</ThemedText>
                <Switch
                  value={localChatSettings.guided_mode}
                  onValueChange={(value) => handleLocalChange('guided_mode', value)}
                  disabled={disableGuidedMode}
                />
              </View>
              <Text className="text-md text-gray-500 dark:text-gray-400 mt-1">
                {disableGuidedMode ? "Disabled for this chat" : "AI will guide you through the conversation"}
              </Text>
            </View>
          )}
          <View className="mb-3">
            <View className="flex-row items-center justify-between">
              <ThemedText style={{ color: textColor }} className="text-base font-semibold">Auto-record?</ThemedText>
              <Switch
                value={localChatSettings.auto_record}
                onValueChange={(value) => handleLocalChange('auto_record', value)}
              />
            </View>
            <Text className="text-md text-gray-500 dark:text-gray-400 mt-1">
              Starts after AI replies
            </Text>
          </View>

          {showAutoSend && (
            <View className="mb-3">
              <View className="flex-row items-center justify-between">
                <ThemedText style={{ color: textColor }} className="text-base font-semibold">Auto-send?</ThemedText>
                <Switch
                  value={localChatSettings.auto_send}
                  onValueChange={(value) => handleLocalChange('auto_send', value)}
                />
              </View>
              <Text className="text-md text-gray-500 dark:text-gray-400 mt-1">
                After a few secs of silence
              </Text>

              {localChatSettings.auto_send && (
                  <Animated.View 
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(200)}
                    className="mt-3"
                  >
                    <VoiceSlider
                      value={localChatSettings?.auto_send_threshold || defaultVoiceThreshold}
                      onChange={(value) => handleLocalChange('auto_send_threshold', value)}
                    />
                  </Animated.View>
                )}
            </View>
          )}

          <View className="mb-3 mt-4 opacity-50">
            <SettingsPicker
              selectedValue={getCurrentCorrectionMode()}
              items={[
                { label: 'Off', value: 'off' },
                { label: 'Written corrections', value: 'written' },
                { label: 'Verbal corrections, asking to repeat', value: 'verbal' }
              ]}
              onValueChange={handleCorrectionModeChange}
              label="Auto-correct?"
              placeholderLabel=''
              labelRight={() => <Text className="text-red-500 text-lg font-semibold ml-1">*</Text>}
              disabled={true}
            />
            {getCurrentCorrectionMode() === 'verbal' && (
              <Text className="text-md text-gray-500 dark:text-gray-400 mt-1">
                Verbal only works in certain chat categories
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={() => setShowAdvanced(!showAdvanced)}
            activeOpacity={0.6}
            className="flex-row items-center justify-between py-2 mb-2 mt-5"
          >
            <ThemedText style={{ color: textColor }} className="font-semibold text-base">Show advanced settings</ThemedText>
            <Ionicons 
              name={showAdvanced ? "chevron-up" : "chevron-down"} 
              size={24} 
              color={textColor} 
            />
          </TouchableOpacity>

       

          {showAdvanced && (
            <View className="ml-2 mt-5">
              <View className="mb-3">
                <SettingsPicker
                  selectedValue={localChatSettings.ai_model}
                  items={aiModelOptions}
                  onValueChange={(value) => handleLocalChange('ai_model', value)}
                  label="AI model"
                  placeholderLabel=''
                />
              </View>

              {showAdvancedSettings && (
                <>
                  <View className="mb-3 opacity-50">
                    <SettingsPicker
                    selectedValue={localChatSettings.mode}
                    items={modeOptions}
                    onValueChange={(value) => handleLocalChange('mode', value)}
                    label="Choose a mode"
                      placeholderLabel=''
                      labelRight={() => <Text className="text-red-500 text-lg font-semibold ml-1">*</Text>}
                      disabled={true}
                    />
                  </View>
                </>
              )}
              
              <View className="mb-3 opacity-50">
                <SettingsPicker
                  selectedValue={localChatSettings.auto_translate}
                  items={[
                    { label: 'Off', value: 'off' },
                    { label: 'Translate verbally (increases latency)', value: 'verbal' },
                    { label: 'Show translated text', value: 'written' }
                  ]}
                  onValueChange={(value) => handleLocalChange('auto_translate', value)}
                  label="Auto-translate"
                  placeholderLabel=''
                  labelRight={() => <Text className="text-red-500 text-lg font-semibold ml-1">*</Text>}
                  disabled={true}
                />
              </View>


              {showAdvancedSettings && (
                <>
                  <View className="space-y-2 mt-5 opacity-50">
                    <View className="mb-3">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <ThemedText style={{ color: textColor }} className="text-base font-semibold">Don't always ask me a Q</ThemedText>
                            <Text className="text-red-500 text-lg font-semibold ml-1">*</Text>
                        </View>
                        <Switch
                          value={localChatSettings.do_not_ask_questions}
                          onValueChange={(value) => handleLocalChange('do_not_ask_questions', value)}
                          disabled={true}
                        />
                      </View>
                      <Text className="text-md text-gray-500 dark:text-gray-400 mt-1">
                        Applies in certain chats
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          )}
          {/* Explanation Footer */}
          <View className="mt-4 flex-row items-start">
            <Text className="text-red-500 text-lg font-semibold mr-1">*</Text>
            <Text className="text-sm text-gray-500 dark:text-white flex-1">
              Settings with an asterisk can't be updated during this chat.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
