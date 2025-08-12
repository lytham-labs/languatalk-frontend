import React, { useState, useEffect, useMemo } from 'react';
import { ScrollView, View, Pressable, Modal, FlatList, Switch, Alert, Platform, TouchableOpacity, TextInput, Button } from 'react-native';
import Slider from '@react-native-community/slider';
import { ThemedText } from '@/components/shared/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { UserSettings as UserSettingsProps } from '@/contexts/UserSettingsContext';
import { SettingsPicker } from '@/components/shared/SettingsForms';
import { Ionicons } from '@expo/vector-icons';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { Text } from 'react-native';
import SpeedSlider from '@/components/shared/SpeedSlider';

interface CallSettingsFormProps {
  showCallModeOptions?: boolean;
  initialChatSettings: UserSettingsProps['team']['chat_settings'] & {
    voice_provider?: string;
    openai_voice?: string;
    gemini_voice?: string;
    cartesia_voice?: string;
    keep_screen_on?: boolean;
    openai_model?: string;
    openai_transcription_model?: string;
    openai_temperature?: string;
    openai_max_tokens?: string;
    openai_vad_threshold?: string;
    openai_silence_duration_ms?: string;
    gemini_temperature?: string;
    speed_multiplier?: number;
    model_version?: string;
  };
  initialChatOptions: UserSettingsProps['chat_form_options'] & {
    voice_provider?: Record<string, string>;
    cartesia_voice_options?: Record<string, string>;
  };
  onSettingChange: (changes: Record<string, string | boolean | number>) => void;
  onClose?: () => void;
  autoSave?: boolean;
  showTranscription?: boolean;
  onTranscriptionToggle?: () => void;
}

