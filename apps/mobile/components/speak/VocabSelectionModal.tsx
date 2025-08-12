import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { useColorScheme } from '@/hooks/useColorScheme';
import FlashcardService, { Flashcard } from '@/services/FlashcardService';
import FilterModal, { FilterOptions } from '@/components/cards/FilterModal';
import { TouchableOpacity } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import cx from 'classnames';
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInDown, 
  SlideOutDown,
  withSpring,
  useAnimatedStyle,
  withTiming,
  useSharedValue
} from 'react-native-reanimated';
import { faMagnifyingGlass } from '@fortawesome/pro-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { FlashList } from "@shopify/flash-list";

interface VocabSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selectedWords: string[]) => void;
  token: string;
}

const MIN_SELECTIONS = 6;
const MAX_SELECTIONS = 24;

// Modify the VocabItem interface to include a unique ID
interface VocabItem {
  front: string;
  back: string;
  tags?: string[];
  id?: string; // Add an ID field
}

const WordItem = React.memo(({ 
  word, 
  isSelected, 
  onPress, 
  isDark, 
  disabled,
  translation,
  isFlipped,
  onFlip
}: { 
  word: string; 
  isSelected: boolean; 
  onPress: () => void; 
  isDark: boolean;
  disabled: boolean;
  translation: string;
  id: string;
  isFlipped: boolean;
  onFlip: () => void;
}) => {
  const animatedScale = useSharedValue(1);
  const animatedBorderWidth = useSharedValue(0);
  const animatedOpacity = useSharedValue(disabled ? 0.5 : 1);
  const flipAnimation = useSharedValue(isFlipped ? 1 : 0);

  // Force immediate update when selection state changes
  useEffect(() => {
    animatedBorderWidth.value = withTiming(isSelected ? 1.5 : 0, { duration: 150 });
    animatedScale.value = withSpring(isSelected ? 1.02 : 1, { 
      damping: 15,
      stiffness: 150
    });
    animatedOpacity.value = withTiming(disabled ? 0.5 : 1, { duration: 150 });
  }, [isSelected, disabled]);

  // Update flip animation when isFlipped changes
  useEffect(() => {
    flipAnimation.value = withSpring(isFlipped ? 1 : 0, {
      damping: 15,
      stiffness: 150
    });
  }, [isFlipped]);

  const frontAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: animatedScale.value },
      { rotateX: `${flipAnimation.value * 180}deg` }
    ],
    borderWidth: animatedBorderWidth.value,
    borderRadius: 10,
    borderColor: '#FC5D5D',
    opacity: animatedOpacity.value,
    backfaceVisibility: 'hidden',
  }));

  const backAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: animatedScale.value },
      { rotateX: `${(flipAnimation.value * 180) + 180}deg` }
    ],
    borderWidth: animatedBorderWidth.value,
    borderRadius: 10,
    borderColor: '#FC5D5D',
    opacity: animatedOpacity.value,
    backfaceVisibility: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  }));

  return (
    <View className="w-full mb-2 p-1">
      <Pressable
        onPress={onPress}
        disabled={disabled && !isSelected}
      >
        <Animated.View style={frontAnimatedStyle}>
          <View className={cx(
            "flex-row items-center justify-between p-3 rounded-xl",
            isSelected ? "" : isDark ? "bg-white/5" : "bg-black/[0.02]"
          )}>
            <Text 
              style={GlobalFontStyleSheet.textBase} 
              className={cx(
                "transition-colors flex-1",
                isSelected 
                  ? "text-[#FC5D5D] font-medium" 
                  : isDark ? "text-white font-normal" : "text-gray-900 font-normal"
              )}
            >
              {word}
            </Text>
            
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onFlip();
              }}
              
            >
              <FontAwesome6 
                name="language" 
                size={16} 
                color={isDark ? "#9ca3af" : "#4b5563"}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View style={backAnimatedStyle}>
          <View className={cx(
            "flex-row items-center justify-between p-3 rounded-xl h-full",
            isSelected ? "" : isDark ? "bg-white/5" : "bg-black/[0.02]"
          )}>
            <Text 
              style={GlobalFontStyleSheet.textBase} 
              className={cx(
                "flex-1",
                isDark ? "text-gray-300" : "text-gray-600"
              )}
            >
              {translation}
            </Text>
            
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onFlip();
              }}
              
            >
              <FontAwesome6 
                name="language" 
                size={16} 
                color={isDark ? "#FC5D5D" : "#FC5D5D"}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
});

