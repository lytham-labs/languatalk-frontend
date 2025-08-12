import React, { useState, useEffect, useRef } from "react";
import {
  View,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Text,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Pressable,
  Platform,
  Dimensions,
  Alert,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { ThemedText } from "@/components/shared/ThemedText";
import { ThemedView } from "@/components/shared/ThemedView";
import {
  getDeviceType,
  getFontSize,
  getIconSize,
  GlobalFontStyleSheet,
} from "@/constants/Font";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import {
  faFilter,
  faPencil,
  faMagnifyingGlass,
  faPlus,
  faGraduationCap,
  faBookOpen,
  faBookmark,
  faCheck,
  faTrash,
  faTags,
  faSparkles,
  faFileImport,
  faPenToSquare,
  faEllipsisVertical,
} from "@fortawesome/pro-solid-svg-icons";
import { useAuth } from "@/contexts/AuthContext";
import FlashcardService, {
  Flashcard,
  FlashcardsResponse,
  GeneratedWord,
} from "@/services/FlashcardService";
import cx from "classnames";
import { colorScheme } from "nativewind";
import SlidingModal from "@/components/shared/SlidingModal";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useFocusEffect } from "@react-navigation/native";
import useUserSettings from "@/services/api/useUserSettings";
import FilterModal, { FilterOptions } from '@/components/cards/FilterModal';
import GenerateFlashcardsModal from '@/components/cards/GenerateFlashcardsModal';
import VocabModal from '@/components/cards/VocabModal';
import AudioPlayerService from '@/services/AudioPlayerService';
import { Audio } from 'expo-av';
import DeleteAlert from '@/components/cards/DeleteAlert';
import DropdownMenu from "@/components/shared/DropdownMenu";
import ImportVocabModal from '@/components/cards/ImportVocabModal';
import { FlashList } from "@shopify/flash-list";
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const StatNumber = ({ children }: { children: React.ReactNode }) => (
  <View className="items-center px-2 py-3 tablet:px-8 tablet:py-6 rounded-2xl relative">
    <View className="space-y-1 tablet:space-y-3 items-center">{children}</View>
  </View>
);

const formatFilterStatus = (filters: FilterOptions): string => {
  const parts: string[] = [];
  
  if (filters.status?.length) {
    // Convert status filters to more readable format
    const statusMap: Record<string, string> = {
      learned: "learned words",
      almost_learned: "almost learned words",
      difficult: "difficult words",
      not_practiced: "unpracticed words"
    };
    parts.push(filters.status.map(s => statusMap[s]).join(", "));
  }
  
  if (filters.months?.length) {
    if (filters.months.length === 1) {
      const [month, year] = filters.months[0].split('-');
      parts.push(`added in ${month} ${year}`);
    } else {
      parts.push(`added in ${filters.months.length} months`);
    }
  }
  
  if (filters.tags?.length) {
    if (filters.tags.length === 1) {
      parts.push(`tagged "${filters.tags[0]}"`);
    } else {
      parts.push(`with ${filters.tags.length} tags`);
    }
  }

  return parts.join(" • ");
};

