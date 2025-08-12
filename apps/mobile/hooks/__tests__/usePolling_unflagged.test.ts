import { renderHook, act } from '@testing-library/react';
import { API_URL } from '@/constants/api';

// Mock expo-asset first
jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(() => ({ uri: 'mocked-asset-uri' })),
  },
}));

// Mock other dependencies
jest.mock('@/services/JapaneseTextService', () => ({
  JapaneseTextService: jest.fn(),
}));

jest.mock('@/contexts/ReadingAidContext', () => ({
  useReadingAid: jest.fn(),
}));

// Import after mocks
import { usePollingUnflagged } from '../usePolling_unflagged';

global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('usePollingUnflagged', () => {
  const mockHandlePlayAudio = jest.fn();
  const mockSetIsWaitingForResponse = jest.fn();
  const mockSetChatData = jest.fn();

  const mockChatData = {
    chat: { id: 'chat-123' },
    messages: [
      { chat_message_id: 'msg-1', role: 'user', content: 'Hello' },
      { chat_message_id: 'msg-2', role: 'assistant', content: 'Hi there' },
    ],
  };

  const defaultProps = {
    chatData: mockChatData,
    token: 'test-token',
    handlePlayAudio: mockHandlePlayAudio,
    usePollingSystem: true,
    setChatData: mockSetChatData,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockChatData),
    } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('polling behavior', () => {
    it('should start polling and find new messages with audio', async () => {
      const newMessage = {
        chat_message_id: 'msg-3',
        role: 'assistant',
        content: 'New response',
        audio_url: 'audio.mp3',
        word_timings: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ...mockChatData,
          messages: [...mockChatData.messages, newMessage],
        }),
      } as any);

      const { result } = renderHook(() => usePollingUnflagged(defaultProps));
      
      act(() => {
        result.current.startPolling();
      });

      expect(result.current.isPolling).toBe(true);

      // Advance timer to trigger poll
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      expect(mockHandlePlayAudio).toHaveBeenCalledWith(
        'audio.mp3',
        [],
        'msg-3',
        'New response'
      );
      expect(result.current.showResponseTimeout).toBe(false);
    });

    it('should not start polling if already polling', () => {
      const { result } = renderHook(() => usePollingUnflagged(defaultProps));
      
      act(() => {
        result.current.startPolling();
      });
      
      const fetchCallCount = mockFetch.mock.calls.length;
      
      act(() => {
        result.current.startPolling();
      });
      
      expect(mockFetch.mock.calls.length).toBe(fetchCallCount);
    });

    it('should use faster interval after refresh', async () => {
      const { result } = renderHook(() => usePollingUnflagged(defaultProps));
      
      act(() => {
        result.current.handleRefreshChat();
      });

      // Should poll faster (1000ms) after refresh
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('handleRefreshChat', () => {
    it('should clear timeout states and restart polling', async () => {
      const { result } = renderHook(() => usePollingUnflagged(defaultProps));
      
      // Set timeout state first
      act(() => {
        result.current.setShowResponseTimeout(true);
      });

      expect(result.current.showResponseTimeout).toBe(true);

      act(() => {
        result.current.handleRefreshChat();
      });

      // Wait for the async operation to complete
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.showResponseTimeout).toBe(false);
      expect(result.current.isPolling).toBe(true);
    });

    it('should not refresh if already refreshing', () => {
      const { result } = renderHook(() => usePollingUnflagged(defaultProps));
      
      act(() => {
        result.current.handleRefreshChat();
      });
      
      const isPollingFirst = result.current.isPolling;
      
      // Try to refresh again immediately
      act(() => {
        result.current.handleRefreshChat();
      });
      
      expect(result.current.isPolling).toBe(isPollingFirst);
    });

    it('should clear isWaitingForResponse when provided', () => {
      const mockSetWaiting = jest.fn();
      const { result } = renderHook(() => usePollingUnflagged({
        ...defaultProps,
        setIsWaitingForResponse: mockSetWaiting,
      }));
      
      act(() => {
        result.current.handleRefreshChat();
      });

      // Should only be called with false, never with true
      expect(mockSetWaiting).toHaveBeenCalledWith(false);
      expect(mockSetWaiting).not.toHaveBeenCalledWith(true);
    });
  });

  describe('timeout handling', () => {
    it('should stop polling after MAX_POLLING_DURATION', async () => {
      const { result } = renderHook(() => usePollingUnflagged(defaultProps));
      
      act(() => {
        result.current.startPolling();
      });

      expect(result.current.isPolling).toBe(true);

      await act(async () => {
        jest.advanceTimersByTime(20000); // MAX_POLLING_DURATION
      });

      expect(result.current.isPolling).toBe(false);
    });

    it('should handle polling errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      const { result } = renderHook(() => usePollingUnflagged(defaultProps));
      
      act(() => {
        result.current.startPolling();
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // Should stop polling on error
      expect(result.current.isPolling).toBe(false);
    });
  });

  describe('pending messages', () => {
    it('should track pending message IDs', async () => {
      const newMessage = {
        chat_message_id: 'msg-3',
        role: 'assistant',
        content: 'New response',
        audio_url: 'audio.mp3',
        word_timings: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ...mockChatData,
          messages: [...mockChatData.messages, newMessage],
        }),
      } as any);

      const { result } = renderHook(() => usePollingUnflagged(defaultProps));
      
      act(() => {
        result.current.startPolling();
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      expect(result.current.pendingMessageIds.has('msg-3')).toBe(true);
    });

    it('should not process already pending messages', async () => {
      const newMessage = {
        chat_message_id: 'msg-3',
        role: 'assistant',
        content: 'New response',
        audio_url: 'audio.mp3',
        word_timings: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ...mockChatData,
          messages: [...mockChatData.messages, newMessage],
        }),
      } as any);

      const { result } = renderHook(() => usePollingUnflagged(defaultProps));
      
      act(() => {
        result.current.startPolling();
      });

      // First poll
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      expect(mockHandlePlayAudio).toHaveBeenCalledTimes(1);

      // Second poll with same message
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // Should not play audio again for same message
      expect(mockHandlePlayAudio).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('should cleanup intervals and timeouts on unmount', () => {
      const { result, unmount } = renderHook(() => usePollingUnflagged(defaultProps));
      
      act(() => {
        result.current.startPolling();
      });

      unmount();

      // Advance timers to ensure no intervals are running
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      // No additional fetch calls should occur
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not poll if usePollingSystem is false', () => {
      const { result } = renderHook(() => 
        usePollingUnflagged({ ...defaultProps, usePollingSystem: false })
      );
      
      act(() => {
        result.current.startPolling();
      });

      expect(result.current.isPolling).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle missing chatData gracefully', async () => {
      const { result } = renderHook(() => 
        usePollingUnflagged({ ...defaultProps, chatData: null })
      );
      
      act(() => {
        result.current.startPolling();
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // Should stop polling if no chat data
      expect(result.current.isPolling).toBe(false);
    });

    it('should handle messages without audio', async () => {
      const newMessage = {
        chat_message_id: 'msg-3',
        role: 'assistant',
        content: 'New response',
        audio_url: null, // No audio
        word_timings: null,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ...mockChatData,
          messages: [...mockChatData.messages, newMessage],
        }),
      } as any);

      const { result } = renderHook(() => usePollingUnflagged(defaultProps));
      
      act(() => {
        result.current.startPolling();
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // Should not play audio but should stop polling since we found the assistant message
      expect(mockHandlePlayAudio).not.toHaveBeenCalled();
      expect(result.current.isPolling).toBe(false);
    });
  });

  describe('setChatData functionality', () => {
    it('should update chat data when new messages are found', async () => {
      const newMessage = {
        chat_message_id: 'msg-3',
        role: 'assistant',
        content: 'New response',
        audio_url: null,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ...mockChatData,
          messages: [...mockChatData.messages, newMessage],
        }),
      } as any);

      const { result } = renderHook(() => usePollingUnflagged(defaultProps));
      
      act(() => {
        result.current.startPolling();
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // setChatData should be called with a function
      expect(mockSetChatData).toHaveBeenCalled();
      
      // Call the function passed to setChatData to test it
      const updateFunction = mockSetChatData.mock.calls[0][0];
      const updatedData = updateFunction(mockChatData);
      
      // Should add the new message
      expect(updatedData.messages).toHaveLength(3);
      expect(updatedData.messages[2]).toMatchObject(newMessage);
    });

    it('should prevent duplicate messages in setChatData', async () => {
      // Simulate a message that exists in backend but not yet in local state
      // This tests the second layer of duplicate prevention
      const newMessage = {
        chat_message_id: 'msg-3',
        role: 'assistant',
        content: 'New message',
        audio_url: null,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ...mockChatData,
          messages: [...mockChatData.messages, newMessage],
        }),
      } as any);

      const { result } = renderHook(() => usePollingUnflagged(defaultProps));
      
      act(() => {
        result.current.startPolling();
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // setChatData should be called
      expect(mockSetChatData).toHaveBeenCalled();
      
      // Test the duplicate prevention by simulating the message already being in state
      const updateFunction = mockSetChatData.mock.calls[0][0];
      const chatDataWithMessage = {
        ...mockChatData,
        messages: [...mockChatData.messages, newMessage],
      };
      
      // When called with data that already contains the message
      const updatedData = updateFunction(chatDataWithMessage);
      
      // Should NOT add the duplicate message
      expect(updatedData.messages).toHaveLength(3);
      expect(updatedData.messages.filter(m => m.chat_message_id === 'msg-3')).toHaveLength(1);
    });

    it('should handle both user and assistant messages from polling', async () => {
      const newMessages = [
        {
          chat_message_id: 'msg-3',
          role: 'user',
          content: 'Another question',
        },
        {
          chat_message_id: 'msg-4',
          role: 'assistant',
          content: 'Answer to question',
          audio_url: null,
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ...mockChatData,
          messages: [...mockChatData.messages, ...newMessages],
        }),
      } as any);

      const { result } = renderHook(() => usePollingUnflagged(defaultProps));
      
      act(() => {
        result.current.startPolling();
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // Should update chat data with both messages
      expect(mockSetChatData).toHaveBeenCalled();
      
      const updateFunction = mockSetChatData.mock.calls[0][0];
      const updatedData = updateFunction(mockChatData);
      
      // Should add both messages (user and assistant)
      expect(updatedData.messages).toHaveLength(4);
      expect(updatedData.messages[2]).toMatchObject(newMessages[0]);
      expect(updatedData.messages[3]).toMatchObject(newMessages[1]);
      
      // Should stop polling since we found an assistant message
      expect(result.current.isPolling).toBe(false);
    });
  });

  describe('handleRefreshChat with data fetching', () => {
    it('should fetch and update chat data on refresh', async () => {
      const newMessage = {
        chat_message_id: 'msg-3',
        role: 'assistant',
        content: 'Refreshed response',
        audio_url: null,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ...mockChatData,
          messages: [...mockChatData.messages, newMessage],
        }),
      } as any);

      const { result } = renderHook(() => usePollingUnflagged(defaultProps));
      
      await act(async () => {
        await result.current.handleRefreshChat();
      });

      // Should have fetched data
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('chat-123'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'test-token',
          }),
        })
      );

      // Should update chat data
      expect(mockSetChatData).toHaveBeenCalled();
      
      const updateFunction = mockSetChatData.mock.calls[0][0];
      const updatedData = updateFunction(mockChatData);
      
      expect(updatedData.messages).toHaveLength(3);
      expect(updatedData.messages[2]).toMatchObject(newMessage);
    });

    it('should not start polling if refresh finds assistant message', async () => {
      const newMessage = {
        chat_message_id: 'msg-3',
        role: 'assistant',
        content: 'Found on refresh',
        audio_url: null,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ...mockChatData,
          messages: [...mockChatData.messages, newMessage],
        }),
      } as any);

      const { result } = renderHook(() => usePollingUnflagged(defaultProps));
      
      await act(async () => {
        await result.current.handleRefreshChat();
      });

      // Should NOT start polling since we found an assistant message
      expect(result.current.isPolling).toBe(false);
    });

    it('should start polling if refresh finds no new messages', async () => {
      // Return same messages (no new ones)
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockChatData),
      } as any);

      const { result } = renderHook(() => usePollingUnflagged(defaultProps));
      
      await act(async () => {
        await result.current.handleRefreshChat();
      });

      // Wait for async operations
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Should start polling since no new messages found
      expect(result.current.isPolling).toBe(true);
    });
  });
});