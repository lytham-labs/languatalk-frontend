import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { ThemedText } from '@/components/shared/ThemedText';
import { ThemedView } from '@/components/shared/ThemedView';

interface TimezoneOption {
  value: string;
  label: string;
}

interface TimezonePickerProps {
  selectedValue?: string;
  onValueChange: (value: string) => void;
  items: TimezoneOption[];
  placeholder?: string;
  disabled?: boolean;
}

export default function TimezonePicker({
  selectedValue,
  onValueChange,
  items,
  placeholder = "Select timezone",
  disabled = false,
}: TimezonePickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const selectedItem = items.find(item => item.value === selectedValue);

  const filteredItems = items.filter(item =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (value: string) => {
    onValueChange(value);
    setModalVisible(false);
    setSearchQuery('');
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.pickerButton,
          {
            backgroundColor: isDark ? Colors.dark.background : Colors.light.background,
            borderColor: isDark ? Colors.dark.border : Colors.light.border,
          },
          disabled && styles.disabled,
        ]}
        onPress={() => {
          if (!disabled) {
            setModalVisible(true);
          }
        }}
        disabled={disabled}
      >
        <Text
          style={[
            styles.pickerText,
            {
                             color: selectedItem
                 ? (isDark ? Colors.dark.text : Colors.light.text)
                 : (isDark ? Colors.dark.placeholderText : Colors.light.placeholderText),
            },
          ]}
        >
          {selectedItem ? selectedItem.label : placeholder}
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={isDark ? Colors.dark.text : Colors.light.text}
        />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Timezone</ThemedText>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? Colors.dark.text : Colors.light.text}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons
                name="search"
                size={20}
                color={isDark ? Colors.dark.icon : Colors.light.icon}
                style={styles.searchIcon}
              />
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    color: isDark ? Colors.dark.text : Colors.light.text,
                    backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                  },
                ]}
                placeholder="Search timezones..."
                placeholderTextColor={isDark ? '#8E8E93' : '#C7C7CC'}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <FlatList
              data={filteredItems}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.timezoneItem,
                    {
                      backgroundColor: isDark ? Colors.dark.background : Colors.light.background,
                      borderBottomColor: isDark ? Colors.dark.border : Colors.light.border,
                    },
                    selectedValue === item.value && {
                      backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE',
                    },
                  ]}
                  onPress={() => handleSelect(item.value)}
                >
                  <Text
                    style={[
                      styles.timezoneText,
                      {
                        color: isDark ? Colors.dark.text : Colors.light.text,
                      },
                      selectedValue === item.value && {
                        color: isDark ? '#FFFFFF' : '#1E3A8A',
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {selectedValue === item.value && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={isDark ? '#FFFFFF' : '#1E3A8A'}
                    />
                  )}
                </TouchableOpacity>
              )}
              style={styles.timezoneList}
            />
          </ThemedView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 48,
  },
  pickerText: {
    flex: 1,
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  timezoneList: {
    maxHeight: 400,
  },
  timezoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  timezoneText: {
    flex: 1,
    fontSize: 16,
  },
}); 