export default function CardsScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [metadata, setMetadata] = useState<FlashcardsResponse["metadata"]>({
    learned_count: 0,
    almost_learned_count: 0,
    saved_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();
  const flashcardService = new FlashcardService(token ?? "");
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const router = useRouter();
  const { userSettings } = useUserSettings();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [newTags, setNewTags] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterOptions>({});
  const [allFlashcards, setAllFlashcards] = useState<Flashcard[]>([]);
  const [filteredFlashcards, setFilteredFlashcards] = useState<Flashcard[]>([]);
  const [selectedFlashcard, setSelectedFlashcard] = useState<Flashcard | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const audioPlayer = useRef(new AudioPlayerService()).current;
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    const configureAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });
      } catch (error) {
        console.error('Error configuring audio:', error);
      }
    };

    configureAudio();
  }, []);

  const loadData = async () => {
    if (!token) return;

    try {
      const response = await flashcardService.getFlashcards({
        query: searchQuery || undefined,
      });

      setAllFlashcards(response.flashcards);
      setFilteredFlashcards(response.flashcards);
      setMetadata(response.metadata);
    } catch (error) {
      console.error("Error loading flashcard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (cards: Flashcard[], filters: FilterOptions) => {
    let filtered = [...cards];

    // Apply status filters
    if (filters.status && filters.status.length > 0) {
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
    if (filters.months && filters.months.length > 0) {
      filtered = filtered.filter(card => {
        const cardDate = new Date(card.created_at);
        const monthYear = `${cardDate.toLocaleString('default', { month: 'long' })}-${cardDate.getFullYear()}`;
        return filters.months!.includes(monthYear);
      });
    }

    // Apply tag filters
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(card => {
        return filters.tags!.some(tag => card.tags.includes(tag));
      });
    }

    setFilteredFlashcards(filtered);
    
    // Update metadata based on filtered results
    setMetadata({
      learned_count: filtered.filter(f => f.last_response && f.last_response >= 4).length,
      almost_learned_count: filtered.filter(f => f.last_response && f.last_response >= 2 && f.last_response < 4).length,
      saved_count: filtered.length
    });
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (allFlashcards.length > 0) {
        let searchFiltered = allFlashcards;
        
        if (searchQuery.trim() !== '') {
          searchFiltered = allFlashcards.filter(card => 
            card.front.toLowerCase().includes(searchQuery.toLowerCase()) ||
            card.back.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
        
        applyFilters(searchFiltered, activeFilters);
      }
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeFilters, allFlashcards]);

  const handleVocabPress = (flashcard: Flashcard) => {
    setSelectedFlashcard(flashcard);
    setIsModalVisible(true);
  };

  const playAudio = async (word: string) => {
    try {
      const language = userSettings?.team?.stream_language || "en";
      const audioUrl = `https://api.streamlanguage.com/api/v1/tts?text=${encodeURIComponent(word)}&language=${language}`;
      
      console.log('Language:', language);
      console.log('Word:', word);
      console.log('Audio URL:', audioUrl);
      
      await audioPlayer.playSound(
        audioUrl,
        null,
        'vocab-modal',
        false,
        'off',
        word,
        (status) => {
          console.log('Playback status:', status);
        }
      );
    } catch (error) {
      console.error('Error playing audio:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
      }
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const VocabItem = React.memo(({ flashcard }: { flashcard: Flashcard }) => (
    <TouchableOpacity 
      onPress={() => {
        if (isEditMode) {
          toggleSelection(flashcard.id);
        } else {
          handleVocabPress(flashcard);
        }
      }}
    >
      <View className="flex-row justify-between items-center h-14 md:h-16 px-4 mb-2">
        {isEditMode && (
          <View
            className={`w-6 h-6 border-2 rounded-md flex items-center justify-center mr-4
              ${
                selectedItems.has(flashcard.id)
                  ? "bg-[#FC5D5D] border-[#FC5D5D]"
                  : "border-gray-300 dark:border-gray-600"
              }`}
          >
            {selectedItems.has(flashcard.id) && (
              <FontAwesomeIcon icon={faCheck} size={12} color="#ffffff" />
            )}
          </View>
        )}
        <View className="flex-1 md:mx-4">
          <View className="border-b border-gray-200 dark:border-gray-700 h-full justify-center">
            <View className="flex-row justify-between items-center">
              <ThemedText
                style={GlobalFontStyleSheet.textMd}
                className="text-gray-900 dark:text-white flex-1"
              >
                {flashcard.front}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  ));

  const ActionButton = ({
    title,
    isActive = true,
    onPress,
  }: {
    title: string;
    isActive?: boolean;
    onPress?: () => void;
  }) => {
    const screenWidth = Dimensions.get('window').width;
    const isSmallPhone = screenWidth < 400; // iPhone SE and similar sized devices
    const deviceType = getDeviceType();

    const handlePress = () => {
      if (!onPress) return;
      
      // For the Chat button, always use the direct onPress handler
      if (title === "Chat") {
        onPress();
        return;
      }
      
      if (Object.keys(activeFilters).length > 0) {
        const filterParams = encodeURIComponent(JSON.stringify(activeFilters));
        console.log('Index - Active filters being passed:', activeFilters);
        console.log('Index - Encoded filter params:', filterParams);
        const path = `/cards/${title.toLowerCase()}`;
        router.push({
          pathname: path as any,
          params: { filters: filterParams }
        });
      } else {
        onPress();
      }
    };

    const buttonClasses = cx(
      "py-3 px-3 md:py-6 md:px-4 rounded-xl items-center justify-center",
      {
        "bg-red-400": title !== "Chat" || isActive,
        "bg-[rgba(252,93,93,0.1)] border-2 border-[#FC5D5D]":
          title === "Chat" && !isActive,
      }
    );

    const textColors = {
      lightColor: title === "Chat" && !isActive ? "#FC5D5D" : "#ffffff",
      darkColor: "#ffffff",
    };

    return (
      <TouchableOpacity className={buttonClasses} onPress={handlePress}>
        <ThemedText
          style={[
            GlobalFontStyleSheet.textMd,
            deviceType === "tablet" && { fontSize: getFontSize(14) },
            deviceType === "phone" && !isSmallPhone && { fontSize: getFontSize(15) },
            deviceType === "phone" && isSmallPhone && { fontSize: getFontSize(14) }
          ]}
          className="font-extrabold text-center"
          {...textColors}
        >
          {title}
        </ThemedText>
      </TouchableOpacity>
    );
  };
  
  const handleDelete = (id: string) => {
    setFlashcards(prev => prev.filter(card => card.id !== id));
    setFilteredFlashcards(prev => prev.filter(card => card.id !== id));
    setMetadata(prev => ({
      ...prev,
      saved_count: prev.saved_count - 1,
    }));
  };

  const handleSingleFlashcardTagUpdate = async (id: string, newTags: string) => {
    try {
      // Always send an array, even if empty
      const tagsArray = newTags
        ? newTags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0)
        : [];

      await flashcardService.updateFlashcard(id, { tags: tagsArray });
      await loadData();
    } catch (error) {
      console.error("Error updating tags:", error);
      Alert.alert(
        "Error",
        "Failed to update tags. Please try again."
      );
    }
  };

  // ---------------------------------------------------
  // Optimistic Bulk Delete
  // ---------------------------------------------------
  const handleBulkDelete = () => {
    setShowDeleteConfirmation(false); // Hide the alert immediately
    const ids = Array.from(selectedItems);
  
    // Optimistically update UI state by removing the selected flashcards.
    const updatedAllFlashcards = allFlashcards.filter(card => !ids.includes(card.id));
    const updatedFilteredFlashcards = filteredFlashcards.filter(card => !ids.includes(card.id));
    setAllFlashcards(updatedAllFlashcards);
    setFilteredFlashcards(updatedFilteredFlashcards);
  
    // Recalculate metadata based on the updated filtered flashcards.
    setMetadata({
      learned_count: updatedFilteredFlashcards.filter(f => f.last_response && f.last_response >= 4).length,
      almost_learned_count: updatedFilteredFlashcards.filter(f => f.last_response && f.last_response >= 2 && f.last_response < 4).length,
      saved_count: updatedFilteredFlashcards.length,
    });
  
    setSelectedItems(new Set());
    setIsEditMode(false);
  
    // Execute deletion in the background
    Promise.all(ids.map(id => flashcardService.deleteFlashcard(id)))
      .catch(error => {
        console.error("Error deleting flashcards:", error);
      });
  };

  // ---------------------------------------------------
  // Optimistic Update Tags (Bulk)
  // ---------------------------------------------------
  const handleUpdateTags = (ids: string[], newTags: string) => {
    const newTagsArray = newTags
      ? newTags.split(",").map((tag) => tag.trim()).filter((tag) => tag.length > 0)
      : [];

    // Optimistically update flashcards' tags in local state by merging new and existing tags.
    setAllFlashcards(prev =>
      prev.map(card => {
        if (ids.includes(card.id)) {
          const mergedTags = Array.from(new Set([...card.tags, ...newTagsArray]));
          return { ...card, tags: mergedTags };
        }
        return card;
      })
    );

    setFilteredFlashcards(prev =>
      prev.map(card => {
        if (ids.includes(card.id)) {
          const mergedTags = Array.from(new Set([...card.tags, ...newTagsArray]));
          return { ...card, tags: mergedTags };
        }
        return card;
      })
    );

    // Update each flashcard on the server individually.
    Promise.all(
      ids.map(id => {
        // Find the flashcard from the current list; if not found, fallback to newTagsArray.
        const card = allFlashcards.find(card => card.id === id);
        const currentTags = card?.tags || [];
        const mergedTags = Array.from(new Set([...currentTags, ...newTagsArray]));
        return flashcardService.updateFlashcard(id, { tags: mergedTags });
      })
    ).catch(error => {
      console.error("Error updating tags:", error);
      Alert.alert("Error", "Failed to update tags. Please try again.");
    });
  };

  const handleAddExistingTagToBulk = (tagToAdd: string) => {
    const currentTags = newTags
      ? newTags.split(",").map((tag) => tag.trim()).filter((tag) => tag.length > 0)
      : [];
    
    if (!currentTags.includes(tagToAdd)) {
      const updatedTags = [...currentTags, tagToAdd].join(", ");
      setNewTags(updatedTags);
    }
  };

  const getAvailableTagsForBulk = () => {
    const currentTagsArray = newTags
      ? newTags.split(",").map((tag) => tag.trim()).filter((tag) => tag.length > 0)
      : [];
    
    return getUniqueTags().filter(tag => !currentTagsArray.includes(tag));
  };

  const getUniqueTags = () => {
    const tagSet = new Set<string>();
    allFlashcards.forEach(card => {
      card.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  };

  const getAvailableMonths = () => {
    const monthsSet = new Set<string>();
    allFlashcards.forEach(card => {
      const date = new Date(card.created_at);
      const monthYear = {
        month: date.toLocaleString('default', { month: 'long' }),
        year: date.getFullYear()
      };
      monthsSet.add(`${monthYear.month}-${monthYear.year}`);
    });
    
    return Array.from(monthsSet)
      .map(monthYear => {
        const [month, year] = monthYear.split('-');
        return { month, year: parseInt(year) };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return MONTHS.indexOf(b.month) - MONTHS.indexOf(a.month);
      });
  };

  const handleUpdateTranslation = async (id: string, newTranslation: string) => {
    try {
      await flashcardService.updateFlashcard(id, {
        back: newTranslation
      });
      await loadData();
    } catch (error) {
      console.error("Error updating translation:", error);
    }
  };

  const handleUpdateFront = async (id: string, newFront: string) => {
    try {
      await flashcardService.updateFlashcard(id, {
        front: newFront
      });
      await loadData();
    } catch (error) {
      console.error("Error updating front:", error);
    }
  };

  const renderActionsButton = () => {
    if (Platform.OS === 'ios') {
      return (
        <DropdownMenu
          options={[
            {
              label: 'Create with AI',
              onPress: () => setShowGenerateModal(true),
              icon: faSparkles,
            },
            {
              label: 'Edit',
              onPress: () => setIsEditMode(true),
              icon: faPenToSquare,
            },
            {
              label: 'Add',
              onPress: () => setShowImportModal(true),
              icon: faFileImport,
            },
          ]}
        />
      );
    }

    return (
      <Pressable 
        onPress={() => setShowMenu(true)} 
        className="flex-row items-center p-3 px-4 bg-white dark:bg-gray-700 rounded-xl shadow-sm"
      >
        <FontAwesomeIcon
          icon={faEllipsisVertical}
          size={18}
          color="#00448F"
        />
        <Text
          style={[
            GlobalFontStyleSheet.textSm,
            {
              marginLeft: 6,
              fontWeight: "bold",
              color: colorScheme.get() === "dark" ? "#9ca3af" : "#6b7280",
            },
          ]}
        >
          Actions
        </Text>
        
        
      </Pressable>
    );
  };

  const renderAndroidMenu = () => {
    if (Platform.OS !== 'android') return null;

    return (
      <Modal
        transparent={true}
        visible={showMenu}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.menuContainer}>
              <TouchableOpacity
                onPress={() => {
                  setShowMenu(false);
                  setShowGenerateModal(true);
                }}
                style={styles.menuItem}
              >
                <FontAwesomeIcon
                  icon={faSparkles}
                  size={getDeviceType() === "phone" && Dimensions.get('window').width < 400 ? 14 : 16}
                  color="#00448F"
                  style={{ marginRight: 8 }}
                />
                <Text style={[GlobalFontStyleSheet.textMd, styles.menuItemText]}>
                  Create with AI
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowMenu(false);
                  setShowImportModal(true);
                }}
                style={styles.menuItem}
              >
                <FontAwesomeIcon
                  icon={faFileImport}
                  size={getDeviceType() === "phone" && Dimensions.get('window').width < 400 ? 14 : 16}
                  color="#00448F"
                  style={{ marginRight: 8 }}
                />
                <Text style={[GlobalFontStyleSheet.textMd, styles.menuItemText]}>
                  Import
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowMenu(false);
                  setIsEditMode(true);
                }}
                style={styles.menuItem}
              >
                <FontAwesomeIcon
                  icon={faPenToSquare}
                  size={getDeviceType() === "phone" && Dimensions.get('window').width < 400 ? 14 : 16}
                  color="#00448F"
                  style={{ marginRight: 8 }}
                />
                <Text style={[GlobalFontStyleSheet.textMd, styles.menuItemText]}>
                  Edit
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuContainer: {
      backgroundColor: '#fff',
      borderRadius: 8,
      elevation: 5,
      paddingVertical: 8,
      minWidth: 200,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    menuItemText: {
      color: '#6b7280',
    },
  });

  if (loading) {
    return (
      <ThemedView className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1 bg-white dark:bg-gray-900 pt-3">
        {/* Stats Row */}
        <View className="flex-row justify-between py-2 mb-2 mx-4 gap-4">
          <View className="flex-1 rounded-2xl bg-white dark:bg-gray-700 relative">
            <View className="absolute top-2 right-2 tablet:top-3 tablet:right-3 z-10">
              <FontAwesomeIcon
                icon={faGraduationCap}
                size={
                  getDeviceType() === "tablet"
                    ? getIconSize(20)
                    : getIconSize(16)
                }
                color={colorScheme.get() === "dark" ? "#FFFFFF" : "#111827"}
              />
            </View>
            <StatNumber>
              <ThemedText
                style={GlobalFontStyleSheet.text2Xl}
                className="font-bold"
                lightColor="#059669"
                darkColor="#34D399"
              >
                {metadata.learned_count}
              </ThemedText>
              <ThemedText
                style={GlobalFontStyleSheet.textSm}
                className="text-center"
                lightColor="#6B7280"
                darkColor="#9CA3AF"
              >
                Learned
              </ThemedText>
            </StatNumber>
          </View>
          <View className="flex-1 rounded-2xl bg-white dark:bg-gray-700 relative">
            <View className="absolute top-2 right-2 tablet:top-3 tablet:right-3 z-10">
              <FontAwesomeIcon
                icon={faBookOpen}
                size={
                  getDeviceType() === "tablet"
                    ? getIconSize(20)
                    : getIconSize(16)
                }
                color={colorScheme.get() === "dark" ? "#FFFFFF" : "#111827"}
              />
            </View>
            <StatNumber>
              <ThemedText
                style={GlobalFontStyleSheet.text2Xl}
                className="font-bold"
                lightColor="#F97316"
                darkColor="#FB923C"
              >
                {metadata.almost_learned_count}
              </ThemedText>
              <ThemedText
                style={GlobalFontStyleSheet.textSm}
                className="text-center"
                lightColor="#6B7280"
                darkColor="#9CA3AF"
              >
                Almost learned
              </ThemedText>
            </StatNumber>
          </View>
          <View className="flex-1 rounded-2xl bg-white dark:bg-gray-700 relative">
            <View className="absolute top-2 right-2 tablet:top-3 tablet:right-3 z-10">
              <FontAwesomeIcon
                icon={faBookmark}
                size={
                  getDeviceType() === "tablet"
                    ? getIconSize(20)
                    : getIconSize(16)
                }
                color={colorScheme.get() === "dark" ? "#FFFFFF" : "#111827"}
              />
            </View>
            <StatNumber>
              <ThemedText
                style={GlobalFontStyleSheet.text2Xl}
                className="font-bold"
                lightColor="#111827"
                darkColor="#FFFFFF"
              >
                {metadata.saved_count}
              </ThemedText>
              <ThemedText
                style={GlobalFontStyleSheet.textSm}
                className="text-center"
                lightColor="#6B7280"
                darkColor="#9CA3AF"
              >
                Saved
              </ThemedText>
            </StatNumber>
          </View>
        </View>

        {/* Search and Filters */}
        <View className="flex-row mx-4 mb-1 gap-3">
          <View className="flex-1 flex-row items-center px-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              size={getDeviceType() === "phone" && Dimensions.get('window').width < 400 ? getIconSize(14) : getIconSize(16)}
              color={colorScheme.get() === "dark" ? "#9ca3af" : "#6b7280"}
              style={{ marginRight: 8 }}
            />
            <TextInput
              className="flex-1 py-2 text-gray-900 dark:text-white"
              placeholder="Search vocabulary..."
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (text === '' && searchQuery !== '') {
                  const searchFiltered = allFlashcards;
                  applyFilters(searchFiltered, activeFilters);
                }
              }}
              placeholderTextColor="#9ca3af"
              style={[
                getDeviceType() === "tablet" && { fontSize: getFontSize(12) },
                getDeviceType() === "phone" && Dimensions.get('window').width < 400 && { fontSize: getFontSize(11) },
                getDeviceType() === "phone" && Dimensions.get('window').width > 400 && { fontSize: getFontSize(14) },
              ]}
            />
            {searchQuery !== '' && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  const searchFiltered = allFlashcards;
                  applyFilters(searchFiltered, activeFilters);
                }}
                className="p-2"
              >
                <FontAwesome6
                  name="xmark"
                  size={14}
                  color={colorScheme.get() === "dark" ? "#9ca3af" : "#6b7280"}
                />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            className="flex-row items-center p-3 px-4 bg-white dark:bg-gray-700 rounded-xl shadow-sm"
            onPress={() => setShowFilterModal(true)}
          >
            <FontAwesome6
              name="sliders"
              size={getDeviceType() === "phone" && Dimensions.get('window').width < 400 ? 14 : 18}
              color="#00448F"
            />
            <ThemedText
              style={[
                GlobalFontStyleSheet.textSm,
                {
                  marginLeft: 6,
                  fontWeight: "bold",
                  color: colorScheme.get() === "dark" ? "#9ca3af" : "#6b7280",
                },
              ]}
            >
              Filter
            </ThemedText>
            {Object.keys(activeFilters).length > 0 && (
              <View className="ml-1.5 w-2 h-2 rounded-full bg-[#FC5D5D]" />
            )}
          </TouchableOpacity>

        {!isEditMode ? (
          renderActionsButton()
        ) : (
          <TouchableOpacity
            className="flex-row items-center p-3 px-4 bg-[#FC5D5D] dark:bg-[#FC5D5D]/20 rounded-xl shadow-sm"
            onPress={() => {
              setIsEditMode(false);
              setSelectedItems(new Set());
            }}
          >
            <FontAwesomeIcon
              icon={faPencil}
              size={getIconSize(16)}
              color="#ffffff"
              style={{ marginRight: 8 }}
            />
            <Text
              style={GlobalFontStyleSheet.textMd}
              className="text-white font-medium"
            >
              Cancel
            </Text>
          </TouchableOpacity>
        )}
      </View>

        {Object.keys(activeFilters).length > 0 && (
          <View className="mx-4 mb-4 px-4 py-2.5 bg-[#FC5D5D]/10 dark:bg-[#FC5D5D]/20 rounded-xl">
            <View className="flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-[#FC5D5D] mr-2" />
              <ThemedText
                style={GlobalFontStyleSheet.textSm}
                className="flex-1 text-[#FC5D5D] font-medium"
              >
                Filter applied: {formatFilterStatus(activeFilters)}
              </ThemedText>
              <TouchableOpacity 
                onPress={() => {
                  setActiveFilters({});
                  applyFilters(allFlashcards, {});
                }}
                className="ml-2"
              >
                <ThemedText
                  style={GlobalFontStyleSheet.textSm}
                  className="text-[#FC5D5D] font-semibold"
                >
                  Clear
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}

      {/* Vocabulary List */}
      <View className="flex-1 px-4">
        <FlashList
          data={filteredFlashcards}
          renderItem={({ item }) => <VocabItem flashcard={item} />}
          keyExtractor={(item) => item.id}
          estimatedItemSize={56}
          extraData={[selectedItems, isEditMode]}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center p-4">
              <ThemedText
                style={GlobalFontStyleSheet.textBase}
                className="text-center text-gray-500 dark:text-gray-400"
              >
                {Object.keys(activeFilters).length > 0
                  ? "No vocabulary matches this filter. You'll need to update or remove it."
                  : "You can add vocab by clicking the + button after clicking on words, or selecting Actions above & creating lists with AI."}
              </ThemedText>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Action Buttons */}
      <View className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
        {/* Edit Mode Bar - appears above action buttons when editing */}
        {isEditMode && (
          <View className="flex-row justify-between items-center py-3 tablet:py-5 px-6 md:px-8 border-b border-gray-100 dark:border-gray-700">
            <View className="flex-row items-center justify-between w-full">
              <TouchableOpacity
                className="flex-row items-center bg-[#FC5D5D]/10 dark:bg-[#FC5D5D]/20 py-2 px-3 rounded-lg"
                onPress={() => setSelectedItems(new Set(filteredFlashcards.map(f => f.id)))}
              >
                <FontAwesomeIcon
                  icon={faCheck}
                  size={getIconSize(14)}
                  color="#FC5D5D"
                  style={{ marginRight: 4 }}
                />
                <ThemedText
                  style={GlobalFontStyleSheet.textSm}
                  className="text-[#FC5D5D] font-semibold"
                >
                  Select All
                </ThemedText>
              </TouchableOpacity>

              {selectedItems.size > 0 ? (
                <>
                  <TouchableOpacity
                    className="flex-row items-center border-[#00448F]/80 py-2 px-3 rounded-lg"
                    onPress={() => {
                      setNewTags("");
                      setShowTagsModal(true);
                    }}
                  >
                    <FontAwesomeIcon
                      icon={faTags}
                      size={getIconSize(14)}
                      color="#00448F"
                      style={{ marginRight: 4 }}
                    />
                    <ThemedText
                      style={GlobalFontStyleSheet.textSm}
                      className="text-[#00448F] font-semibold"
                    >
                      Add & Replace Tags
                    </ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="flex-row items-center border-[#FC5D5D]/80 py-2 px-3 rounded-lg"
                    onPress={() => {
                      if (!showDeleteConfirmation) {
                        setShowDeleteConfirmation(true);
                      }
                    }}
                  >
                    <FontAwesomeIcon
                      icon={faTrash}
                      size={getIconSize(14)}
                      color="#FC5D5D"
                      style={{ marginRight: 4 }}
                    />
                    <ThemedText
                      style={GlobalFontStyleSheet.textSm}
                      className="text-[#FC5D5D] font-semibold"
                    >
                      Delete
                    </ThemedText>
                    <View className="ml-1.5 bg-[#FC5D5D] rounded-full px-1.5 py-0.5">
                      <Text
                        style={{
                          fontSize: 10,
                          color: '#FFFFFF',
                          fontWeight: '600',
                        }}
                      >
                        {selectedItems.size}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={{ flex: 1 }} />
              )}


            </View>
          </View>
        )}

        {/* Regular Action Buttons - always visible */}
        <View className="flex-row justify-between items-center px-4 md:px-8 pt-4 pb-1">
          <View className="flex-row justify-center items-center md:justify-center w-full md:gap-6 gap-1">
            <View className="flex-1 tablet:w-[160px]">
              <ActionButton
                title="Recall"
                onPress={() => router.push("/cards/recall")}
              />
            </View>
            <View className="flex-1 tablet:w-[160px]">
              <ActionButton
                title="Listen"
                onPress={() => router.push("/cards/listen")}
              />
            </View>
            <View className="flex-1 tablet:w-[160px]">
              <ActionButton 
                title="Produce" 
                onPress={() => router.push("/cards/produce")} 
              />
            </View>
            <View className="flex-1 tablet:w-[160px]">
              <ActionButton 
                title="Chat" 
                isActive={false} 
                onPress={() => {
                  router.push("/(tabs)/speak");
                  // Add a small delay to ensure the speak screen is mounted
                  setTimeout(() => {
                    router.setParams({ selectedOption: "Vocab & Games" });
                  }, 100);
                }} 
              />
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setShowHowItWorks(true)}
          className="pb-4 pt-2"
        >
          <ThemedText
            style={GlobalFontStyleSheet.textSm}
            className="text-center underline"
            lightColor="#6B7280"
            darkColor="#9CA3AF"
          >
            How does it work?
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* How does it work modal */}
      <SlidingModal
        visible={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
      >
        <ThemedText
          style={[GlobalFontStyleSheet.textLg, { lineHeight: 24 }]}
          className="font-bold mb-4 text-gray-900 dark:text-white mt-5"
        >
          The exercises explained
        </ThemedText>
        <View className="ml-4 mb-4">
          <ThemedText
            style={[GlobalFontStyleSheet.textMd, { lineHeight: 24 }]}
            className="text-gray-700 dark:text-gray-300 mb-2"
          >
            • Recall: tests whether you know what words/sentences mean
          </ThemedText>
          <ThemedText
            style={[GlobalFontStyleSheet.textMd, { lineHeight: 24 }]}
            className="text-gray-700 dark:text-gray-300 mb-2"
          >
            • Listen: listen rather than reading
          </ThemedText>
          <ThemedText
            style={[GlobalFontStyleSheet.textMd, { lineHeight: 24 }]}
            className="text-gray-700 dark:text-gray-300 mb-2"
          >
            • Produce: translate from your own language
          </ThemedText>
        </View>
        <ThemedText
          style={[GlobalFontStyleSheet.textMd, { lineHeight: 24 }]}
          className="text-gray-700 dark:text-gray-300 mb-4"
        >
          Try to recall the translation. You can say it, write it, or simply say it in your head and tap the card to reveal the answer.

        </ThemedText>
        <ThemedText
          style={[GlobalFontStyleSheet.textMd, { lineHeight: 24 }]}
          className="text-gray-700 dark:text-gray-300"
        >
          AI will indicate whether you were correct if you speak or write. If you knew the answer, swipe right.
          If you were incorrect, swipe left. Correct but guessed? Swipe down. Feel free to ignore the AI feedback if it mishears you.
        </ThemedText>
        <ThemedText
          style={[GlobalFontStyleSheet.textMd, { lineHeight: 24 }]}
          className="text-gray-700 dark:text-gray-300 pt-5"
        >
          <Text className="font-bold">Note: </Text>
          You can apply filters to adjust your focus.
        </ThemedText>
        <ThemedText
          style={[GlobalFontStyleSheet.textMd, { lineHeight: 24 }]}
          className="text-gray-700 dark:text-gray-300 pt-5"
        >
          Alternatively, select Chat to talk with AI using your saved vocab (this won't update your vocab stats)
        </ThemedText>
        
      </SlidingModal>

      {/* Generate Vocabulary Modal */}
      <GenerateFlashcardsModal
        visible={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        flashcardService={flashcardService}
        onFlashcardsGenerated={loadData}
      />

      {/* Tags Modal */}
      <SlidingModal
        visible={showTagsModal}
        onClose={() => {
          setShowTagsModal(false);
          setNewTags("");
        }}
      >
        <View className="w-full">
          <ThemedText
            style={GlobalFontStyleSheet.textLg}
            className="font-bold mb-4 text-gray-900 dark:text-white"
          >
            Add Tags
          </ThemedText>
          <ThemedText
            style={GlobalFontStyleSheet.textMd}
            className="mb-2 text-gray-700 dark:text-gray-300"
          >
            Enter tags separated by commas
          </ThemedText>
          <TextInput
            className="border border-gray-200 dark:bg-gray-700 px-4 py-3 rounded-lg mb-4 text-gray-900 dark:text-white"
            value={newTags}
            onChangeText={setNewTags}
            placeholder="e.g. important, review, difficult"
            placeholderTextColor="#9ca3af"
            style={GlobalFontStyleSheet.textMd}
          />

          {getAvailableTagsForBulk().length > 0 && (
            <View className="mb-4">
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
                {getAvailableTagsForBulk().map((tag, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleAddExistingTagToBulk(tag)}
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

          <TouchableOpacity
            className="bg-[#FC5D5D] dark:bg-[#3D4752] py-3 rounded-lg"
            onPress={async () => {
              // Get the selected flashcard IDs
              const selectedIds = Array.from(selectedItems);
              await handleUpdateTags(selectedIds, newTags);
              setShowTagsModal(false);
              setSelectedItems(new Set()); // Clear selections
              setIsEditMode(false); // Exit edit mode
            }}
          >
            <ThemedText
              style={GlobalFontStyleSheet.textMd}
              className="text-center font-medium"
              lightColor="#FFFFFF"
              darkColor="#FC5D5D"
            >
              Update Tags
            </ThemedText>
          </TouchableOpacity>
        </View>
      </SlidingModal>

      {/* Vocab Modal */}
      {selectedFlashcard && (
        <VocabModal
          visible={isModalVisible}
          onClose={() => setIsModalVisible(false)}
          flashcard={selectedFlashcard}
          flashcardService={flashcardService}
          onDelete={handleDelete}
          audioPlayer={audioPlayer}
          onUpdateTags={handleSingleFlashcardTagUpdate}
          onUpdateTranslation={handleUpdateTranslation}
          onUpdateFront={handleUpdateFront}
          availableTags={getUniqueTags()}
        />
      )}

      {/* Filter Modal */}
      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApplyFilters={(filters) => {
          setActiveFilters(filters);
          applyFilters(allFlashcards, filters);
        }}
        availableTags={getUniqueTags()}
        availableMonths={getAvailableMonths()}
        activeFilters={activeFilters}
      />

      <DeleteAlert
        visible={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={handleBulkDelete}
        word={`${selectedItems.size} flashcard${selectedItems.size > 1 ? 's' : ''}`}
      />

      {/* Import Modal */}
      <ImportVocabModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        flashcardService={flashcardService}
        onVocabImported={loadData}
      />

      {renderAndroidMenu()}
    </ThemedView>
  );
}
