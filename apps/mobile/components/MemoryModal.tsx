import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Alert, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { ThemedText } from '@/components/shared/ThemedText';
import { ThemedView } from '@/components/shared/ThemedView';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faXmark, faSave } from '@fortawesome/pro-solid-svg-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { GlobalFontStyleSheet } from '@/constants/Font';
import SlidingModal from '@/components/shared/SlidingModal';
import { Memory, Category } from '@/services/MemoriesService';

interface MemoryModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (memoryData: { content: string; category: string; date?: string }) => Promise<void>;
  memory?: Memory | null; // null for create, Memory object for edit
  categories: Category[];
  loading?: boolean;
}

const MemoryModal: React.FC<MemoryModalProps> = ({
  isVisible,
  onClose,
  onSave,
  memory,
  categories,
  loading = false,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textColor = isDark ? Colors.dark.text : Colors.light.text;
  const backgroundColor = isDark ? Colors.dark.background : Colors.light.background;
  const borderColor = isDark ? '#374151' : '#e5e7eb';

  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState('');

  const isEditing = !!memory;

  // Reset form when modal opens/closes or memory changes
  useEffect(() => {
    if (isVisible) {
      if (memory) {
        // Editing existing memory
        setContent(memory.content);
        setCategory(memory.category);
        setDate(memory.date || '');
      } else {
        // Creating new memory
        setContent('');
        setCategory('');
        setDate('');
      }
    }
  }, [isVisible, memory]);

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Error', 'Please enter memory content');
      return;
    }

    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    try {
      await onSave({
        content: content.trim(),
        category,
        date: date || undefined,
      });
      onClose();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <SlidingModal
      visible={isVisible}
      onClose={onClose}
      showCloseButton={false}
    >
      <View style={{ paddingHorizontal: 20, paddingBottom: 20, paddingTop: 20 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <ThemedText style={[GlobalFontStyleSheet.textXl, { fontFamily: 'Lato-Bold', color: textColor }]}>
            {isEditing ? 'Edit Memory' : 'Add New Memory'}
          </ThemedText>
        </View>

        {/* Content Input */}
        <View style={{ marginBottom: 20 }}>
          <ThemedText style={[GlobalFontStyleSheet.textBase, { color: textColor, marginBottom: 8, fontFamily: 'Lato-Bold' }]}>
            Memory Content *
          </ThemedText>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: borderColor,
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
              color: textColor,
              backgroundColor: backgroundColor,
              minHeight: 100,
              textAlignVertical: 'top',
            }}
            placeholder="Enter the memory content..."
            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Category Selection */}
        <View style={{ marginBottom: 20 }}>
          <ThemedText style={[GlobalFontStyleSheet.textBase, { color: textColor, marginBottom: 8, fontFamily: 'Lato-Bold' }]}>
            Category *
          </ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setCategory(cat.key)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: category === cat.key ? '#3b82f6' : borderColor,
                  backgroundColor: category === cat.key ? '#3b82f6' : backgroundColor,
                }}
              >
                <ThemedText
                  style={[
                    GlobalFontStyleSheet.textSm,
                    {
                      color: category === cat.key ? '#ffffff' : textColor,
                      fontFamily: 'Lato-Bold',
                    },
                  ]}
                >
                  {cat.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date Input (Optional) */}
        <View style={{ marginBottom: 30 }}>
          <ThemedText style={[GlobalFontStyleSheet.textBase, { color: textColor, marginBottom: 8, fontFamily: 'Lato-Bold' }]}>
            Date (Optional)
          </ThemedText>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: borderColor,
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
              color: textColor,
              backgroundColor: backgroundColor,
            }}
            placeholder="YYYY-MM-DD (optional)"
            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
            value={date}
            onChangeText={setDate}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading}
          style={{
            backgroundColor: loading ? '#9ca3af' : '#3b82f6',
            paddingVertical: 16,
            paddingHorizontal: 24,
            borderRadius: 12,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            marginBottom: 20, // Add extra bottom margin for keyboard
          }}
        >
          <FontAwesomeIcon icon={faSave} size={16} color="#ffffff" style={{ marginRight: 8 }} />
          <ThemedText style={[GlobalFontStyleSheet.textBase, { color: '#ffffff', fontFamily: 'Lato-Bold' }]}>
            {loading ? 'Saving...' : (isEditing ? 'Update Memory' : 'Save Memory')}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </SlidingModal>
  );
};

export default MemoryModal; 
