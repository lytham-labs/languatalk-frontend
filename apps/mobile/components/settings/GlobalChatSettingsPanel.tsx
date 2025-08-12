import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ScrollView, View, Switch, Platform, Pressable, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/shared/ThemedText';
import { ThemedView } from '@/components/shared/ThemedView';
import useUserSettings from '@/services/api/useUserSettings';
import Notification from '@/components/Notification';
import { Colors } from '@/constants/Colors';
import { SettingsPicker } from '@/components/shared/SettingsForms';
import { useColorScheme } from '@/hooks/useColorScheme';
import { UserSettings, UserSettings as UserSettingsProps } from '@/contexts/UserSettingsContext';
import { Ionicons } from '@expo/vector-icons';
import { GlobalFontStyleSheet } from '@/constants/Font';
import SpeedSlider from '@/components/shared/SpeedSlider';
import VoiceSlider from '@/components/shared/VoiceSlider';
import { SPEED_MULTIPLIER, AUTO_SEND_THRESHOLD } from '@/constants/Lists';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withTiming, useSharedValue } from 'react-native-reanimated';
import { ELEVENLABS_CHAT_VOICE_OPTIONS, OPENAI_VOICE_OPTIONS } from '@/constants/VoiceOptions';
import { useFeatureFlag } from 'posthog-react-native';

interface GlobalChatSettingsPanelProps {
  showTranscriptionMode?: boolean;
  showAutoSend?: boolean;
  showAdvancedSettings?: boolean;
  onSettingsChange?: (settings: UserSettings['team']['chat_settings']) => void;
  initialSettings?: UserSettings['team']['chat_settings'];
  onCloseModal?: () => void;
  isJapaneseReadingAidFlagged?: boolean;
}

