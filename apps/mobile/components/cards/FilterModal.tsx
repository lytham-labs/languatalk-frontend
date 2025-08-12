import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronRight, faChevronDown, faCheck } from '@fortawesome/free-solid-svg-icons';
import { GlobalFontStyleSheet } from '@/constants/Font';
import SlidingModal from '@/components/shared/SlidingModal';
import { colorScheme } from 'nativewind';

export interface FilterOptions {
  status?: string[];
  months?: string[];
  tags?: string[];
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: FilterOptions) => void;
  availableTags: string[];
  availableMonths: { month: string; year: number }[];
  activeFilters: FilterOptions;
}

const FilterDropdown = ({ 
  title, 
  isOpen, 
  onToggle,
  selectedCount
}: { 
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  selectedCount: number;
}) => (
  <TouchableOpacity
    onPress={onToggle}
    className="flex-row items-center py-2 bg-white dark:bg-gray-800 rounded-xl mb-2"
  >
    <FontAwesomeIcon 
      icon={isOpen ? faChevronDown : faChevronRight} 
      size={16} 
      color={colorScheme.get() === "dark" ? "#9ca3af" : "#6B7280"}
      style={{ marginRight: 12 }}
    />
    <Text style={[GlobalFontStyleSheet.textLg, { 
      color: colorScheme.get() === "dark" ? "#FFFFFF" : "#111827",
      fontWeight: '600' 
    }]}>
      {title}
    </Text>
    {selectedCount > 0 && (
      <View className="ml-2 px-2 py-0.5 bg-[#FC5D5D] rounded-full">
        <Text className="text-white text-sm font-medium">{selectedCount}</Text>
      </View>
    )}
  </TouchableOpacity>
);

const FilterOption = ({ 
  label, 
  selected, 
  onSelect 
}: { 
  label: string; 
  selected: boolean; 
  onSelect: () => void;
}) => (
  <TouchableOpacity
    onPress={onSelect}
    className="flex-row justify-start py-3.5 px-4"
  >
    <View className={`w-6 h-6 rounded-lg flex items-center justify-center mr-3
      ${selected ? 'bg-[#FC5D5D]' : 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'}`}
    >
      {selected && (
        <FontAwesomeIcon icon={faCheck} size={12} color="#ffffff" />
      )}
    </View>
    <Text style={[
      GlobalFontStyleSheet.textMd,
      { 
        color: selected ? '#FC5D5D' : colorScheme.get() === "dark" ? "#FFFFFF" : "#374151"
      }
    ]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const FilterModal = ({ visible, onClose, onApplyFilters, availableTags, availableMonths, activeFilters }: FilterModalProps) => {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      setSelectedStatuses(new Set(activeFilters.status || []));
      setSelectedMonths(new Set(activeFilters.months || []));
      setSelectedTags(new Set(activeFilters.tags || []));
    }
  }, [visible, activeFilters]);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const statusOptions = [
    { label: 'Learned', value: 'learned' },
    { label: 'Almost Learned', value: 'almost_learned' },
    { label: 'Difficult Words', value: 'difficult' },
    { label: 'Not Practiced', value: 'not_practiced' },
  ];

  const handleApply = () => {
    const filters: FilterOptions = {};
    if (selectedStatuses.size > 0) filters.status = Array.from(selectedStatuses);
    if (selectedMonths.size > 0) filters.months = Array.from(selectedMonths);
    if (selectedTags.size > 0) filters.tags = Array.from(selectedTags);
    onApplyFilters(filters);
    onClose();
  };

  const handleReset = () => {
    setOpenSection(null);
    setSelectedStatuses(new Set());
    setSelectedMonths(new Set());
    setSelectedTags(new Set());
    onApplyFilters({});
    onClose();
  };

  return (
    <SlidingModal visible={visible} onClose={onClose}>
      <View className="flex-1 px-1">
        <Text style={[GlobalFontStyleSheet.textXl, { 
          color: colorScheme.get() === "dark" ? "#FFFFFF" : "#111827",
          fontWeight: '700',
          marginBottom: 24
        }]}>
          Filter Flashcards
        </Text>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Status Dropdown */}
          <View className="mb-4">
            <FilterDropdown
              title="Status"
              isOpen={openSection === 'status'}
              onToggle={() => toggleSection('status')}
              selectedCount={selectedStatuses.size}
            />
            {openSection === 'status' && (
              <View className="ml- mt-2">
                {statusOptions.map((option) => (
                  <FilterOption
                    key={option.value}
                    label={option.label}
                    selected={selectedStatuses.has(option.value)}
                    onSelect={() => {
                      setSelectedStatuses(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(option.value)) {
                          newSet.delete(option.value);
                        } else {
                          newSet.add(option.value);
                        }
                        return newSet;
                      });
                    }}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Months Dropdown */}
          <View className="mb-4">
            <FilterDropdown
              title="Month Added"
              isOpen={openSection === 'months'}
              onToggle={() => toggleSection('months')}
              selectedCount={selectedMonths.size}
            />
            {openSection === 'months' && availableMonths.length > 0 && (
              <View className="ml-8 mt-2">
                {availableMonths.map((monthData) => {
                  const monthKey = `${monthData.month}-${monthData.year}`;
                  return (
                    <FilterOption
                      key={monthKey}
                      label={`${monthData.month} ${monthData.year}`}
                      selected={selectedMonths.has(monthKey)}
                      onSelect={() => {
                        setSelectedMonths(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(monthKey)) {
                            newSet.delete(monthKey);
                          } else {
                            newSet.add(monthKey);
                          }
                          return newSet;
                        });
                      }}
                    />
                  );
                })}
              </View>
            )}
          </View>

          {/* Tags Dropdown */}
          {availableTags.length > 0 && (
            <View className="mb-4">
              <FilterDropdown
                title="Tags"
                isOpen={openSection === 'tags'}
                onToggle={() => toggleSection('tags')}
                selectedCount={selectedTags.size}
              />
              {openSection === 'tags' && (
                <View className="ml-8 mt-2">
                  {availableTags.map((tag) => (
                    <FilterOption
                      key={tag}
                      label={tag}
                      selected={selectedTags.has(tag)}
                      onSelect={() => {
                        setSelectedTags(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(tag)) {
                            newSet.delete(tag);
                          } else {
                            newSet.add(tag);
                          }
                          return newSet;
                        });
                      }}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View className="flex-row gap-3 mt-4">
          <TouchableOpacity
            onPress={handleReset}
            className="flex-1 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700"
          >
            <Text style={[GlobalFontStyleSheet.textMd, {
              textAlign: 'center',
              color: colorScheme.get() === "dark" ? "#FFFFFF" : "#374151",
              fontWeight: '600'
            }]}>
              Reset
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleApply}
            className="flex-1 py-3.5 rounded-xl bg-[#FC5D5D]"
          >
            <Text style={[GlobalFontStyleSheet.textMd, {
              textAlign: 'center',
              color: '#FFFFFF',
              fontWeight: '600'
            }]}>
              Apply
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SlidingModal>
  );
};

export default FilterModal;
