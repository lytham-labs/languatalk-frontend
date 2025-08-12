import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import SlidingModal from '@/components/shared/SlidingModal';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faTrash, faVolumeHigh, faTimes, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { faTrashCan } from '@fortawesome/pro-duotone-svg-icons/faTrashCan';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { colorScheme } from 'nativewind';
import FlashcardService, { Flashcard } from '@/services/FlashcardService';
import useUserSettings from '@/services/api/useUserSettings';
import AudioPlayerService from '@/services/AudioPlayerService';
import { API_URL } from '@/constants/api';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import DeleteAlert from './DeleteAlert';

interface VocabModalProps {
  visible: boolean;
  onClose: () => void;
  flashcard: Flashcard;
  flashcardService: FlashcardService;
  onDelete: (id: string) => void;
  audioPlayer: AudioPlayerService;
  onUpdateTags?: (id: string, newTags: string) => void;
  onUpdateTranslation?: (id: string, newTranslation: string) => void;
  onUpdateFront?: (id: string, newFront: string) => void;
  availableTags?: string[];
}

interface TagProps {
  text: string;
  onRemove: () => void;
}

const Tag: React.FC<TagProps> = ({ text, onRemove }) => (
  <View className="bg-gray-50 dark:bg-gray-700 rounded-full px-3 py-1 flex-row items-center mr-2 mb-2 pb-[6px]">
    <Text 
      style={[GlobalFontStyleSheet.textSm]}
      className="text-gray-700 dark:text-gray-200 mr-2"
    >
      {text}
    </Text>
    <TouchableOpacity onPress={onRemove}>
      <FontAwesomeIcon 
        icon={faTimes} 
        size={12} 
        color={colorScheme.get() === "dark" ? "#E5E7EB" : "#4B5563"}
      />
    </TouchableOpacity>
  </View>
);

