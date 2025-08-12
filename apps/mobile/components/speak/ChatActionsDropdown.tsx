import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Text, Pressable } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faPencil, faTrashCan, faBrainCircuit } from '@fortawesome/pro-duotone-svg-icons';
import { faHeadSideHeadphones, faBook } from '@fortawesome/pro-solid-svg-icons';
import { faPhone } from '@fortawesome/pro-solid-svg-icons/faPhone';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'expo-router';
import { useConfirm } from 'react-native-confirm-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getIconSize, GlobalFontStyleSheet } from '@/constants/Font';
import { API_URL } from '@/constants/api';

interface ChatActionsDropdownProps {
  chatId: number;
  teamId: number;
  userMessageCount: number;
  onEditTitle: () => void;
  onDeleteChat: () => void;
  onSummary: () => void;
  onFeedback: () => void;
  onCallMode?: () => void;
  showSummaryInDropdown: boolean;
  showFeedbackInDropdown: boolean;
  showCallMode?: boolean;
}

const ChatActionsDropdown: React.FC<ChatActionsDropdownProps> = ({
  chatId,
  teamId,
  userMessageCount,
  onEditTitle,
  onDeleteChat,
  onSummary,
  onFeedback,
  onCallMode,
  showSummaryInDropdown,
  showFeedbackInDropdown,
  showCallMode = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const [showVocabPractice, setShowVocabPractice] = useState(false);
  const [chatData, setChatData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const buttonRef = useRef<View>(null);
  const router = useRouter();
  const { token } = useAuth();
  const confirm = useConfirm();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Fetch chat data to check vocabulary count when dropdown opens
  useEffect(() => {
    if (isOpen && !chatData) {
      fetchChatData();
    }
  }, [isOpen, chatData]);

  const fetchChatData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/v1/chats/${chatId}`, {
        headers: {
          'Authorization': `${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chat data');
      }

      const data = await response.json();
      setChatData(data);
      
      // Check if we have at least 5 vocabulary words combined
      const savedWordsCount = data.chat.saved_vocabulary?.length || 0;
      const translatedWordsCount = data.chat.translated_vocabulary?.length || 0;
      setShowVocabPractice(savedWordsCount + translatedWordsCount >= 5);
    } catch (error) {
      console.error('Error fetching chat data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    if (buttonRef.current) {
      buttonRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        const top = y + height + 4;
        const right = 20;

        if (!isNaN(top) && !isNaN(right)) {
          setDropdownPosition({
            top,
            right,
          });
          setIsOpen(true);
        }
      });
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleDelete = () => {
    setIsOpen(false);
    onDeleteChat();
  };

  const handleEditTitle = () => {
    setIsOpen(false);
    setTimeout(() => {
      onEditTitle();
    }, 300);
  };

  const handleAction = (action: () => void) => {
    setIsOpen(false);
    setTimeout(() => {
      action();
    }, 300);
  };

  const handlePracticeVocabulary = () => {
    if (!chatData) return;
    
    setIsOpen(false);
    setTimeout(() => {
      router.push({
        pathname: '/(tabs)/speak/practice',
        params: { 
          practice: 'true',
          saved_words: chatData.chat.saved_vocabulary?.join(',') || '',
          translated_words: chatData.chat.translated_vocabulary?.join(',') || '',
          language: chatData.chat.language,
          voice: chatData.chat.voice
        }
      });
    }, 300);
  };

  const handleCallMode = () => {
    if (!onCallMode) return;
    
    setIsOpen(false);
    setTimeout(() => {
      onCallMode();
    }, 300);
  };

  return (
    <>
      <View ref={buttonRef} collapsable={false}>
        <TouchableOpacity
          onPress={handleToggle}
          style={styles.triggerButton}
        >
          <FontAwesomeIcon
            icon={faEllipsisVertical}
            size={getIconSize(20)}
            style={{ color: Colors[colorScheme ?? 'light'].text }}
          />
        </TouchableOpacity>
      </View>

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.modalOverlay} onPress={handleClose}>
          <View
            style={[
              styles.dropdown,
              {
                position: 'absolute',
                top: dropdownPosition.top,
                right: dropdownPosition.right,
                backgroundColor: isDark ? '#1F2937' : 'white',
              },
            ]}
          >
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={handleEditTitle}
            >
              <FontAwesomeIcon
                icon={faPencil}
                size={getIconSize(16)}
                style={{ color: Colors[colorScheme ?? 'light'].text }}
              />
              <Text style={[styles.dropdownText, { color: isDark ? '#E5E7EB' : '#374151' }]}>
                Edit Title
              </Text>
            </TouchableOpacity>

            {showCallMode && (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={handleCallMode}
              >
                <FontAwesomeIcon
                  icon={faPhone}
                  size={getIconSize(16)}
                  style={{ color: 'rgba(248, 113, 113, 1)' }}
                />
                <Text style={[styles.dropdownText, { color: isDark ? '#E5E7EB' : '#374151' }]}>
                  Continue in call mode
                </Text>
              </TouchableOpacity>
            )}

            {showSummaryInDropdown && (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => handleAction(onSummary)}
              >
                <FontAwesomeIcon
                  icon={faHeadSideHeadphones}
                  size={getIconSize(16)}
                  style={{ color: '#F87171' }}
                />
                <Text style={[styles.dropdownText, { color: isDark ? '#E5E7EB' : '#374151' }]}>
                  Create Audio Summary
                </Text>
              </TouchableOpacity>
            )}

            {showFeedbackInDropdown && (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => handleAction(onFeedback)}
              >
                <FontAwesomeIcon
                  icon={faBrainCircuit}
                  size={getIconSize(16)}
                  style={{ color: isDark ? Colors['blue'][200] : Colors['blue'][500] }}
                />
                <Text style={[styles.dropdownText, { color: isDark ? '#E5E7EB' : '#374151' }]}>
                  Create Feedback Report
                </Text>
              </TouchableOpacity>
            )}

            {showVocabPractice && (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={handlePracticeVocabulary}
              >
                <FontAwesomeIcon
                  icon={faBook}
                  size={getIconSize(16)}
                  style={{ color: isDark ? '#FDBA74' : '#F97316' }}
                />
                <Text style={[styles.dropdownText, { color: isDark ? '#E5E7EB' : '#374151' }]}>
                  Practice Vocabulary
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.dropdownItem, styles.lastDropdownItem]}
              onPress={handleDelete}
            >
              <FontAwesomeIcon
                icon={faTrashCan}
                size={getIconSize(16)}
                style={{ color: Colors[colorScheme ?? 'light'].text }}
              />
              <Text style={[styles.dropdownText, { color: isDark ? '#E5E7EB' : '#374151' }]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  triggerButton: {
    padding: 4,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  dropdown: {
    position: 'absolute',
    minWidth: 180,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  lastDropdownItem: {
    borderBottomWidth: 0,
  },
  dropdownText: {
    ...GlobalFontStyleSheet.textBase,
    marginLeft: 12,
  },
});

export default ChatActionsDropdown;
