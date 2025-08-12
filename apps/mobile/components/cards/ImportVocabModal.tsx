import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, ScrollView, Text } from 'react-native';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faTrash, faPlus, faChevronDown, faChevronUp, faPencil } from '@fortawesome/pro-solid-svg-icons';
import SlidingModal from '@/components/shared/SlidingModal';
import FlashcardService from '@/services/FlashcardService';
import { colorScheme } from 'nativewind';
import useUserSettings from '@/services/api/useUserSettings';

interface VocabEntry {
  front: string;
  back: string;
  tags: string;
  isCollapsed?: boolean;
}

interface ImportVocabModalProps {
  visible: boolean;
  onClose: () => void;
  flashcardService: FlashcardService;
  onVocabImported: () => void;
}

export default function ImportVocabModal({
  visible,
  onClose,
  flashcardService,
  onVocabImported
}: ImportVocabModalProps) {
  const [entries, setEntries] = useState<VocabEntry[]>([{ front: '', back: '', tags: '', isCollapsed: false }]);
  const { userSettings } = useUserSettings();

  const addEntry = () => {
    // Collapse all completed entries
    const newEntries = entries.map(entry => ({
      ...entry,
      isCollapsed: entry.front.trim() !== ''
    }));
    // Add new empty entry
    setEntries([...newEntries, { front: '', back: '', tags: '', isCollapsed: false }]);
  };

  const removeEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof VocabEntry, value: string) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
  };

  const toggleCollapse = (index: number) => {
    const newEntries = [...entries];
    newEntries[index] = { 
      ...newEntries[index], 
      isCollapsed: !newEntries[index].isCollapsed 
    };
    setEntries(newEntries);
  };

  const handleImport = async () => {
    try {
      const validEntries = entries.filter(entry => entry.front.trim());
      
      await Promise.all(validEntries.map(entry => 
        flashcardService.addFlashcard({
          front: entry.front.trim(),
          back: entry.back.trim(),
          language: userSettings?.team?.stream_language || "en",
          tags: entry.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
        })
      ));

      onVocabImported();
      handleClose();
    } catch (error) {
      console.error('Error adding vocabulary:', error);
    }
  };

  const handleClose = () => {
    setEntries([{ front: '', back: '', tags: '', isCollapsed: false }]);
    onClose();
  };

  const renderEntry = (entry: VocabEntry, index: number) => {
    if (entry.isCollapsed && entry.front.trim()) {
      return (
        <TouchableOpacity 
          key={index}
          onPress={() => toggleCollapse(index)} 
          className="flex-row items-center justify-between p-3 mb-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
          <View className="flex-1">
            <Text style={[GlobalFontStyleSheet.textMd, {
              color: colorScheme.get() === "dark" ? "#FFFFFF" : "#111827",
              fontWeight: '500'
            }]}>
              {entry.front}
            </Text>
            {entry.back && (
              <Text style={[GlobalFontStyleSheet.textSm, {
                color: colorScheme.get() === "dark" ? "#9CA3AF" : "#6B7280",
              }]}>
                {entry.back}
              </Text>
            )}
          </View>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => toggleCollapse(index)}>
              <FontAwesomeIcon 
                icon={faPencil} 
                size={14} 
                color={colorScheme.get() === "dark" ? "#9CA3AF" : "#6B7280"}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeEntry(index)}>
              <FontAwesomeIcon 
                icon={faTrash} 
                size={14} 
                color={colorScheme.get() === "dark" ? "#FCA5A5" : "#EF4444"}
              />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <View key={index} className="mb-4">
        <View className="flex-row items-center gap-2 mb-2">
          <TextInput
            className="flex-1 border border-gray-200 dark:bg-gray-700 px-4 py-3 rounded-lg text-gray-900 dark:text-white"
            value={entry.front}
            onChangeText={(value) => updateEntry(index, 'front', value)}
            placeholder="Word/phrase"
            placeholderTextColor="#9ca3af"
            style={GlobalFontStyleSheet.textMd}
            autoCapitalize="none"
            onBlur={() => {
              if (entry.front.trim()) {
                toggleCollapse(index);
              }
            }}
          />
          {entries.length > 1 && (
            <TouchableOpacity
              onPress={() => removeEntry(index)}
              className="p-3"
            >
              <FontAwesomeIcon 
                icon={faTrash} 
                size={16} 
                color={colorScheme.get() === "dark" ? "#FCA5A5" : "#EF4444"}
              />
            </TouchableOpacity>
          )}
        </View>
        <TextInput
          className="border border-gray-200 dark:bg-gray-700 px-4 py-3 rounded-lg text-gray-900 dark:text-white mb-2"
          value={entry.back}
          onChangeText={(value) => updateEntry(index, 'back', value)}
          placeholder="Translation (optional)"
          placeholderTextColor="#9ca3af"
          style={GlobalFontStyleSheet.textMd}
          autoCapitalize="none"
        />
        <TextInput
          className="border border-gray-200 dark:bg-gray-700 px-4 py-3 rounded-lg text-gray-900 dark:text-white"
          value={entry.tags}
          onChangeText={(value) => updateEntry(index, 'tags', value)}
          placeholder="Tags (optional, separate with commas)"
          placeholderTextColor="#9ca3af"
          style={GlobalFontStyleSheet.textMd}
          autoCapitalize="none"
        />
      </View>
    );
  };

  return (
    <SlidingModal visible={visible} onClose={handleClose}>
      <View className="w-full">
        <Text 
          style={[GlobalFontStyleSheet.textXl, { 
            color: colorScheme.get() === "dark" ? "#FFFFFF" : "#111827",
            fontWeight: '700',
            marginBottom: 24
          }]}
        >
          Add Vocabulary
        </Text>

        <ScrollView className="max-h-[400px] mb-4">
          {entries.map((entry, index) => (
            <View key={index}>
              <View className="mb-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <TextInput
                    className="flex-1 border border-gray-200 dark:bg-gray-700 px-4 py-3 rounded-lg text-gray-900 dark:text-white"
                    value={entry.front}
                    onChangeText={(value) => updateEntry(index, 'front', value)}
                    placeholder="Word/phrase"
                    placeholderTextColor="#9ca3af"
                    style={GlobalFontStyleSheet.textMd}
                    autoCapitalize="none"
                  />
                  {entries.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeEntry(index)}
                      className="p-3"
                    >
                      <FontAwesomeIcon 
                        icon={faTrash} 
                        size={16} 
                        color={colorScheme.get() === "dark" ? "#FCA5A5" : "#EF4444"}
                      />
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  className="border border-gray-200 dark:bg-gray-700 px-4 py-3 rounded-lg text-gray-900 dark:text-white mb-2"
                  value={entry.back}
                  onChangeText={(value) => updateEntry(index, 'back', value)}
                  placeholder="Translation (optional)"
                  placeholderTextColor="#9ca3af"
                  style={GlobalFontStyleSheet.textMd}
                  autoCapitalize="none"
                />
                <TextInput
                  className="border border-gray-200 dark:bg-gray-700 px-4 py-3 rounded-lg text-gray-900 dark:text-white"
                  value={entry.tags}
                  onChangeText={(value) => updateEntry(index, 'tags', value)}
                  placeholder="Tags (optional, separate with commas)"
                  placeholderTextColor="#9ca3af"
                  style={GlobalFontStyleSheet.textMd}
                  autoCapitalize="none"
                />
              </View>
              {index < entries.length - 1 && (
                <View className="h-[1px] bg-gray-200 dark:bg-gray-700 mb-4" />
              )}
            </View>
          ))}
          <View className="h-4" />
        </ScrollView>

        <TouchableOpacity
          onPress={addEntry}
          className="flex-row items-center justify-center py-3 mb-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <FontAwesomeIcon 
            icon={faPlus} 
            size={16} 
            color={colorScheme.get() === "dark" ? "#9CA3AF" : "#6B7280"}
            style={{ marginRight: 8 }}
          />
          <Text style={[GlobalFontStyleSheet.textMd, {
            color: colorScheme.get() === "dark" ? "#9CA3AF" : "#6B7280",
            fontWeight: '500'
          }]}>
            Add Another
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-[#FC5D5D] py-3 rounded-lg mb-4"
          onPress={handleImport}
          disabled={!entries.some(entry => entry.front.trim())}
        >
          <Text style={[GlobalFontStyleSheet.textMd, {
            color: '#FFFFFF',
            textAlign: 'center',
            fontWeight: '600'
          }]}>
            Add {entries.filter(e => e.front.trim()).length} Words
          </Text>
        </TouchableOpacity>
      </View>
    </SlidingModal>
  );
} 