export default function VocabSelectionModal({ 
  visible, 
  onClose, 
  onConfirm,
  token
}: VocabSelectionModalProps) {
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [availableVocab, setAvailableVocab] = useState<VocabItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({});
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableMonths, setAvailableMonths] = useState<{ month: string; year: number }[]>([]);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredVocab, setFilteredVocab] = useState<VocabItem[]>([]);
  // Add a state to track flipped items by their ID
  const [flippedItems, setFlippedItems] = useState<Set<string>>(new Set());

  const applyFilters = (cards: Flashcard[], filters: FilterOptions) => {
    let filtered = [...cards];

    // Filter out sentences (keep words and short phrases)
    filtered = filtered.filter(card => {
      const wordCount = card.front.trim().split(/\s+/).length;
      return wordCount <= 4;
    });

    // Apply status filters
    if (filters.status?.length) {
      filtered = filtered.filter(card => {
        return filters.status!.some(status => {
          switch (status) {
            case 'learned':
              return card.last_response && card.last_response >= 4;
            case 'almost_learned':
              return card.last_response && card.last_response >= 2 && card.last_response < 4;
            case 'difficult':
              return card.last_response && card.last_response <= 1;
            case 'not_practiced':
              return !card.last_response;
            default:
              return true;
          }
        });
      });
    }

    // Apply month filters
    if (filters.months?.length) {
      filtered = filtered.filter(card => {
        const cardDate = new Date(card.created_at);
        const monthYear = `${cardDate.toLocaleString('default', { month: 'long' })}-${cardDate.getFullYear()}`;
        return filters.months!.includes(monthYear);
      });
    }

    // Apply tag filters
    if (filters.tags?.length) {
      filtered = filtered.filter(card => {
        return filters.tags!.some(tag => card.tags.includes(tag));
      });
    }

    // Update to include both front, back, and tags of cards
    const wordsWithTranslations = filtered.map(card => ({
      front: card.front,
      back: card.back,
      tags: card.tags,
      id: `${card.front}:${card.back}` // Create a unique ID using both front and back
    }));
    setAvailableVocab(wordsWithTranslations);
  };

  const fetchVocabAndMetadata = async () => {
    if (!token) return;
    
    try {
      setIsLoading(true);
      const flashcardService = new FlashcardService(token);
      const response = await flashcardService.getFlashcards();
      
      // Get unique tags
      const tags = new Set<string>();
      response.flashcards.forEach(card => {
        card.tags?.forEach(tag => tags.add(tag));
      });
      setAvailableTags(Array.from(tags));

      // Get unique months
      const months = new Set<string>();
      response.flashcards.forEach(card => {
        if (card.created_at) {
          const date = new Date(card.created_at);
          const monthYear = `${date.toLocaleString('default', { month: 'long' })}-${date.getFullYear()}`;
          months.add(monthYear);
        }
      });
      
      const monthsArray = Array.from(months).map(monthYear => {
        const [month, year] = monthYear.split('-');
        return { month, year: parseInt(year) };
      });
      
      setAvailableMonths(monthsArray);
      
      // Apply initial filters
      applyFilters(response.flashcards, filterOptions);
    } catch (error) {
      console.error('Error fetching vocabulary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch vocab when modal opens
  useEffect(() => {
    if (visible) {
      fetchVocabAndMetadata();
    } else {
      // Reset all states when modal closes
      setSelectedWords([]);
      setFilterOptions({});
      setSearchQuery(''); // Reset search
      setFilteredVocab([]); // Reset filtered results
    }
  }, [visible]);

  // Refetch when filters change
  useEffect(() => {
    if (visible) {
      fetchVocabAndMetadata();
    }
  }, [filterOptions]);

  const toggleWord = (id: string) => {
    if (selectedWords.includes(id)) {
      setSelectedWords(prev => prev.filter(w => w !== id));
    } else {
      setSelectedWords(prev => [...prev, id]);
    }
    
    // Force a refresh of the filtered vocab to trigger re-renders
    setFilteredVocab(prev => [...prev]);
  };

  // Modify the useEffect for search filtering
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredVocab(availableVocab);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = availableVocab.filter(word => {
      // Check if word or translation matches
      if (word.front.toLowerCase().includes(query) || 
          word.back.toLowerCase().includes(query)) {
        return true;
      }
      
      // Get the original flashcard to check its tags
      const originalCard = availableVocab.find(v => v.front === word.front);
      if (originalCard && originalCard.tags) {
        // Check if any tag matches
        return originalCard.tags.some(tag => 
          tag.toLowerCase().includes(query)
        );
      }

      return false;
    });

    setFilteredVocab(filtered);
  }, [searchQuery, availableVocab]);

  // Add a function to toggle flip state
  const toggleFlip = (id: string) => {
    setFlippedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // When confirming selection, map IDs back to front text for the API
  const handleConfirm = () => {
    // Extract just the front text from each selected item
    const selectedFronts = selectedWords.map(id => {
      const item = availableVocab.find(vocab => vocab.id === id);
      return item ? item.front : '';
    }).filter(front => front !== '');
    
    onConfirm(selectedFronts);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={() => {
        setSearchQuery(''); // Reset search
        onClose();
      }}
    >
      <Animated.View 
        entering={FadeIn.duration(100)}
        exiting={FadeOut.duration(200)}
        className="flex-1 justify-center items-center bg-black/30"
      >
        <Animated.View
          entering={SlideInDown.duration(50).springify().damping(80)}
          exiting={SlideOutDown.duration(200)}
          className={cx(
            "w-[90%] max-h-[80%] rounded-2xl p-6 shadow-lg min-h-[80%]",
            isDark ? "bg-gray-800" : "bg-white"
          )}
        >
          <View className="flex-row justify-between items-start mb-4">
            <View>
              <Text style={[GlobalFontStyleSheet.textXl]} className={cx(
                "font-semibold",
                isDark ? "text-white" : "text-gray-900"
              )}>
                Select Vocab
              </Text>
              <Text style={GlobalFontStyleSheet.textSm} className={cx(
                "mt-1",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>
                Select between 6 & 24 terms to practice
              </Text>
            </View>
            <Text style={GlobalFontStyleSheet.textSm} className={cx(
              "font-medium",
              selectedWords.length === MAX_SELECTIONS ? "text-[#FC5D5D]" : 
              selectedWords.length < MIN_SELECTIONS ? "text-[#FC5D5D]" :
              (isDark ? "text-gray-400" : "text-gray-500")
            )}>
              {selectedWords.length}/{MAX_SELECTIONS}
            </Text>
          </View>

          {/* Search and Filter row */}
          <View className="flex-row gap-2 mb-2">
            <View className={cx(
              "flex-row items-center px-4 py-2.5 rounded-xl flex-1",
              isDark ? "bg-gray-700/50" : "bg-gray-50/50"
            )}>
              <FontAwesomeIcon 
                icon={faMagnifyingGlass} 
                size={16} 
                color={isDark ? "#9ca3af" : "#6b7280"}
              />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search words or tags..."
                placeholderTextColor={isDark ? "#9ca3af" : "#6b7280"}
                className={cx(
                  "flex-1 ml-2 text-base",
                  isDark ? "text-white" : "text-gray-900 "
                )}
                style={[GlobalFontStyleSheet.textMd, { height: 20 }]}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity 
                  onPress={() => setSearchQuery('')}
                  className="p-1"
                >
                  <FontAwesome6
                    name="xmark"
                    size={14}
                    color={isDark ? "#9ca3af" : "#6b7280"}
                  />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity 
              className={cx(
                "flex-row items-center p-2.5 px-3.5 rounded-xl",
                isDark ? "bg-gray-700" : "bg-[#00448F]/80"
              )}
              onPress={() => setShowFilter(true)}
            >
              <FontAwesome6
                name="sliders"
                size={16}
                color={isDark ? "#9ca3af" : "#fff"}
              />
              <Text
                style={GlobalFontStyleSheet.textSm}
                className={cx(
                  "ml-1.5 font-semibold",
                  isDark ? "text-gray-200" : "text-white"
                )}
              >
                Filter
              </Text>
              {Object.keys(filterOptions).length > 0 && (
                <View className="ml-1.5 w-2 h-2 rounded-full bg-[#FC5D5D]" />
              )}
            </TouchableOpacity>
          </View>

          {(isLoading || filteredVocab.length === 0) ? (
            <View className="flex-1 justify-center items-center py-10">
              <Text style={GlobalFontStyleSheet.textBase} className={isDark ? "text-white" : "text-gray-900"}>
                {isLoading ? 'Loading vocabulary...' : 
                  searchQuery ? 'No matching words found' : 'No vocabulary words found'}
              </Text>
            </View>
          ) : (
            <View className="flex-1">
              <FlashList
                data={filteredVocab}
                extraData={[selectedWords, flippedItems]} // Include flippedItems in extraData
                renderItem={({ item, index }) => (
                  <WordItem
                    word={item.front}
                    translation={item.back}
                    isSelected={selectedWords.includes(item.id || '')}
                    onPress={() => {
                      if (selectedWords.includes(item.id || '') || selectedWords.length < MAX_SELECTIONS) {
                        toggleWord(item.id || '', item.front);
                      }
                    }}
                    isDark={isDark}
                    disabled={!selectedWords.includes(item.id || '') && selectedWords.length >= MAX_SELECTIONS}
                    id={item.id || `${item.front}-${item.back}-${index}`}
                    isFlipped={flippedItems.has(item.id || `${item.front}-${item.back}-${index}`)}
                    onFlip={() => toggleFlip(item.id || `${item.front}-${item.back}-${index}`)}
                  />
                )}
                keyExtractor={(item, index) => item.id || `${item.front}-${item.back}-${index}`}
                estimatedItemSize={70}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 4 }}
              />
            </View>
          )}

          <View className="flex-row justify-between mt-4 gap-2">
            <TouchableOpacity
              onPress={onClose}
              className={cx(
                "flex-1 py-3.5 rounded-xl items-center",
                isDark ? "bg-white/10" : "bg-gray-500/90"
              )}
            >
              <Text style={GlobalFontStyleSheet.textBase} className="text-white font-semibold">
                Go back
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={selectedWords.length < MIN_SELECTIONS}
              className={cx(
                "flex-1 py-3.5 rounded-xl items-center",
                selectedWords.length < MIN_SELECTIONS 
                  ? (isDark ? "bg-white/5" : "bg-[#FC5D5D]/50")
                  : "bg-[#FC5D5D]/85"
              )}
            >
              <Text style={GlobalFontStyleSheet.textBase} className={cx(
                "font-semibold",
                selectedWords.length < MIN_SELECTIONS 
                  ? (isDark ? "text-gray-500" : "text-white")
                  : "text-white"
              )}>
                {selectedWords.length < MIN_SELECTIONS 
                  ? `Select ${MIN_SELECTIONS - selectedWords.length} more`
                  : "Start chat"
                }
              </Text>
            </TouchableOpacity>
          </View>

          {showFilter && (
            <FilterModal
              visible={true}
              onClose={() => setShowFilter(false)}
              onApplyFilters={(filters) => {
                setFilterOptions(filters);
                setShowFilter(false);
              }}
              availableTags={availableTags}
              availableMonths={availableMonths}
              activeFilters={filterOptions}
            />
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