const VocabModal: React.FC<VocabModalProps> = ({
  visible,
  onClose,
  flashcard,
  flashcardService,
  onDelete,
  audioPlayer,
  onUpdateTags,
  onUpdateTranslation,
  onUpdateFront,
  availableTags,
}) => {
  const [tags, setTags] = useState<string[]>([]);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [translation, setTranslation] = useState(flashcard.back);
  const [front, setFront] = useState(flashcard.front);
  const { userSettings } = useUserSettings();
  const audioPlayerService = new AudioPlayerService();
  const [voice, setVoice] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const { token } = useAuth();
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  useEffect(() => {
    if (visible) {
      setTags((flashcard.tags || []).filter((tag) => tag.trim()));
      setTranslation(flashcard.back);
      setFront(flashcard.front);
    } else {
      setTags([]);
      setNewTag('');
      setTranslation('');
      setFront('');
    }
  }, [
    visible,
    flashcard.back,
    flashcard.tags ? flashcard.tags.join(',') : "",
    flashcard.front
  ]);

  useEffect(() => {
    if (userSettings?.team?.chat_settings?.voice) {
      const fullVoice = userSettings.team.chat_settings.voice;
      if (fullVoice.toLowerCase().includes('elevenlabs')) {
        const shortVoice = fullVoice.split('_')[0];
        setVoice(shortVoice);
      } else {
        setVoice('');
      }
    }
  }, [userSettings]);

  useEffect(() => {
    setAudioUrl(null);
    setIsPlayingAudio(false);
    setIsLoadingAudio(false);
  }, [flashcard.id]);

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setTags((flashcard.tags || []).filter(tag => tag.trim()));
    }, 300);
  };

  const handleDeletePress = () => {
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    setShowDeleteConfirmation(false);
    await flashcardService.deleteFlashcard(flashcard.id);
    onDelete(flashcard.id);
    onClose();
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      const newTags = [...tags, newTag.trim()];
      setTags(newTags);
      setNewTag('');
      setShowTagInput(false);
      
      if (onUpdateTags) {
        (async () => {
          try {
            await onUpdateTags(flashcard.id, newTags.join(','));
          } catch (error: any) {
            console.error("Error updating tags:", error);
          }
        })();
      }
    }
  };

  const handleAddExistingTag = (tagToAdd: string) => {
    const newTags = [...tags, tagToAdd];
    setTags(newTags);
    
    if (onUpdateTags) {
      (async () => {
        try {
          await onUpdateTags(flashcard.id, newTags.join(','));
        } catch (error: any) {
          console.error("Error updating tags:", error);
        }
      })();
    }
  };

  const handleRemoveTag = (indexToRemove: number) => {
    const newTags = tags.filter((_, index) => index !== indexToRemove)
      .filter(tag => tag.trim());
    setTags(newTags);
  };

  const handleSave = () => {
    // Close the modal immediately for a snappy UI response
    onClose();
    
    // Perform updates in the background (optimistic updates)
    if (onUpdateTags) {
      const filteredTags = tags.filter(tag => tag.trim());
      (async () => {
        try {
          await onUpdateTags(flashcard.id, filteredTags.join(','));
        } catch (error: any) {
          console.error("Error updating tags:", error);
        }
      })();
    }

    if (onUpdateTranslation && translation !== flashcard.back) {
      (async () => {
        try {
          await onUpdateTranslation(flashcard.id, translation);
        } catch (error: any) {
          console.error("Error updating translation:", error);
        }
      })();
    }

    if (onUpdateFront && front !== flashcard.front) {
      (async () => {
        try {
          await onUpdateFront(flashcard.id, front);
        } catch (error: any) {
          console.error("Error updating front:", error);
        }
      })();
    }
  };

  const handlePlayAudio = async () => {
    if (!flashcard) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isPlayingAudio) {
      await audioPlayerService.pauseSound();
      setIsPlayingAudio(false);
      return;
    }

    setIsLoadingAudio(true);
    try {
      const response = await fetch(
        `${API_URL}/api/v1/stream_text_to_speech`,
        {
          method: "POST",
          headers: {
            Authorization: `${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: flashcard.front,
            language: flashcard.language,
            voice_provider: 'elevenlabs',
            voice: voice
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to fetch audio");

      // Get the text from the blob for 11Labs
      const blob = await response.blob();
      const textResponse = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blob);
      });

      // Process the text stream
      const lines = textResponse.split('\n');
      let audioBytes = "";

      for (const line of lines) {
        if (line.trim()) {
          try {
            const responseDict = JSON.parse(line);
            if (responseDict.audio_base64) {
              const audioBytesChunk = atob(responseDict.audio_base64);
              audioBytes += audioBytesChunk;
            }
          } catch (e) {
            console.error('Error parsing JSON line:', e);
          }
        }
      }

      // Convert accumulated audioBytes to Uint8Array
      const byteArray = new Uint8Array(audioBytes.length);
      for (let i = 0; i < audioBytes.length; i++) {
        byteArray[i] = audioBytes.charCodeAt(i);
      }

      const fileName = `flashcard_${flashcard.id}_${Date.now()}.mp3`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(
        fileUri,
        btoa(String.fromCharCode(...byteArray)),
        { encoding: FileSystem.EncodingType.Base64 }
      );

      setAudioUrl(fileUri);
      playAudio(fileUri);
    } catch (error) {
      console.error("Error fetching audio:", error);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const playAudio = async (audioUrl: string) => {
    try {
      await audioPlayerService.playSound(
        audioUrl,
        null,
        flashcard.id,
        false,
        "off",
        flashcard.front,
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlayingAudio(false);
          }
        }
      );
      setIsPlayingAudio(true);
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsPlayingAudio(false);
    }
  };

  const getFontSize = () => {
    const isSentence = flashcard.tags?.some(tag => ['sentence', 'phrase'].includes(tag));
    return isSentence ? 24 : 32;
  };

  const getAvailableTagsToAdd = () => {
    if (!availableTags) return [];
    return availableTags.filter(tag => !tags.includes(tag));
  };

  return (
    <>
      <SlidingModal visible={visible} onClose={handleClose}>
        <View className="w-full p-4">
          {/* Title Section */}
          <View className="mb-6">
            <View className="flex-row items-center mb-2">
              <Text
                style={[GlobalFontStyleSheet.textSm, { 
                  color: colorScheme.get() === "dark" ? "#9CA3AF" : "#6B7280",
                  fontWeight: '500',
                  flex: 1
                }]}
              >
                Edit Word/Phrase
              </Text>
            </View>
            <View className="flex-row justify-between items-center">
              <TextInput
                className="flex-1 border border-gray-200 dark:bg-gray-700 px-4 py-3 rounded-lg text-gray-900 dark:text-white mr-3"
                value={front}
                onChangeText={setFront}
                style={[
                  GlobalFontStyleSheet.text2Xl,
                  { 
                    fontWeight: '700',
                    fontSize: getFontSize(),
                    lineHeight: 35,
                  }
                ]}
              />
              <TouchableOpacity 
                onPress={handlePlayAudio}
                className="ml-4"
              >
                <FontAwesomeIcon icon={faVolumeHigh} size={28} color="#00448F" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Translation Section */}
          <View className="mb-6">
            <View className="flex-row items-center mb-2">
              <Text
                style={[GlobalFontStyleSheet.textSm, { 
                  color: colorScheme.get() === "dark" ? "#9CA3AF" : "#6B7280",
                  fontWeight: '500',
                  flex: 1
                }]}
              >
                Edit Translation
              </Text>
            </View>
            <TextInput
              className="border border-gray-200 dark:bg-gray-700 px-4 py-3 rounded-lg text-gray-900 dark:text-white"
              value={translation}
              onChangeText={setTranslation}
              multiline
              textAlignVertical="top"
              style={[
                GlobalFontStyleSheet.textMd,
                { minHeight: 80 }
              ]}
            />
          </View>

          {/* Tags Section */}
          <View className="mb-6">
            <Text
              style={[GlobalFontStyleSheet.textSm, { 
                color: colorScheme.get() === "dark" ? "#9CA3AF" : "#6B7280",
                marginBottom: 8,
                fontWeight: '500'
              }]}
            >
              Tags
            </Text>

            <View className="flex-row flex-wrap mb-2">
              {tags.map((tag, index) => (
                <Tag
                  key={index}
                  text={tag}
                  onRemove={() => handleRemoveTag(index)}
                />
              ))}
              
              <TouchableOpacity 
                onPress={() => setShowTagInput(true)}
                className="bg-gray-50 dark:bg-gray-700 rounded-full h-7 w-7 items-center justify-center"
              >
                <FontAwesomeIcon 
                  icon={faPlus} 
                  size={14} 
                  color={colorScheme.get() === "dark" ? "#E5E7EB" : "#4B5563"}
                />
              </TouchableOpacity>
            </View>

            {showTagInput && (
              <View className="flex-row items-center mt-2">
                <TextInput
                  className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 px-4 py-2 rounded-lg mr-2 text-gray-900 dark:text-white"
                  value={newTag}
                  onChangeText={setNewTag}
                  placeholder="Enter new tag"
                  placeholderTextColor="#9ca3af"
                  style={GlobalFontStyleSheet.textMd}
                  autoFocus
                  onSubmitEditing={handleAddTag}
                  blurOnSubmit={false}
                />
                <TouchableOpacity 
                  onPress={handleAddTag}
                  className="py-2 px-4"
                >
                  <Text style={GlobalFontStyleSheet.textMd} className="text-red-500 font-semibold">
                    Add tag
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {showTagInput && getAvailableTagsToAdd().length > 0 && (
              <View className="mt-3">
                <Text
                  style={[GlobalFontStyleSheet.textSm, { 
                    color: colorScheme.get() === "dark" ? "#9CA3AF" : "#6B7280",
                    marginBottom: 8,
                    fontWeight: '500'
                  }]}
                >
                  Or select from existing tags:
                </Text>
                <View className="flex-row flex-wrap">
                  {getAvailableTagsToAdd().map((tag, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => handleAddExistingTag(tag)}
                      className="bg-gray-50 dark:bg-gray-700 rounded-full px-3 py-1 flex-row items-center mr-2 mb-2 pb-[6px]"
                    >
                      <FontAwesomeIcon 
                        icon={faPlus} 
                        size={10} 
                        color={colorScheme.get() === "dark" ? "#E5E7EB" : "#4B5563"}
                        style={{ marginRight: 6 }}
                      />
                      <Text 
                        style={[GlobalFontStyleSheet.textSm]}
                        className="text-gray-700 dark:text-gray-200"
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Bottom Action Buttons */}
          <View className="flex-row items-center gap-6 mt-auto ">
            <TouchableOpacity
              onPress={handleDeletePress}
              className="w-1/8 h-12 items-center justify-center dark:bg-red-900/20 rounded-xl"
            >
              <FontAwesomeIcon 
                icon={faTrash}
                size={20} 
                color={colorScheme.get() === "dark" ? "#FCA5A5" : "#EF4444"}
              />
            </TouchableOpacity>

            <View className="flex-1 w-1/2">
              <TouchableOpacity
                className="bg-[#FC5D5D] py-3.5 rounded-xl justify-end"
                onPress={handleSave}
              >
                <Text
                  style={[GlobalFontStyleSheet.textMd, { 
                    color: '#FFFFFF', 
                    textAlign: 'center', 
                    fontWeight: '600' 
                  }]}
                >
                  Save & Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SlidingModal>

      <DeleteAlert 
        visible={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={handleConfirmDelete}
        word={flashcard.front}
      />
    </>
  );
};

export default VocabModal;