export default function CallSettingsForm({ 
  showCallModeOptions = true,
  initialChatSettings, 
  initialChatOptions, 
  onSettingChange,
  onClose,
  autoSave = false,
  showTranscription,
  onTranscriptionToggle
}: CallSettingsFormProps) {

  const [localChatSettings, setLocalChatSettings] = useState({
    ...initialChatSettings,
    voice_provider: initialChatSettings?.voice_provider || 'elevenlabs',
    keep_screen_on: typeof initialChatSettings?.keep_screen_on === 'boolean' ? initialChatSettings.keep_screen_on : true
  });
  console.log('localChatSettings.voice', localChatSettings.voice);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string | boolean | number>>({});
  const [localChatOptions, setLocalChatOptions] = useState(initialChatOptions);
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const backgroundColor = isDark ? Colors.dark.background : Colors.light.background;
  const textColor = isDark ? Colors.dark.text : Colors.light.text;
  const tintColor = Colors[colorScheme].tint;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showOpenAISettings, setShowOpenAISettings] = useState(false);
  const [showGeminiSettings, setShowGeminiSettings] = useState(false);
  const [showElevenLabsSettings, setShowElevenLabsSettings] = useState(false);
  const [hideProviderSettings, setHideProviderSettings] = useState(true);
  console.log('localChatSettings.model_version', localChatSettings);
  useEffect(() => {
    if (initialChatSettings) {
      setLocalChatSettings({
        ...initialChatSettings,
        voice_provider: initialChatSettings?.voice_provider || 'elevenlabs',
        keep_screen_on: typeof initialChatSettings?.keep_screen_on === 'boolean' ? initialChatSettings.keep_screen_on : true
      });
    }
    if (initialChatOptions) {
      setLocalChatOptions(initialChatOptions);
    }
    setPendingChanges({});
  }, [initialChatSettings, initialChatOptions]);


  const handleLocalChange = (field: string, value: string | boolean | number) => {
    setLocalChatSettings(prev => ({ ...prev, [field]: value }));
    setPendingChanges(prev => ({ ...prev, [field]: value }));

    // If autoSave is enabled, immediately send the change to the parent
    if (autoSave) {
      onSettingChange({ [field]: value });
    }
  };

  const handleSaveChanges = () => {
    if (Object.keys(pendingChanges).length > 0) {
      onSettingChange(pendingChanges);
      setPendingChanges({});
    }
    if (onClose) {
      onClose();
    }
  };

  const voiceSettingOptions = useMemo(() => {
    if (!localChatOptions.voice_options) {
      return [];
    }
    return Object.entries(localChatOptions.voice_options).map(([label, value]) => {
      return { label, value: value.split('_')[0] };
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

  const cartesiaVoiceOptions = useMemo(() => {
    if (!localChatOptions.cartesia_voice_options) {
      return [];
    }
    return Object.entries(localChatOptions.cartesia_voice_options).map(([label, value]) => {
      return { label, value };
    });
  }, [localChatOptions.cartesia_voice_options]);

  const callModeProviderOptions = useMemo(() => {
    if (!localChatOptions.voice_provider) {
      return [
        { label: 'ElevenLabs', value: 'elevenlabs' },
        { label: 'OpenAI', value: 'openai' },
        { label: 'Gemini', value: 'gemini' },
        { label: 'Cartesia', value: 'cartesia' }
      ];
    }
    return Object.entries(localChatOptions.voice_provider).map(([label, value]) => {
      return { label, value: value.toString() };
    });
  }, [localChatOptions.voice_provider]);

  const openAIVoiceOptions = [
    { label: 'Alloy', value: 'alloy' },
    { label: 'Ash', value: 'ash' },
    { label: 'Ballad', value: 'ballad' },
    { label: 'Coral', value: 'coral' },
    { label: 'Echo', value: 'echo' },
    { label: 'Sage', value: 'sage' },
    { label: 'Shimmer', value: 'shimmer' },
    { label: 'Verse', value: 'verse' }
  ];

  const geminiVoiceOptions = [
    { label: 'Puck', value: 'Puck' },
    { label: 'Charon', value: 'Charon' },
    { label: 'Kore', value: 'Kore' },
    { label: 'Fenrir', value: 'Fenrir' },
    { label: 'Aoede', value: 'Aoede' }
  ];

  useEffect(() => {
    setShowOpenAISettings(localChatSettings.voice_provider === 'openai');
    setShowGeminiSettings(localChatSettings.voice_provider === 'gemini');
    setShowElevenLabsSettings(localChatSettings.voice_provider === 'elevenlabs');
  }, [localChatSettings.voice_provider]);

  // Add OpenAI model options
  const openAIModelOptions = [
    { label: 'GPT-4o Mini Realtime (Dec 2024)', value: 'gpt-4o-mini-realtime-preview-2024-12-17' },
    { label: 'GPT-4o Mini Realtime', value: 'gpt-4o-mini-realtime-preview' },
    { label: 'GPT-4o Realtime (Dec 2024)', value: 'gpt-4o-realtime-preview-2024-12-17' },
    { label: 'GPT-4o Realtime (Oct 2024)', value: 'gpt-4o-realtime-preview-2024-10-01' },
    { label: 'GPT-4o Realtime', value: 'gpt-4o-realtime-preview' },
  ];

  // Add OpenAI transcription model options
  const openAITranscriptionModelOptions = [
    { label: 'GPT-4o Transcribe', value: 'gpt-4o-transcribe' },
    { label: 'GPT-4o Mini Transcribe', value: 'gpt-4o-mini-transcribe' },
    { label: 'Whisper-1', value: 'whisper-1' },
  ];

  // Model version options
  const modelVersionOptions = [
    { label: 'V1', value: 'v1' },
    { label: 'V2', value: 'v2' }
  ];

  // Early return if no valid initial settings
  if (!initialChatSettings) {
    return null;
  }

  return (
    <ScrollView className="bg-white dark:bg-gray-800"> 
      <View className="p-5">
        
        {/* Model Version Selection */}
        {showCallModeOptions && showElevenLabsSettings && (
          <View className="my-4 space-y-2">
            <SettingsPicker
              selectedValue={localChatSettings.model_version || 'v1'}
              items={modelVersionOptions}
              onValueChange={(value) => handleLocalChange('model_version', value)}
              label="Model Version"
              placeholderLabel=''
            />
          </View>
        )}

        {/* Call Mode Provider Selection (if enabled) */}
        {/* {showCallModeOptions && (
          <View className="my-4 space-y-2">
            <SettingsPicker
              selectedValue={localChatSettings.voice_provider}
              items={callModeProviderOptions}
              onValueChange={(value) => handleLocalChange('voice_provider', value)}
              label="Voice provider"
              placeholderLabel=''
            />
          </View>
        )} */}

        {/* Voice Selection - updated to include Cartesia voices */}
        {/* <View className="my-4 space-y-2">
          {localChatSettings.voice_provider === 'openai' ? (
            <SettingsPicker
              selectedValue={localChatSettings.openai_voice || 'alloy'}
              items={openAIVoiceOptions}
              onValueChange={(value) => handleLocalChange('openai_voice', value)}
              label="OpenAI voice"
              placeholderLabel=''
            />
          ) : localChatSettings.voice_provider === 'gemini' ? (
            <SettingsPicker
              selectedValue={localChatSettings.gemini_voice || 'Puck'}
              items={geminiVoiceOptions}
              onValueChange={(value) => handleLocalChange('gemini_voice', value)}
              label="Gemini voice"
              placeholderLabel=''
            />
          ) : localChatSettings.voice_provider === 'cartesia' ? (
            <SettingsPicker
              selectedValue={localChatSettings.cartesia_voice || ''}
              items={cartesiaVoiceOptions}
              onValueChange={(value) => handleLocalChange('cartesia_voice', value)}
              label="Cartesia voice"
              placeholderLabel=''
            />
          ) : (
            <SettingsPicker
              selectedValue={localChatSettings.voice || ''}
              items={voiceSettingOptions}
              onValueChange={(value) => handleLocalChange('voice', value)}
              label="Who do you want to chat with?"
              placeholderLabel=''
            />
          )}
        </View> */}

        {/* Speed Slider */}
        {showCallModeOptions && (
          <View className="mb-4">
            <SpeedSlider
              label={'Speech speed'}
              value={localChatSettings?.speed_multiplier || 1.0}
              onChange={(value) => handleLocalChange('speed_multiplier', parseFloat(value))}
            />
          </View>
        )}

        {/* OpenAI specific settings */}
        {showOpenAISettings && (
          <View>
            <View>
              <ThemedText style={{ color: textColor }} className="text-sm mb-1">Time until AI jumps in</ThemedText>
              <Text style={GlobalFontStyleSheet.textSm} className="text-md text-gray-500 dark:text-gray-400 mt-1">
                Longer = more time to pause & think.
              </Text>
              <View className="flex-row items-center mb-4">
                <View className="flex-1">
                  <Slider
                    value={parseFloat(localChatSettings.openai_silence_duration_ms || '1500')}
                    minimumValue={1000}
                    maximumValue={4000}
                    step={100}
                    onValueChange={(value) => handleLocalChange('openai_silence_duration_ms', value.toString())}
                    minimumTrackTintColor={isDark ? Colors.dark.text : Colors.light.text}
                    maximumTrackTintColor={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"}
                    thumbTintColor={isDark ? Colors.dark.text : Colors.light.text}
                  />
                  <View className="flex-row justify-between mt-1 mb-3">
                    <Text className={`text-sm ${isDark ? 'text-gray-50' : 'text-gray-500'}`}>1s</Text>
                    <Text className={`text-sm ${isDark ? 'text-gray-50' : 'text-gray-500'}`}>2s</Text>
                    <Text className={`text-sm ${isDark ? 'text-gray-50' : 'text-gray-500'}`}>3s</Text>
                    <Text className={`text-sm ${isDark ? 'text-gray-50' : 'text-gray-500'}`}>4s</Text>
                  </View>
                </View>
              </View>
            </View>

            <ThemedText style={{ color: textColor }} className="text-sm mb-1">How loud is your environment?</ThemedText>
            <Text style={GlobalFontStyleSheet.textSm} className="text-md text-gray-500 dark:text-gray-400 mt-1">
              We'll use this to ignore background noise
            </Text>
            <View className="flex-row items-center mb-8">
              <View className="flex-1">
                <Slider
                  value={parseFloat(localChatSettings.openai_vad_threshold || '0.6')}
                  minimumValue={0.1}
                  maximumValue={0.9}
                  step={0.1}
                  onValueChange={(value) => handleLocalChange('openai_vad_threshold', value.toString())}
                  minimumTrackTintColor={isDark ? Colors.dark.text : Colors.light.text}
                  maximumTrackTintColor={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"}
                  thumbTintColor={isDark ? Colors.dark.text : Colors.light.text}
                />
                <View className="flex-row justify-between mt-1">
                  <Text className={`text-sm ${isDark ? 'text-gray-50' : 'text-gray-500'}`}>Quiet</Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-50' : 'text-gray-500'}`}>Loud</Text>
                </View>
              </View>
            </View>
            {/* Advanced OpenAI settings */}
            {showAdvanced && (
              <View>
                {/* Add OpenAI model selection */}
                <View className="my-4 space-y-2">
                  <SettingsPicker
                    selectedValue={localChatSettings.openai_model || 'gpt-4o-mini-realtime-preview-2024-12-17'}
                    items={openAIModelOptions}
                    onValueChange={(value) => handleLocalChange('openai_model', value)}
                    label="OpenAI model"
                    placeholderLabel=''
                  />
                </View>

                {/* Add OpenAI transcription model selection */}
                <View className="my-4 space-y-2">
                  <SettingsPicker
                    selectedValue={localChatSettings.openai_transcription_model || 'gpt-4o-transcribe'}
                    items={openAITranscriptionModelOptions}
                    onValueChange={(value) => handleLocalChange('openai_transcription_model', value)}
                    label="Transcription model"
                    placeholderLabel=''
                  />
                </View>

                <View>
                  <ThemedText style={{ color: textColor }} className="text-sm mb-1">Temperature ({localChatSettings.openai_temperature || '0.8'})</ThemedText>
                  <View className="flex-row items-center">
                    <Text className="mr-2 text-gray-500 dark:text-gray-300">0.0</Text>
                    <View className="flex-1">
                      <Slider
                        value={parseFloat(localChatSettings.openai_temperature || '0.8')}
                        minimumValue={0}
                        maximumValue={2}
                        step={0.1}
                        onValueChange={(value) => handleLocalChange('openai_temperature', value.toString())}
                        minimumTrackTintColor={tintColor}
                        maximumTrackTintColor={isDark ? '#555' : '#ddd'}
                        thumbTintColor={tintColor}
                      />
                    </View>
                    <Text className="ml-2 text-gray-500 dark:text-gray-300">2.0</Text>
                  </View>
                </View>
                
                <View>
                  <ThemedText style={{ color: textColor }} className="text-sm mb-1">Max Output Tokens</ThemedText>
                  <TextInput
                    value={localChatSettings.openai_max_tokens || '2048'}
                    onChangeText={(value) => handleLocalChange('openai_max_tokens', value)}
                    keyboardType="number-pad"
                    className="border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-800 text-black dark:text-white"
                  />
                </View>
              </View>
            )}

          </View>
        )}

        {/* Keep screen on */}
        {showCallModeOptions && (
          <View className="mb-3">
            <View className="flex-row items-center justify-between">
              <ThemedText style={{ color: textColor }} className="text-base font-semibold">Keep screen on?</ThemedText>
              <Switch
                value={localChatSettings.keep_screen_on || false}
                onValueChange={(value) => handleLocalChange('keep_screen_on', value)}
              />
            </View>
            <Text style={GlobalFontStyleSheet.textSm} className="text-md text-gray-500 dark:text-gray-400 mt-1">
              Prevents device from sleeping during calls
            </Text>
          </View>
        )}

        {/* Show Transcription Toggle */}
        {showCallModeOptions && onTranscriptionToggle && (
          <View className="mb-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <ThemedText style={{ color: textColor }} className="text-base font-semibold">Show Transcription</ThemedText>
              </View>
              <Switch
                value={showTranscription || false}
                onValueChange={onTranscriptionToggle}
              />
            </View>
            <Text style={GlobalFontStyleSheet.textSm} className="text-md text-gray-500 dark:text-gray-400 mt-1">
              Choose whether to read as you listen
            </Text>
          </View>
        )}

        {/* Gemini specific settings */}
        {showGeminiSettings && (
          <View className="my-4 space-y-4 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <ThemedText style={{ color: textColor }} className="text-base font-semibold">Gemini Settings</ThemedText>
            
            <View>
              <ThemedText style={{ color: textColor }} className="text-sm mb-1">Temperature ({localChatSettings.gemini_temperature || '0.8'})</ThemedText>
              <View className="flex-row items-center">
                <Text className="mr-2 text-gray-500 dark:text-gray-300">0.0</Text>
                <View className="flex-1">
                  <Slider
                    value={parseFloat(localChatSettings.gemini_temperature || '0.8')}
                    minimumValue={0}
                    maximumValue={1}
                    step={0.1}
                    onValueChange={(value) => handleLocalChange('gemini_temperature', value.toString())}
                    minimumTrackTintColor={tintColor}
                    maximumTrackTintColor={isDark ? '#555' : '#ddd'}
                    thumbTintColor={tintColor}
                  />
                </View>
                <Text className="ml-2 text-gray-500 dark:text-gray-300">1.0</Text>
              </View>
            </View>
          </View>
        )}

        {/* Save Button - only show if autoSave is false */}
        {!autoSave && (
          <View className="mt-6 mb-4">
            <Button
              title="Save Changes"
              onPress={handleSaveChanges}
              color={tintColor}
              disabled={Object.keys(pendingChanges).length === 0}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}
