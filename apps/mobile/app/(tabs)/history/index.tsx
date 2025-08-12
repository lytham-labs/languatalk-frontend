import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, View, TextInput } from 'react-native';
import cx from 'classnames';
import { useConfirm } from 'react-native-confirm-dialog';
import { ThemedText } from '@/components/shared/ThemedText';
import { ThemedView } from '@/components/shared/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/constants/api';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faBrainCircuit } from '@fortawesome/pro-solid-svg-icons/faBrainCircuit';
import { faHeadSideHeadphones } from '@fortawesome/pro-solid-svg-icons';
import { faPhone } from '@fortawesome/pro-solid-svg-icons/faPhone';
import { getFontSize, getIconSize, GlobalFontStyleSheet } from '@/constants/Font';
import useDevice from '@/hooks/useDevice';
import { usePathname } from 'expo-router';
import ChatActionsDropdown from '@/components/speak/ChatActionsDropdown';
import { useFeatureFlag } from 'posthog-react-native';
import useUserSubscription from '@/services/api/useUserSubscription';
import { hasExceededCallLimit } from '@/services/CallTimeService';
import CallModeLimitReachedModal from '@/components/pricing/CallModeLimitReachedModal';

interface Chat {
  id: number;
  team_id: number;
  display_topic: string;
  title?: string;
  created_at: string;
  user_message_count: number;
  default_topic: string;
  has_summary?: boolean;
  has_feedback?: boolean;
}

interface PaginationInfo {
  current_page: number;
  total_pages: number;
  total_items: number;
}

interface EditingState {
  chatId: number | null;
  title: string;
  defaultTopic: string;
}

const trashCanIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
  <path fill="#00448f" d="M164.2 39.5L148.9 64l150.3 0L283.8 39.5c-2.9-4.7-8.1-7.5-13.6-7.5l-92.5 0c-5.5 0-10.6 2.8-13.6 7.5zM311 22.6L336.9 64 384 64l32 0 16 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-16 0 0 336c0 44.2-35.8 80-80 80l-224 0c-44.2 0-80-35.8-80-80L32 96 16 96C7.2 96 0 88.8 0 80s7.2-16 16-16l16 0 32 0 47.1 0L137 22.6C145.8 8.5 161.2 0 177.7 0l92.5 0c16.6 0 31.9 8.5 40.7 22.6zM64 96l0 336c0 26.5 21.5 48 48 48l224 0c26.5 0 48-21.5 48-48l0-336L64 96zm80 80l0 224c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-224c0-8.8 7.2-16 16-16s16 7.2 16 16zm96 0l0 224c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-224c0-8.8 7.2-16 16-16s16 7.2 16 16zm96 0l0 224c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-224c0-8.8 7.2-16 16-16s16 7.2 16 16z"/>