export default function GlobalChatSettingsPanel({
  showTranscriptionMode = true,
  showAutoSend = true,
  showAdvancedSettings = true,
  onSettingsChange,
  initialSettings,
  isJapaneseReadingAidFlagged = false,
}: GlobalChatSettingsPanelProps) {
  const { userSettings, loading, error, successMessage, updateUserSettings } = useUserSettings();
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textColor = isDark ? Colors.dark.text : Colors.light.text;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [voiceProvider, setVoiceProvider] = useState<'v1' | 'v2'>('v1'); 
  const [sliderWidth, setSliderWidth] = useState(0);
  const isMemoryEnabled = useFeatureFlag('use_memories');

  const translateX = useSharedValue(0);
  const animatedWidth = useSharedValue(0);
  const sliderInitialized = useSharedValue(false);

  useEffect(() => {
    if (sliderWidth > 0) {
      animatedWidth.value = sliderWidth / 2;
      const targetX = voiceProvider === 'v1' ? 0 : sliderWidth / 2;

      if (!sliderInitialized.value) {
        translateX.value = targetX; // Snap to position initially
        sliderInitialized.value = true;
      } else {
        translateX.value = withTiming(targetX, { duration: 250 }); // Animate for subsequent changes
      }
    } else {
      animatedWidth.value = 0;
      translateX.value = 0; 
      sliderInitialized.value = false; // Reset when hidden
    }
  }, [sliderWidth, voiceProvider, translateX, animatedWidth, sliderInitialized]);

  const animatedIndicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      width: animatedWidth.value,
    };
  });

  // State initialization
  const [localChatSettings, setLocalChatSettings] = useState(initialSettings || userSettings?.team.chat_settings);
  const [localChatOptions, setLocalChatOptions] = useState(userSettings?.chat_form_options);
  const [defaultSpeedMultiplier, setDefaultSpeedMultiplier] = useState<number>(SPEED_MULTIPLIER.normal);
  const [defaultVoiceThreshold, setDefaultVoiceThreshold] = useState<number>(AUTO_SEND_THRESHOLD.normal); // Default voice level
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
      
      // Only set localChatSettings if initialSettings is not provided
      if (!initialSettings) {
        setLocalChatSettings(userSettings.team.chat_settings);
      }
      
      setLocalChatOptions(userSettings.chat_form_options);
    }
  }, [userSettings, onSettingsChange, initialSettings]);

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

  const handleChange = useCallback((field: string, value: string | boolean | number) => {
    if (localChatSettings && userSettings) {
      // Only update if the value is actually different
      if (localChatSettings[field as keyof typeof localChatSettings] === value) {
        return; // Skip update if value hasn't changed
      }
      
      const updatedChatSettings = {
        ...localChatSettings,
        [field]: value,
      };
      setLocalChatSettings(updatedChatSettings);
      const updatedSettings: Partial<UserSettingsProps> = {
        team: {
          ...userSettings.team,
          chat_settings: updatedChatSettings,
        },
      };
      updateUserSettings(updatedSettings);
      
      // Notify parent component of settings changes
      if (onSettingsChange) {
        onSettingsChange(updatedChatSettings);
      }
    }
  }, [localChatSettings, userSettings, updateUserSettings, onSettingsChange, setLocalChatSettings]);

  const handleTeamSettingChange = useCallback((field: string, value: string | boolean | number) => {
    if (userSettings) {
      // Only update if the value is actually different
      if (userSettings.team[field as keyof typeof userSettings.team] === value) {
        return; // Skip update if value hasn't changed
      }
      
      const updatedSettings: Partial<UserSettingsProps> = {
        team: {
          ...userSettings.team,
          [field]: value,
        },
      };
      updateUserSettings(updatedSettings);
    }
  }, [userSettings, updateUserSettings]);

  if (loading && !localChatSettings) {
    return (
      <ThemedView className="flex-1 justify-center items-center">
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  if (!localChatSettings || !localChatOptions) {
    return (
      <ThemedView className="flex-1 justify-center items-center">
        <ThemedText>No settings available</ThemedText>
      </ThemedView>
    );
  }

  const voiceSettingOptions = useMemo(() => {
    if (localChatSettings?.mode === "call_mode") {
      const targetLanguage = userSettings?.team.stream_language;
      if (targetLanguage) {
        const selectedProviderMap = voiceProvider === 'v1' ? OPENAI_VOICE_OPTIONS : ELEVENLABS_CHAT_VOICE_OPTIONS;
        
        let languageVoices = selectedProviderMap[targetLanguage.toLowerCase()];

        if (!languageVoices && voiceProvider === 'v2' && selectedProviderMap['default']) {
          languageVoices = selectedProviderMap['default'];
        }
        if (!languageVoices && voiceProvider === 'v1') {
          languageVoices = selectedProviderMap['english'] || selectedProviderMap[Object.keys(selectedProviderMap)[0]];
        }
        if (!languageVoices && voiceProvider === 'v2') { // Broader fallback for ElevenLabs
          languageVoices = selectedProviderMap['english'] || selectedProviderMap[Object.keys(selectedProviderMap)[0]];
        }
  
        if (languageVoices) {
          return Object.entries(languageVoices).map(([label, value]) => ({ label, value }));
        }
      }
      return []; // No language or no voices for provider/language
    }
  
    // Existing logic for non-call_mode
    if (!localChatOptions?.voice_options) {
      return [];
    }
    return Object.entries(localChatOptions.voice_options).map(([label, value]) => ({ label, value }));
  }, [localChatSettings?.mode, voiceProvider, userSettings?.team.stream_language, localChatOptions?.voice_options]);

  useEffect(() => {
    if (!localChatSettings) return;

    if (voiceSettingOptions.length > 0) {
      const currentVoiceIsValid = voiceSettingOptions.some(opt => opt.value === localChatSettings.voice);
      if (!currentVoiceIsValid) {
        handleChange("voice", voiceSettingOptions[0].value);
      }
    } else if (localChatSettings.voice && localChatSettings.voice !== "") {
      handleChange("voice", "");
    }
  }, [voiceSettingOptions, handleChange, localChatSettings]);

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
    return Object.entries(localChatOptions.ai_model_options).map(([value, label]) => {
      return { value, label };
    });
  }, [localChatOptions.ai_model_options]);

  const transcriptionModeOptions = useMemo(() => {
    if (!localChatOptions.transcription_mode_options) {
      return [];
    }
    return Object.entries(localChatOptions.transcription_mode_options).map(([value, label]) => {
      return { value, label };
    });
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
    if (localChatSettings && userSettings) {
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

      const updatedChatSettings = {
        ...localChatSettings,
        auto_correct: autoCorrect,
        repeat_corrections: repeatCorrections,
      };
      
      setLocalChatSettings(updatedChatSettings);
      const updatedSettings: Partial<UserSettings> = {
        team: {
          ...userSettings.team,
          chat_settings: updatedChatSettings,
        },
      };
      updateUserSettings(updatedSettings);
      
      if (onSettingsChange) {
        onSettingsChange(updatedChatSettings);
      }
    }
  };

  return (
    <ThemedView className="flex-1">
      <ScrollView className="bg-white dark:bg-gray-800">
        <View className="p-5">
          <View className="mb-3">
            <SettingsPicker
              selectedValue={localChatSettings.mode}
              items={modeOptions}
              onValueChange={(value) => handleChange("mode", value)}
              label="Choose a mode"
              placeholderLabel=""
              labelRight={() => (
                <Text className="text-red-500 text-lg font-semibold ml-1">
                  *
                </Text>
              )}
            />
            {localChatSettings.mode === "call_mode" && (
              <Text className="text-sm text-gray-500 dark:text-white mt-1 ml-1">
                Low latency hands-free chatting. New & may not work on older devices. We're working on increasing compatibility & features.
              </Text>
            )}
          </View>

          {/* Voice Provider Slider - only in call_mode */}
          {localChatSettings.mode === "call_mode" && (
            <View className="mb-4">
              <Text style={GlobalFontStyleSheet.textBase } className="dark:text-gray-300 my-3 ml-1">
                Voice Provider
              </Text>
              <View 
                className=" bg-gray-50/90 dark:bg-gray-800 flex-row rounded-lg overflow-hidden border-[1px] border-gray-100 dark:border-gray-600 relative"
                onLayout={(event) => setSliderWidth(event.nativeEvent.layout.width)}
              >
                {sliderWidth > 0 && (
                  <Animated.View
                    className="absolute h-full bg-white dark:bg-gray-700"
                    style={[
                      {
                        borderRadius: 7,
                      },
                      animatedIndicatorStyle
                    ]}
                  />
                )}
                <Pressable
                  className="flex-1 p-2 items-center justify-center rounded-lg" // Removed conditional background
                  onPress={() => setVoiceProvider('v1')}
                  style={[
                    { zIndex: 1 },
                    voiceProvider === 'v1'
                      ? isDark
                        ? { backgroundColor: 'rgba(55, 65, 81, 1)' }
                        : { backgroundColor: 'rgba(55, 65, 81, 0.03)' }
                      : null,
                  ]} // Add background if selected
                >
                  <ThemedText
                     style={{ color: textColor, ...GlobalFontStyleSheet.textSm}}
                  >
                    v1 (fast/reliable)
                  </ThemedText>
                </Pressable>
                <Pressable
                  className="flex-1 p-2 items-center justify-center rounded-xl " // Removed conditional background
                  onPress={() => setVoiceProvider('v2')}
                  style={[
                    { zIndex: 1 },
                    voiceProvider === 'v2'
                      ? isDark
                        ? { backgroundColor: 'rgba(55, 65, 81, 1)' }
                        : { backgroundColor: 'rgba(55, 65, 81, 0.03)' }
                      : null,
                  ]} // Add background if selected
                >
                  <ThemedText
                    style={{ color: textColor, ...GlobalFontStyleSheet.textSm}}
                  >
                    v2 (authentic voices)
                  </ThemedText>
                </Pressable>
              </View>
              {/* Conditional description text */}
              <ThemedText style={{ color: textColor, ...GlobalFontStyleSheet.textSm }}  className="mt-2">
                {voiceProvider === 'v1' 
                  ? "Recommended for optimal performance."
                  : "Has the most authentic voices & dialects, but not as reliable as V1."}
              </ThemedText>
            </View>
          )}

          {/* Core Settings Group */}
          <View className="my-4 space-y-2">
            <SettingsPicker
              selectedValue={localChatSettings.voice}
              items={voiceSettingOptions}
              onValueChange={(value) => handleChange("voice", value)}
              label="Who do you want to chat with?"
              placeholderLabel=""
            />
          </View>

          {/* Pronunciation Characters */}
          { isJapaneseReadingAidFlagged && pronunciationOptions.length > 0 && (
            <View className="my-3">
              <SettingsPicker
                selectedValue={localChatSettings.pronunciation_characters}
                items={pronunciationOptions}
                onValueChange={(value) => handleChange('pronunciation_characters', value)}
                label="Pronunciation characters"
                placeholderLabel=''
              />
            </View>
          )}

          {/* Speed Slider - unified for both modes */}
          <SpeedSlider
            value={
              localChatSettings?.speed_multiplier || defaultSpeedMultiplier
            }
            onChange={(value) => handleChange("speed_multiplier", value)}
          />

          {localChatSettings.mode !== 'call_mode' && (
            <>

            {showTranscriptionMode && (
              <View className="my-3">
                <SettingsPicker
                  selectedValue={localChatSettings.transcription_mode}
                  items={transcriptionModeOptions}
                  onValueChange={(value) =>
                    handleChange("transcription_mode", value)
                  }
                  label="Tech to transcribe what you say"
                  placeholderLabel=""
                />
              </View>
            )}

            {Platform.OS === "ios" && (
              <View className="my-3">
                <SettingsPicker
                  selectedValue={localChatSettings.highlight_mode}
                  items={[
                    { label: "Full sentence", value: "sentence" },
                    { label: "Word by word", value: "word" },
                    { label: "Off", value: "off" },
                  ]}
                  onValueChange={(value) => handleChange("highlight_mode", value)}
                  label="Highlight spoken words or sentences?"
                  placeholderLabel=""
                />
              </View>
            )}

            {/* Auto Settings Group */}
            <View className="mb-4 mt-6">
              <View className="mb-3">
                <View className="flex-row items-center justify-between">
                  <ThemedText
                    style={{ color: textColor }}
                    className="text-base font-semibold"
                  >
                    Guided mode?
                  </ThemedText>
                  <Switch
                    value={localChatSettings.guided_mode}
                    onValueChange={(value) =>
                      handleChange("guided_mode", value)
                    }
                  />
                </View>
                <Text className="text-md text-gray-500 dark:text-gray-400 mt-1">
                  AI will guide you through the conversation
                </Text>
              </View>

              <View className="mb-3">
                <View className="flex-row items-center justify-between">
                  <ThemedText
                    style={{ color: textColor }}
                    className="text-base font-semibold"
                  >
                    Auto-record?
                  </ThemedText>
                  <Switch
                    value={localChatSettings.auto_record}
                    onValueChange={(value) => handleChange("auto_record", value)}
                  />
                </View>
                <Text className="text-md text-gray-500 dark:text-gray-400 mt-1">
                  Starts after AI replies
                </Text>
              </View>

              {showAutoSend && (
                <View className="mb-3">
                  <View className="flex-row items-center justify-between">
                    <ThemedText
                      style={{ color: textColor }}
                      className="text-base font-semibold"
                    >
                      Auto-send?
                    </ThemedText>
                    <Switch
                      value={localChatSettings.auto_send}
                      onValueChange={(value) => handleChange("auto_send", value)}
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
                        value={
                          localChatSettings?.auto_send_threshold ||
                          defaultVoiceThreshold
                        }
                        onChange={(value) =>
                          handleChange("auto_send_threshold", value)
                        }
                      />
                    </Animated.View>
                  )}
                </View>
              )}

              <View className="mb-3 mt-4">
                <SettingsPicker
                  selectedValue={getCurrentCorrectionMode()}
                  items={[
                    { label: "Off", value: "off" },
                    { label: "Written corrections", value: "written" },
                    {
                      label: "Verbal corrections, asking to repeat",
                      value: "verbal",
                    },
                  ]}
                  onValueChange={handleCorrectionModeChange}
                  label="Auto-correct?"
                  placeholderLabel=""
                  labelRight={() => (
                    <Text className="text-red-500 text-lg font-semibold ml-1">
                      *
                    </Text>
                  )}
                />
                {getCurrentCorrectionMode() === "verbal" && (
                  <Text className="text-md text-gray-500 dark:text-gray-400 mt-1">
                    Verbal only works in certain chat categories
                  </Text>
                )}
              </View>

              {/* Advanced Settings Toggle */}
              <Pressable
                onPress={() => setShowAdvanced(!showAdvanced)}
                className="flex-row items-center justify-between py-2 mb-2 mt-5"
              >
                <ThemedText
                  style={{ color: textColor }}
                  className="font-semibold text-base"
                >
                  Show advanced settings
                </ThemedText>
                <Ionicons
                  name={showAdvanced ? "chevron-up" : "chevron-down"}
                  size={24}
                  color={textColor}
                />
              </Pressable>

              {/* Advanced Settings Section */}
              {showAdvanced && (
                <View className="ml-2 mt-5">
                  <View className="mb-3">
                    <SettingsPicker
                      selectedValue={localChatSettings.ai_model}
                      items={aiModelOptions}
                      onValueChange={(value) => handleChange("ai_model", value)}
                      label="AI model"
                      placeholderLabel=""
                    />
                  </View>

                  <View className="mb-3">
                    <SettingsPicker
                      selectedValue={localChatSettings.auto_translate}
                      items={[
                        { label: "Off", value: "off" },
                        {
                          label: "Translate verbally (increases latency)",
                          value: "verbal",
                        },
                        { label: "Show translated text", value: "written" },
                      ]}
                      onValueChange={(value) =>
                        handleChange("auto_translate", value)
                      }
                      label="Auto-translate"
                      placeholderLabel=""
                      labelRight={() => (
                        <Text className="text-red-500 text-lg font-semibold ml-1">
                          *
                        </Text>
                      )}
                    />
                  </View>

                  {showAdvancedSettings && (
                    <View className="space-y-2 mt-5">
                      <View className="mb-3">
                        <View className="flex-row items-center justify-between">
                          <ThemedText
                            style={{
                              color: textColor,
                              ...GlobalFontStyleSheet.textBase,
                              fontFamily: "Lato-Bold",
                            }}
                            className="text-base font-semibold"
                          >
                            Practice vocab before chats start?
                          </ThemedText>
                          <Text className="text-red-500 text-lg font-semibold ml-1">
                            *
                          </Text>
                          <Switch
                            value={localChatSettings.practice_vocab_before_chat}
                            onValueChange={(value) =>
                              handleChange("practice_vocab_before_chat", value)
                            }
                          />
                        </View>
                        <Text className="text-md text-gray-500 dark:text-gray-400 mt-1">
                          Applies in certain chats
                        </Text>
                      </View>

                      <View className="mb-3">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center">
                            <ThemedText
                              style={{ color: textColor }}
                              className="text-base font-semibold"
                            >
                              Don't always ask me a Q
                            </ThemedText>
                            <Text className="text-red-500 text-lg font-semibold ml-1">
                              *
                            </Text>
                          </View>
                          <Switch
                            value={localChatSettings.do_not_ask_questions}
                            onValueChange={(value) =>
                              handleChange("do_not_ask_questions", value)
                            }
                          />
                        </View>
                        <Text className="text-md text-gray-500 dark:text-gray-400 mt-1">
                          Applies in certain chats
                        </Text>
                      </View>
                      
                      {/* Memory enabled */}
                      {isMemoryEnabled && (
                      <View className="mb-3">
                        <View className="flex-row items-center justify-between">
                          <ThemedText
                            style={{ color: textColor, ...GlobalFontStyleSheet.textBase, fontFamily: "Lato-Bold"}}
                          >
                            Memory enabled?
                          </ThemedText>
                          <Switch
                            value={userSettings?.team.memory_enabled ?? false}
                            onValueChange={(value) =>
                              handleTeamSettingChange("memory_enabled", value)
                            }
                          />
                        </View>
                        
                        <Text className="text-md text-gray-500 dark:text-gray-400 mt-1">
                          Makes conversations feel more natural
                        </Text>
                        
                        <TouchableOpacity 
                          onPress={() => {
                            // Close the modal first, then navigate
                            if (onCloseModal) {
                              onCloseModal();
                            }
                            // Small delay to ensure modal closes before navigation
                            setTimeout(() => {
                              router.push('/memories');
                            }, 100);
                          }}
                          className="mt-2 self-start"
                        > 
                          <Text style={{ 
                            color: textColor, 
                            ...GlobalFontStyleSheet.textSm, 
                            textDecorationLine: 'underline',
                            fontWeight: '500'
                          }}>
                            View or delete memories
                          </Text>
                        </TouchableOpacity>
                      </View>
                      )}
                    </View>
                  )}
                </View>
              )}
              {/* Explanation Footer */}
              <View className="mt-4 flex-row items-start">
                <Text className="text-red-500 text-lg font-semibold mr-1">*</Text>
                <Text className="text-sm text-gray-500 dark:text-white flex-1">
                  Settings with an asterisk can't be updated during a chat.
                </Text>
              </View>
            </View>
            </>
          )}
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
