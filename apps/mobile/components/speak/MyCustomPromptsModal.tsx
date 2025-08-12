import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Modal, TextInput, ActivityIndicator, Alert, ScrollView, useWindowDimensions, Platform, KeyboardAvoidingView } from 'react-native';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { useColorScheme } from '@/hooks/useColorScheme';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faMagnifyingGlass, faTrash, faPencil, faChevronDown } from '@fortawesome/pro-solid-svg-icons';
import SlidingModal from '@/components/shared/SlidingModal';
import { TouchableOpacity } from 'react-native';
import cx from 'classnames';
import { FlashList } from "@shopify/flash-list";
import { API_URL } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInDown, 
  SlideOutDown,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';

interface UserPrompt {
  id: number;
  title: string;
  prompt: string;
  created_at?: string;
  last_used_at?: string;
}

interface MyCustomPromptsModalProps {
  visible: boolean;
  onClose: () => void;
  userPrompts?: UserPrompt[];
  onPromptsUpdate?: () => void;
  onStartChat?: (prompt: UserPrompt) => void;
}

type SortOption = 'alphabetical' | 'created_at' | 'last_used_at';
type SortDirection = 'asc' | 'desc';

export default function MyCustomPromptsModal({ 
  visible, 
  onClose, 
  userPrompts = [],
  onPromptsUpdate,
  onStartChat
}: MyCustomPromptsModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPrompts, setFilteredPrompts] = useState<UserPrompt[]>([]);
  const [localPrompts, setLocalPrompts] = useState<UserPrompt[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('last_used_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editingPrompt, setEditingPrompt] = useState<UserPrompt | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSortOptions, setShowSortOptions] = useState(false);
  const { token } = useAuth();
  
  // Text input height management for edit modal
  const LINE_HEIGHT = 20; // Approximate height of a line of text
  const MIN_LINES = 4;
  const MAX_LINES = 7;
  const MIN_HEIGHT = LINE_HEIGHT * MIN_LINES;
  const MAX_HEIGHT = LINE_HEIGHT * MAX_LINES;
  const [textInputHeight, setTextInputHeight] = useState(MIN_HEIGHT);
  
  const modalHeight = useSharedValue(90);
  const { width } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);

  const getInputHeight = () => {
    if (width >= 440) { 
      return 500;
    } else if (width >= 400) { 
      return 450;
    } else if (width >= 350) {
      return 250;
    } else { 
      return 200;
    }
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      height: withSpring(`${modalHeight.value}%`, {
        damping: 15,
        stiffness: 100,
      }),
    };
  });

  // Function to handle content size changes for auto-growing text input
  const handleContentSizeChange = (event: any) => {
    const { height } = event.nativeEvent.contentSize;
    // Ensure the height stays between min and max values
    const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height));
    setTextInputHeight(newHeight);
  };

  const sortOptions = [
    { value: 'last_used_at', label: 'Last Used' },
    { value: 'created_at', label: 'Created Date' },
    { value: 'alphabetical', label: 'Alphabetical (A-Z)' }
  ];

  const getSortLabel = (option: SortOption) => {
    return sortOptions.find(opt => opt.value === option)?.label || '';
  };

  useEffect(() => {
    if (visible) {
      setLocalPrompts(userPrompts);
    }
  }, [userPrompts, visible]);

  useEffect(() => {
    let filtered = [...localPrompts];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(prompt => 
        prompt.title.toLowerCase().includes(query) || 
        prompt.prompt.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      if (sortOption === 'alphabetical') {
        const comparison = a.title.localeCompare(b.title);
        return sortDirection === 'desc' ? comparison : -comparison;
      } else {
        const dateA = new Date(a[sortOption] || 0);
        const dateB = new Date(b[sortOption] || 0);
        return sortDirection === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
      }
    });
    
    setFilteredPrompts(filtered);
  }, [searchQuery, sortOption, sortDirection, localPrompts]);

  const updatePrompts = useCallback((updatedPrompts: UserPrompt[]) => {
    setLocalPrompts(updatedPrompts);
    onPromptsUpdate?.();
  }, [onPromptsUpdate]);

  const handleDeletePrompt = (prompt: UserPrompt) => {
    Alert.alert(
      'Delete Prompt',
      'Are you sure you want to delete this prompt?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              const response = await fetch(`${API_URL}/api/v1/user_prompts/${prompt.id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `${token}`,
                  'Content-Type': 'application/json',
                },
              });

              if (!response.ok) {
                throw new Error('Failed to delete prompt');
              }

              const updatedPrompts = localPrompts.filter(p => p.id !== prompt.id);
              updatePrompts(updatedPrompts);
            } catch (error) {
              console.error('Error deleting prompt:', error);
              Alert.alert('Error', 'Failed to delete prompt. Please try again.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleEditPrompt = (prompt: UserPrompt) => {
    setEditingPrompt(prompt);
    setEditTitle(prompt.title);
    setEditPrompt(prompt.prompt);
  };

  const handleSaveEdit = async () => {
    if (editingPrompt && editTitle.trim() && editPrompt.trim()) {
      try {
        setIsLoading(true);
        const response = await fetch(`${API_URL}/api/v1/user_prompts/${editingPrompt.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: editTitle.trim(),
            prompt: editPrompt.trim()
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update prompt');
        }

        const updatedPrompts = localPrompts.map(p => 
          p.id === editingPrompt.id 
            ? { ...p, title: editTitle.trim(), prompt: editPrompt.trim() }
            : p
        );
        updatePrompts(updatedPrompts);
        
        setEditingPrompt(null);
        setEditTitle('');
        setEditPrompt('');
      } catch (error) {
        console.error('Error updating prompt:', error);
        Alert.alert('Error', 'Failed to update prompt. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleStartChat = (prompt: UserPrompt) => {
    onStartChat?.(prompt);
    onClose();
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setEditingPrompt(null);
      setEditTitle('');
      setEditPrompt('');
    }
  }, [visible]);

  const renderPromptItem = ({ item }: { item: UserPrompt }) => (
    <TouchableOpacity
      onPress={() => handleStartChat(item)}
      className={cx(
        "mb-3 rounded-xl overflow-hidden",
        isDark ? "bg-gray-600" : "bg-white",
      )}
      style={{
        shadowColor: isDark ? "#000" : "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      <View className="p-4">
        <View className="flex-row justify-between items-center mb-2">
          <Text 
            style={[GlobalFontStyleSheet.textLg, { fontFamily: 'Lato-Bold' }]}
            className={cx(
              "flex-1 mr-1",
              isDark ? "text-white" : "text-gray-900"
            )}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.title}
          </Text>
          <View className="flex-row gap-2 flex-shrink-0">
            <TouchableOpacity
              onPress={() => handleEditPrompt(item)}
              className={cx(
                "p-2 rounded-lg",
                isDark ? "bg-[#4ADE80]/15" : "bg-gray-100/50"
              )}
              disabled={isLoading}
            >
              <FontAwesomeIcon 
                icon={faPencil} 
                size={16} 
                color={isDark ? "#4ADE80" : "#00448f"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeletePrompt(item)}
              className={cx(
                "p-2 rounded-lg",
                isDark ? "bg-[#2563EB]/15" : "bg-gray-100/50"
              )}
              disabled={isLoading}
            >
              <FontAwesomeIcon 
                icon={faTrash} 
                size={16} 
                color={isDark ? "#2563EB" : "#4b5563"} 
              />
            </TouchableOpacity>
          </View>
        </View>
        <Text 
          style={GlobalFontStyleSheet.textBase}
          className={cx(
            "text-gray-500 dark:text-gray-200",
            "line-clamp-2"
          )}
        >
          {item.prompt.substring(0, 35)}
          {item.prompt.length > 35 ? '...' : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SlidingModal 
      visible={visible} 
      onClose={onClose}
      bgColor={isDark ? "bg-[#181c20]" : "bg-gray-50"}
    >
      <View className={cx(
        "flex-1 rounded-xl",
        isDark ? "bg-[#181c20]" : "bg-gray-50/50"
      )}>
        {/* Header */}
        <View className={cx(
          "px-5 pt-6 pb-4",
          isDark ? "bg-[#181c20]" : "bg-gray-50/50"
        )}>
          <Text 
            style={[GlobalFontStyleSheet.textXl, { fontFamily: 'Lato-Bold' }]}
            className={isDark ? "text-white" : "text-gray-900"}
          >
            My Prompts
          </Text>
          <Text 
            style={GlobalFontStyleSheet.textBase}
            className="mt-1 text-gray-500 dark:text-gray-200"
          >
            Tap on any prompt to start chatting.
          </Text>
        </View>

        {/* Search and Sort */}
        <View className={cx(
          "px-5 mb-4",
          isDark ? "bg-[#181c20]" : "bg-gray-50/50"
        )}>
          <View className="flex-row gap-2">
            <View className={cx(
              "flex-1 flex-row items-center px-4 py-2.5 rounded-xl",
              isDark ? "bg-gray-600" : "bg-white"
            )}>
              <FontAwesomeIcon 
                icon={faMagnifyingGlass} 
                size={16} 
                color={isDark ? "#e5e7eb" : "#6b7280"}
              />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by label or prompt"
                placeholderTextColor={isDark ? "#9ca3af" : "#6b7280"}
                className={cx(
                  "flex-1 ml-2 text-base",
                  isDark ? "text-white" : "text-gray-900"
                )}
                style={[GlobalFontStyleSheet.textMd, { height: 20 }]}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity 
                  onPress={() => setSearchQuery('')}
                  className="p-1"
                >
                  <FontAwesomeIcon
                    icon={faTrash}
                    size={14}
                    color={isDark ? "#e5e7eb" : "#6b7280"}
                  />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => setShowSortOptions(true)}
              className={cx(
                "flex-row items-center px-3 py-2.5 rounded-xl",
                isDark ? "bg-gray-600" : "bg-white"
              )}
            >
              <Text 
                style={GlobalFontStyleSheet.textBase}
                className={cx(
                  "mr-2",
                  isDark ? "text-white" : "text-gray-700"
                )}
              >
                {getSortLabel(sortOption)}
              </Text>
              <FontAwesomeIcon 
                icon={faChevronDown} 
                size={14} 
                color={isDark ? "#e5e7eb" : "#6b7280"}
              />
            </TouchableOpacity>
          </View>

          {/* Sort Options Modal */}
          <Modal
            visible={showSortOptions}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowSortOptions(false)}
          >
            <TouchableOpacity 
              className="flex-1 bg-black/60"
              onPress={() => setShowSortOptions(false)}
              activeOpacity={1}
            >
              <View className="flex-1 justify-center items-center">
                <View className={cx(
                  "w-[90%] p-4 rounded-xl",
                  isDark ? "bg-gray-600" : "bg-white"
                )}>
                  {sortOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => {
                        setSortOption(option.value as SortOption);
                        setShowSortOptions(false);
                      }}
                      className={cx(
                        "py-3 px-4 rounded-lg",
                        sortOption === option.value 
                          ? (isDark ? "bg-gray-500" : "bg-gray-100")
                          : ""
                      )}
                    >
                      <Text 
                        style={GlobalFontStyleSheet.textBase}
                        className={cx(
                          sortOption === option.value
                            ? (isDark ? "text-white" : "text-gray-900")
                            : (isDark ? "text-gray-200" : "text-gray-600")
                        )}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          </Modal>
        </View>

        {/* Prompts List */}
        <View className={cx(
          "flex-1 px-2 min-h-[600px]",
          isDark ? "bg-[#181c20]" : "bg-gray-50/50"
        )}>
          {isLoading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color={isDark ? "#9ca3af" : "#6b7280"} />
            </View>
          ) : filteredPrompts.length === 0 ? (
            <View className="flex-1 justify-center items-center">
              <Text 
                style={GlobalFontStyleSheet.textBase}
                className={isDark ? "text-gray-400" : "text-gray-500"}
              >
                {searchQuery ? 'No matching prompts found' : 'No prompts saved yet'}
              </Text>
            </View>
          ) : (
            <FlashList
              data={filteredPrompts}
              renderItem={renderPromptItem}
              estimatedItemSize={120}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          )}
        </View>

        {/* Edit Modal */}
        {editingPrompt && (
          <Modal
            visible={true}
            animationType="none"
            transparent={true}
            onRequestClose={() => setEditingPrompt(null)}
          >
            <Animated.View 
              entering={FadeIn.duration(100)}
              exiting={FadeOut.duration(200)}
              className="flex-1 justify-center items-center bg-black/30"
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ width: '90%', maxHeight: '95%' }}
              >
                <Animated.View
                  entering={SlideInDown.duration(50).springify().damping(80)}
                  exiting={SlideOutDown.duration(200)}
                  style={[animatedStyle]}
                  className={cx(
                    "rounded-2xl p-6 shadow-lg",
                    isDark ? "bg-gray-800" : "bg-white"
                  )}
                >
                  <ScrollView 
                    className="flex-1"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    <View className="flex-row justify-between items-start mb-4">
                      <View>
                        <Text style={[GlobalFontStyleSheet.textXl]} className={cx(
                          "font-semibold",
                          isDark ? "text-white" : "text-gray-900"
                        )}>
                          Edit Prompt
                        </Text>
                      </View>
                    </View>
                    
                    <View className="mb-4">
                      <TextInput
                        ref={inputRef}
                        value={editPrompt}
                        onChangeText={setEditPrompt}
                        placeholder="Type here..."
                        placeholderTextColor={isDark ? "#9ca3af" : "#6b7280"}
                        multiline
                        numberOfLines={MIN_LINES}
                        maxLength={20000}
                        onContentSizeChange={handleContentSizeChange}
                        className={cx(
                          "p-3 rounded-xl text-base",
                          isDark ? "bg-gray-700 text-white" : "bg-gray-50 text-gray-900"
                        )}
                        style={[
                          GlobalFontStyleSheet.textBase,
                          { height: textInputHeight, maxHeight: MAX_HEIGHT }
                        ]}
                        textAlignVertical="top"
                      />
                      <Text style={GlobalFontStyleSheet.textSm} className={cx(
                        "text-right mt-1",
                        isDark ? "text-gray-400" : "text-gray-500"
                      )}>
                        {editPrompt.length}/20000 characters
                      </Text>
                    </View>

                    <View className="mb-4">
                      <TextInput
                        value={editTitle}
                        onChangeText={setEditTitle}
                        placeholder="Label your prompt"
                        placeholderTextColor={isDark ? "#9ca3af" : "#6b7280"}
                        maxLength={50}
                        className={cx(
                          "p-3 rounded-xl text-base",
                          isDark ? "bg-gray-700 text-white" : "bg-gray-50 text-gray-900"
                        )}
                        style={[GlobalFontStyleSheet.textBase]}
                      />
                      <Text style={GlobalFontStyleSheet.textSm} className={cx(
                        "text-right mt-1",
                        isDark ? "text-gray-400" : "text-gray-500"
                      )}>
                        {editTitle.length}/50 characters
                      </Text>
                    </View>

                    <View className="flex-row justify-between mt-4 gap-2">
                      <TouchableOpacity
                        onPress={() => setEditingPrompt(null)}
                        className={cx(
                          "flex-1 py-3.5 rounded-xl items-center",
                          isDark ? "bg-white/10" : "bg-gray-500/90"
                        )}
                        disabled={isLoading}
                      >
                        <Text style={GlobalFontStyleSheet.textBase} className="text-white font-semibold">
                          Go back
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSaveEdit}
                        disabled={isLoading || !editTitle.trim() || !editPrompt.trim()}
                        className={cx(
                          "flex-1 py-3.5 rounded-xl items-center",
                          (!editTitle.trim() || !editPrompt.trim())
                            ? (isDark ? "bg-white/5" : "bg-[#FC5D5D]/50")
                            : "bg-[#FC5D5D]/85"
                        )}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Text style={GlobalFontStyleSheet.textBase} className={cx(
                            "font-semibold",
                            (!editTitle.trim() || !editPrompt.trim())
                              ? (isDark ? "text-gray-500" : "text-white")
                              : "text-white"
                          )}>
                            Save
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </Animated.View>
              </KeyboardAvoidingView>
            </Animated.View>
          </Modal>
        )}
      </View>
    </SlidingModal>
  );
} 