</svg>`;

export default function HistoryScreen() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const { token, user } = useAuth();
  const colorScheme = useColorScheme() || 'light';
  const router = useRouter();
  const isDark = colorScheme === 'dark';
  const confirm = useConfirm();
  const { isTablet, isPhone } = useDevice();
  const pathname = usePathname();
  const [editingState, setEditingState] = useState<EditingState>({ 
    chatId: null, 
    title: '', 
    defaultTopic: '' 
  });
  const { subscriptionInfo } = useUserSubscription();
  const [showCallTimeLimitModal, setShowCallTimeLimitModal] = useState(false);

  const fetchChats = async (page = 1) => {
    try {
      const response = await fetch(`${API_URL}/api/v1/chats?page=${page}`, {
        headers: {
          'Authorization': `${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chats');
      }

      const data = await response.json();
      
      // No need to fetch status separately anymore
      setChats(prevChats => page === 1 ? data.chats : [...prevChats, ...data.chats]);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pathname === '/history') {
      setLoading(true);
      fetchChats();
    }
  }, [pathname]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleReturnToChat = async (chatId: number, teamId: number) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/v1/chats/${chatId}`, {
        headers: {
          'Authorization': `${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        if (
          response.status === 403 &&
          typeof data.error === 'string' &&
          data.error.toLowerCase().includes('call limit')
        ) {
          setShowCallTimeLimitModal(true);
          setLoading(false);
          return;
        }
        throw new Error('Failed to fetch chat data');
      }

      const chatData = await response.json();
      router.push({
        pathname: '/(tabs)/speak/chat',
        params: { chatId: chatData.chat.id, initialData: JSON.stringify(chatData) }
      });
    } catch (error) {
      console.error('Error fetching chat data:', error);
      // Handle error (e.g., show an error message to the user)
    } finally {
      setLoading(false);
    }
  };

  const handleEditTitle = async (chatId: number, newTitle: string) => {
    try {
      const response = await fetch(`${API_URL}/api/v1/chats/${chatId}/update_title`, {
        method: 'PATCH',
        headers: {
          'Authorization': `${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: newTitle.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to update chat title');
      }

      const data = await response.json();
      if (data.success) {
        // Update the chat title in the local state
        setChats(prevChats => prevChats.map(chat => 
          chat.id === chatId ? { ...chat, display_topic: data.display_topic } : chat
        ));
      }
    } catch (error) {
      console.error('Error updating chat title:', error);
    }
  };

  const handleDeleteChat = async (chatId: number) => {
    confirm({
      title: 'Are you sure?',
      body: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      onConfirm: async () => {
        // Handle the confirmed action here
        try {
          setLoading(true);
          const response = await fetch(`${API_URL}/api/v1/chats/${chatId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error('Failed to delete chat');
          }

          // Remove the deleted chat from the state
          setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
        } catch (error) {
          console.error('Error deleting chat:', error);
          // Handle error (e.g., show an error message to the user)
        } finally {
          setLoading(false);
        }
        console.log('Action confirmed!');
      },
    });
  };

  const handleStartEditing = (chatId: number, currentTitle: string, defaultTopic: string) => {
    setEditingState({ 
      chatId, 
      title: currentTitle, 
      defaultTopic 
    });
  };

  const handleFinishEditing = async () => {
    if (editingState.chatId) {
      const titleToSend = editingState.title.trim() === editingState.defaultTopic ? 
        '' : editingState.title.trim();
      await handleEditTitle(editingState.chatId, titleToSend);
    }
    setEditingState({ chatId: null, title: '', defaultTopic: '' });
  };

  const handleCallMode = async (chatId: number) => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      // First, fetch the chat data to trigger server-side call limit check
      const response = await fetch(`${API_URL}/api/v1/chats/${chatId}?call_mode=true`, {
        headers: {
          'Authorization': `${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        if (
          response.status === 403 &&
          typeof data.error === 'string' &&
          data.error.toLowerCase().includes('call limit')
        ) {
          setShowCallTimeLimitModal(true);
          setLoading(false);
          return;
        }
        throw new Error('Failed to fetch chat data');
      }

      // If server allows it, also do client-side check as backup
      const limitExceeded = await hasExceededCallLimit(
        user.id.toString(), 
        subscriptionInfo?.plan?.id, 
        subscriptionInfo?.plan?.name, 
        subscriptionInfo?.plan?.product_id
      );
      
      if (limitExceeded) {
        setShowCallTimeLimitModal(true);
        setLoading(false);
        return;
      }
      
      // Navigate to call mode if both checks pass
      router.replace({
        pathname: '/(tabs)/speak/call',
        params: { chatId: chatId }
      });
    } catch (error) {
      console.error('Error in handleCallMode:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderChatItem = ({ item }: { item: Chat }) => {
    const isEditing = editingState.chatId === item.id;
    const showSummaryFeedback = item.user_message_count > 5;

    return (
      <View className={cx('flex-row justify-between items-center p-4 border-b border-gray-300 bg-background-light dark:bg-gray-800', {
        'p-4': isPhone,
        'p-9': isTablet,
      })}>
        <View className='flex-1'>
          <View style={styles.titleContainer}>
            {isEditing ? (
              <TextInput
                value={editingState.title}
                placeholder={editingState.defaultTopic}
                placeholderTextColor={isDark ? '#666' : '#999'}
                onChangeText={(text) => setEditingState(prev => ({ 
                  ...prev, 
                  title: text.slice(0, 100) 
                }))}
                onBlur={handleFinishEditing}
                onSubmitEditing={handleFinishEditing}
                style={[
                  isTablet ? GlobalFontStyleSheet.textSm : GlobalFontStyleSheet.textBase,
                  styles.titleInput,
                  { color: isDark ? '#fff' : '#000' }
                ]}
                maxLength={100}
                autoFocus
              />
            ) : (
              <>
                <TouchableOpacity onPress={() => handleReturnToChat(item.id, item.team_id)}>
                  <Text style={isTablet ? GlobalFontStyleSheet.textMd : GlobalFontStyleSheet.textBase} className='font-bold text-gray-500 dark:text-white underline'>
                    {item.display_topic}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          <Text style={GlobalFontStyleSheet.textSm} className='text-md text-gray-450 dark:text-white mt-2'>
            {formatDate(item.created_at)}
          </Text>
        </View>
        <View style={styles.chatActions}>
          {showSummaryFeedback && item.has_summary && (
            <TouchableOpacity
              style={styles.summaryButton}
              onPress={() => router.replace({
                pathname: '/(tabs)/speak/summary',
                params: { id: item.id }
              })}
            >
              <FontAwesomeIcon 
                icon={faHeadSideHeadphones} 
                size={getIconSize(20)} 
                style={{ color: 'rgba(248, 113, 113, 1)' }}
              />
            </TouchableOpacity>
          )}
          {showSummaryFeedback && item.has_feedback && (
            <TouchableOpacity
              style={styles.feedbackButton}
              onPress={() => router.push({
                pathname: '/(tabs)/speak/feedback',
                params: { id: item.id }
              })}
            >
              <FontAwesomeIcon 
                icon={faBrainCircuit} 
                size={getIconSize(20)} 
                style={{ color: colorScheme === 'dark' ? Colors['blue'][200] : Colors['blue'][500] }}
              />
            </TouchableOpacity>
          )}
          <ChatActionsDropdown 
            chatId={item.id}
            teamId={item.team_id}
            userMessageCount={item.user_message_count}
            onEditTitle={() => handleStartEditing(item.id, item.display_topic, item.default_topic)}
            onDeleteChat={() => handleDeleteChat(item.id)}
            onSummary={() => router.replace({
              pathname: '/(tabs)/speak/summary',
              params: { id: item.id }
            })}
            onFeedback={() => router.push({
              pathname: '/(tabs)/speak/feedback',
              params: { id: item.id }
            })}
            onCallMode={() => handleCallMode(item.id)}
            showSummaryInDropdown={showSummaryFeedback && !item.has_summary}
            showFeedbackInDropdown={showSummaryFeedback && !item.has_feedback}
            showCallMode={true}
          />
        </View>
      </View>
    );
  };

  const loadMoreChats = () => {
    if (pagination && pagination.current_page < pagination.total_pages) {
      fetchChats(pagination.current_page + 1);
    }
  };

  if (!loading && chats.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.emptyStateContainer}>
          <ThemedText style={styles.emptyStateText}>No chat history available.</ThemedText>
          <ThemedText style={styles.emptyStateSubtext}>Start a new chat to see it here!</ThemedText>
          <TouchableOpacity 
            className={cx('bg-white dark:bg-gray-500 text-gray-500 dark:text-white p-4 my-2 mx-4 rounded-lg items-center shadow-sm')}
            onPress={() => router.push('/(tabs)/speak')}
          >
            <Text
              className={cx('font-medium text-gray-500 dark:text-white')}
              style={GlobalFontStyleSheet.textBase}
            >
              Start a New Chat
            </Text>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
        <ActivityIndicator className="py-8 flex-1 items-center justify-center" size="large" color={Colors[colorScheme].tint} />
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={chats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id.toString()}
        onEndReached={loadMoreChats}
        onEndReachedThreshold={0.1}
        ListFooterComponent={() => 
          pagination && pagination.current_page < pagination.total_pages ? 
          <ActivityIndicator size="small" className='py-8' color={Colors[colorScheme].tint} /> : null
        }
      />
      
      <CallModeLimitReachedModal
        isVisible={showCallTimeLimitModal}
        onClose={() => setShowCallTimeLimitModal(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  chatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  chatInfo: {
    flex: 1,
  },
  chatTopic: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00448f',
    textDecorationLine: 'underline',
  },
  editIcon: {
    marginLeft: 8,
  },
  chatDate: {
    fontSize: 14,
    color: '#484848',
    marginTop: 4,
  },
  chatActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  feedbackButton: {
    padding: 4,
    borderRadius: 5,
    marginRight: 10,
  },
  feedbackButtonText: {
    color: 'white',
    fontSize: 14,
  },
  deleteIcon: {
    padding: 5,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyStateSubtext: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  startChatButton: {
    backgroundColor: '#00448f',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  startChatButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingVertical: 4,
    marginRight: 8,
    flex: 1,
  },
  editButton: {
    padding: 8,
    marginLeft: 8,
  },
  summaryButton: {
    padding: 4,
    marginRight: 10,
  },
});



