import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Dimensions, ActivityIndicator, Animated } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faFire, faCircle, faBook, faHeadphones, faClipboardList, faListCheck, faFileLines, faUsers, faMessage } from '@fortawesome/free-solid-svg-icons';
import { GlobalFontStyleSheet } from '@/constants/Font';
import SlidingModal from '../shared/SlidingModal';
import useUserStats, { UserStats, UserLeaderboard } from '@/services/api/useUserStats';
import cx from 'classnames';
import { useRouter } from 'expo-router';
import { useWebSocket } from '@/contexts/ActionCableWebSocketContext';
import { API_URL } from '@/constants/api';
import { ChatData } from '@/types/chat';

interface UserPointsModalProps {
  isVisible: boolean;
  onClose: (resumeAudio: boolean) => void;
  token: string;
  colorScheme: 'light' | 'dark';
  chatId: number | null;
}

export default function UserPointsModal({
  isVisible,
  onClose,
  token,
  colorScheme,
  chatId,
}: UserPointsModalProps) {
  const isDark = colorScheme === 'dark';
  const isSmallPhone = Dimensions.get('window').height < 700;
  const { userStats, loading: statsLoading, error } = useUserStats(token);
  const { connectWebSocket, waitForConnection } = useWebSocket();
  const router = useRouter();
  
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFlashcardExpanded, setIsFlashcardExpanded] = useState(false);
  const [hasEnoughVocabWords, setHasEnoughVocabWords] = useState(false);
  
  // Animation values
  const flashcardAnimation = useRef(new Animated.Value(0)).current;
  const firstCardAnimation = useRef(new Animated.Value(0)).current;
  const secondCardAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible && chatId) {
      fetchChatData();
    }
  }, [isVisible, chatId, token]);

  useEffect(() => {
    if (chatData) {
      // Check if we have at least 5 words combined
      const savedWordsCount = chatData.chat.saved_vocabulary?.length || 0;
      const translatedWordsCount = chatData.chat.translated_vocabulary?.length || 0;
      setHasEnoughVocabWords(savedWordsCount + translatedWordsCount >= 5);
    }
  }, [chatData]);

  const fetchChatData = async () => {
    if (!chatId) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/v1/chats/${chatId}`, {
        headers: {
          'Authorization': `${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chat data');
      }

      const data: ChatData = await response.json();
      setChatData(data);
    } catch (error) {
      console.error('Error fetching chat data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const getDayOfWeek = (date: string) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentDate = new Date(date);
    return currentDate.getDay(); // 0-6
  };

  const renderLeaderboardItem = (user: UserLeaderboard | null, position: number) => {
    if (!user) return null;
    return (
      <View key={position} className={cx(
        "flex-row items-center justify-between p-4 rounded-lg mb-2",
        isDark ? 'bg-gray-700' : 'bg-gray-50',
        user.user_id === userStats?.user_leaderboard?.user_id && 'border-2 border-blue-500'
      )}>
       
        <View className="flex-row items-center">
          <Text 
            style={GlobalFontStyleSheet.textLg}
            className={cx(
              "font-semibold mr-4",
              isDark ? 'text-gray-100' : 'text-gray-600'
            )}
          >
            #{position}
          </Text>
          <FontAwesomeIcon 
            icon={faUsers} 
            size={20} 
            color={isDark ? '#9CA3AF' : '#4B5563'} 
          />
        </View>
        <Text 
          style={GlobalFontStyleSheet.textLg}
          className={cx(
            "font-bold",
            isDark ? 'text-white' : 'text-gray-900'
          )}
        >
          {user.all_time_points} points
        </Text>
      </View>
    );
  };

  const renderLeaderboard = () => {
    if (statsLoading) {
      return (
        <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
          Loading leaderboard...
        </Text>
      );
    }

    if (error) {
      return (
        <Text className={isDark ? 'text-red-400' : 'text-red-600'}>
          Error loading leaderboard
        </Text>
      );
    }

    return (
      <View>
        {userStats.users_above?.map((user, index) => 
          renderLeaderboardItem(
            user,
            index + 1
          )
        )}

        {userStats.user_leaderboard && 
          renderLeaderboardItem(
            userStats.user_leaderboard,
            userStats.user_position
          )
        }

        {userStats.users_below?.map((user, index) => 
          renderLeaderboardItem(
            user,
            userStats.user_position + index + 1
          )
        )}
      </View>
    );
  };

  const renderWeekCircles = () => {
    const days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
    
    // Get current day (0-6, where 0 is Sunday) and convert to Monday-first (0-6, where 0 is Monday)
    let currentDay = new Date().getDay();
    currentDay = currentDay === 0 ? 6 : currentDay - 1;
    
    const streak = userStats?.daily_streak || 0;
    
    // Updated getIsFireDay logic
    const getIsFireDay = (index: number) => {
      // If this is the current day's index, always show fire
      if (index === currentDay) return true;
      
      if (streak === 0) return false;
      
      // Calculate how many days back this index is from current day
      let daysBack = currentDay - index;
      
      // Only show fire for past days that are part of the streak
      // Don't wrap around - only show streak for days up to current day
      return daysBack > 0 && daysBack < streak;
    };

    return (
      <View className="flex-row justify-center px-4 my-6 gap-2">
        {days.map((day, index) => (
          <View key={day} className="items-center">
            <View className="relative">
              <FontAwesomeIcon
                icon={getIsFireDay(index) ? faFire : faCircle}
                size={45}
                color={getIsFireDay(index)
                  ? (isDark ? '#F87171' : '#EF4444')
                  : (isDark ? '#374151' : '#E5E7EB')
                }
              />
              {/* Only show text if it's not a fire day */}
              {!getIsFireDay(index) && (
                <Text
                  className={cx(
                    "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-md font-bold",
                    isDark ? 'text-white' : 'text-gray-600'
                  )}
                >
                  {day}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const handleFeedbackNavigation = async () => {
    if (!chatData?.chat.id) return;

    try {
      // Connect to feedback websocket first
      connectWebSocket(chatData.chat.id, {
        name: 'ChatFeedbackChannel',
        params: { chat_id: chatData.chat.id }
      });

      // Wait for connection to be established
      const isConnected = await waitForConnection(chatData.chat.id);
      
      if (isConnected) {
        onClose(false); // Close modal first
        router.push({
          pathname: '/(tabs)/speak/feedback',
          params: { id: chatData.chat.id }
        });
      } else {
        console.error('Failed to establish WebSocket connection for feedback');
        // Optionally show an error message to the user
      }
    } catch (error) {
      console.error('Error navigating to feedback:', error);
      // Optionally show an error message to the user
    }
  };

  const toggleFlashcardExpansion = () => {
    // Only allow expansion if we have enough vocab words
    if (!hasEnoughVocabWords) {
      // If not enough words, just navigate to the regular cards screen
      onClose(false);
      router.dismissAll();
      router.replace('/cards');
      return;
    }

    if (isFlashcardExpanded) {
      // Collapse animation
      Animated.parallel([
        Animated.timing(firstCardAnimation, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(secondCardAnimation, {
          toValue: 0, 
          duration: 250,
          useNativeDriver: true,
        })
      ]).start(() => {
        setIsFlashcardExpanded(false);
      });
    } else {
      // Expand animation to visually split the cell
      setIsFlashcardExpanded(true);
      Animated.timing(firstCardAnimation, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
      
      Animated.timing(secondCardAnimation, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }
  };

  const renderActionButtons = () => {
    if (loading || !chatData) {
      return (
        <View className="p-4 items-center">
          <ActivityIndicator size="large" color={isDark ? '#60A5FA' : '#3B82F6'} />
          <Text className={`mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            Loading chat data...
          </Text>
        </View>
      );
    }
    
    // Calculate total vocab words count
    const savedWordsCount = chatData.chat.saved_vocabulary?.length || 0;
    const translatedWordsCount = chatData.chat.translated_vocabulary?.length || 0;
    const totalVocabWords = savedWordsCount + translatedWordsCount;
    
    // Button for review flashcards that will animate
    const reviewFlashcardsButton = (
      <View className="w-[48%] relative" style={{ height: isFlashcardExpanded ? 200 : 100 }}>
        {/* Original button always visible but transforms during splitting */}
        <Animated.View
          style={{
            position: 'absolute',
            width: '100%',
            height: isFlashcardExpanded ? 90 : 100,
            zIndex: 5,
            top: 0,
            opacity: isFlashcardExpanded ? 0 : 1, // Hide when expanded but maintain layout
            transform: [
              { scaleY: secondCardAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0.5]
                })
              }
            ]
          }}
        >
          <TouchableOpacity
            onPress={toggleFlashcardExpansion}
            className={cx(
              "px-9 py-5 rounded-xl",
              "bg-green-500/10",
              "items-center justify-center",
              "h-full w-full"
            )}
            style={{
              shadowColor: "#10B981",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.2,
              shadowRadius: 3,
              elevation: 2
            }}
          >
            <FontAwesomeIcon 
              icon={faListCheck} 
              size={20} 
              color="#10B981"
            />
            <Text 
              className={cx("font-medium text-center mt-2", "text-green-700 dark:text-green-600")}
              style={GlobalFontStyleSheet.textSm}
            >
              Review flashcards
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* First card - Review due cards */}
        <Animated.View
          style={{
            position: 'absolute',
            width: '100%',
            height: 97,
            bottom: 0,
            opacity: firstCardAnimation,
            zIndex: isFlashcardExpanded ? 10 : 1,
            transform: [
              { 
                scaleY: firstCardAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 1]
                })
              }
            ]
          }}
        >
          <TouchableOpacity
            onPress={() => {
              onClose(false);
              router.dismissAll();
              router.replace('/cards');
            }}
            className={cx(
              "px-9 py-4 rounded-xl ",
              "bg-green-500/10",
              "items-center justify-center",
              "h-full w-full"
            )}
          >
            <FontAwesomeIcon 
              icon={faListCheck} 
              size={20} 
              color="#10B981"
            />
            <Text 
              className={cx("font-medium text-center mt-2", "text-green-700 dark:text-green-600")}
              style={GlobalFontStyleSheet.textSm}
            >
              Due for review
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Second card - Practice vocab from chat */}
        <Animated.View
          style={{
            position: 'absolute',
            width: '100%',
            height: 97,
            top: 0,
            opacity: secondCardAnimation,
            zIndex: isFlashcardExpanded ? 10 : 1,
            transform: [
              { 
                scaleY: secondCardAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 1]
                })
              }
            ]
          }}
        >
          <TouchableOpacity
            onPress={() => {
              if (chatData?.chat.id) {
                onClose(false);
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
              }
            }}
            className={cx(
              "px-9 py-4 rounded-xl",
              "bg-orange-500/10",
              "items-center justify-center",
              "h-full w-full"
            )}
          >
            <FontAwesomeIcon 
              icon={faBook} 
              size={20} 
              color="#F97316"
            />
            <Text 
              className={cx("font-medium text-center mt-2", "text-orange-700 dark:text-orange-600")}
              style={GlobalFontStyleSheet.textSm}
            >
              Vocab from chat
            </Text>
          </TouchableOpacity>
        </Animated.View>


      </View>
    );
    
    const buttons = [
      {
        icon: faMessage,
        text: 'Continue conversation',
        onPress: () => onClose(true),
        bgColor: 'bg-blue-500/10',
        textColor: 'text-blue-700 dark:text-blue-300',
        iconColor: '#3B82F6',
      },
      null, // Placeholder for the flashcards button
      {
        icon: faFileLines,
        text: 'Read feedback report',
        onPress: () => {
          onClose(false);
          handleFeedbackNavigation();
        },
        bgColor: 'bg-yellow-500/10',
        textColor: 'text-yellow-700 dark:text-yellow-600',
        iconColor: '#FBBF24',
      },
      {
        icon: faHeadphones,
        text: 'Listen to AI summary',
        onPress: () => {
          if (chatData?.chat.id) {
            onClose(false);
            router.push({
              pathname: '/speak/summary',
              params: { id: chatData.chat.id }
            });
          }
        },
        bgColor: 'bg-purple-500/10',
        textColor: 'text-purple-700 dark:text-purple-600',
        iconColor: '#A855F7',
      },
    ];

    return (
      <View className="flex-row flex-wrap justify-center mt-6 gap-2">
        {buttons.map((button, index) => {
          if (index === 1) {
            // This is where we place our custom animated flashcards component
            return reviewFlashcardsButton;
          }
          if (!button) return null;
          
          return (
            <TouchableOpacity
              key={index}
              onPress={button.onPress}
              className={cx(
                "w-[48%]",
                "px-9 py-5 rounded-xl",
                button.bgColor,
                "items-center justify-center",
                isFlashcardExpanded ? 'opacity-30' : 'opacity-100'
              )}
            >
              <FontAwesomeIcon 
                icon={button.icon} 
                size={20} 
                color={button.iconColor}
              />
              <Text 
                className={cx("font-medium text-center mt-2", button.textColor)}
                style={GlobalFontStyleSheet.textSm}
              >
                {button.text}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <SlidingModal 
      visible={isVisible} 
      onClose={() => onClose(true)}
      isFull={true}
    >
      <View className={cx(
        "rounded-t-3xl gap-1",
        isDark ? 'bg-gray-800' : 'bg-white',
        isSmallPhone ? 'py-0' : 'py-4'
      )}>
        <View className={cx('mx-5', isSmallPhone ? 'my-1' : 'my-4')}>
          <Text className='text-center text-2xl font-bold dark:text-gray-100'>
            You've grown your streak!
          </Text>
          
          {renderWeekCircles()}

          <Text className='text-center text-lg font-semibold text-[#00448F] dark:text-gray-100 mb-2'>
            And you've earned 14 points so far in this chat 🙌
          </Text>
        </View>

        {renderActionButtons()}
        
        <View className="mx-5 pt-5">
          <Text className='text-center text-lg dark:text-gray-100'>
            Short on time?{' '}
            <Text 
              className='text-blue-400 text-lg underline active:text-blue-500'
              onPress={() => {
                onClose(false);
                router.push('/speak');
              }}
            >
              Finish for today
            </Text>
            {' '}and come back tomorrow. Remember, consistency is key!
          </Text>
        </View>
      </View>
    </SlidingModal>
  );
} 
