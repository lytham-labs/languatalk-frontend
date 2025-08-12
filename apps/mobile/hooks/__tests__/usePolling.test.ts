import { renderHook, act, waitFor } from '@testing-library/react';
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

jest.mock('@/contexts/ChatDataContext');

// Now import after mocks are set up
import { usePolling } from '../usePolling';
import { useChatData } from '@/contexts/ChatDataContext';

global.fetch = jest.fn();

const mockUseChatData = useChatData as jest.MockedFunction<typeof useChatData>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('usePolling', () => {
  const mockHandlePlayAudio = jest.fn();
  const mockSetIsWaitingForResponse = jest.fn();
  const mockSetIsRefreshing = jest.fn();
  const mockDispatch = jest.fn();
  const mockAddMessage = jest.fn();

  const defaultProps = {
    token: 'test-token',
    handlePlayAudio: mockHandlePlayAudio,
    usePollingSystem: true,
    setIsWaitingForResponse: mockSetIsWaitingForResponse,
    setIsRefreshing: mockSetIsRefreshing,
  };

  const mockChatState = {
    chat: { id: 'chat-123' },
    messages: [
      { chat_message_id: 'msg-1', role: 'user', content: 'Hello' },
      { chat_message_id: 'msg-2', role: 'assistant', content: 'Hi there' },
    ],
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    
    mockUseChatData.mockReturnValue({
      state: mockChatState,
      dispatch: mockDispatch,
      addMessage: mockAddMessage,
    } as any);

    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockChatState),
    } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('startPolling', () => {
    it('should start polling when not already polling', () => {
      const { result } = renderHook(() => usePolling(defaultProps));
      
      act(() => {
        result.current.startPolling();
      });

      expect(result.current.isPolling).toBe(true);
    });

    it('should not start polling if already polling', () => {
      const { result } = renderHook(() => usePolling(defaultProps));
      
      act(() => {
        result.current.startPolling();
      });
      
      const firstPollState = result.current.isPolling;
      
      act(() => {
        result.current.startPolling();
      });
      
      expect(result.current.isPolling).toBe(firstPollState);
    });

    it('should poll for new messages at regular intervals', async () => {
      const { result } = renderHook(() => usePolling(defaultProps));
      
      act(() => {
        result.current.startPolling();
      });

      // Advance timer to trigger first poll
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/chats/${mockChatState.chat.id}`,
        expect.objectContaining({
          headers: {
            'Authorization': 'test-token',
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should handle new messages with audio', async () => {
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
          ...mockChatState,
          messages: [...mockChatState.messages, newMessage],
        }),
      } as any);

      const { result } = renderHook(() => usePolling(defaultProps));
      
      act(() => {
        result.current.startPolling();
      });

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

    it('should stop polling after MAX_POLLING_DURATION', async () => {
      const { result } = renderHook(() => usePolling(defaultProps));
      
      act(() => {
        result.current.startPolling();
      });

      expect(result.current.isPolling).toBe(true);

      await act(async () => {
        jest.advanceTimersByTime(20000); // MAX_POLLING_DURATION
      });

      expect(result.current.isPolling).toBe(false);
    });
  });

  describe('handleRefreshChat', () => {
    it('should fetch latest chat data on refresh', async () => {
      const { result } = renderHook(() => usePolling(defaultProps));
      
      await act(async () => {
        await result.current.handleRefreshChat();
      });

      expect(mockSetIsRefreshing).toHaveBeenCalledWith(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should clear waiting state when new messages are found', async () => {
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
          ...mockChatState,
          messages: [...mockChatState.messages, newMessage],
        }),
      } as any);

      const { result } = renderHook(() => usePolling(defaultProps));
      
      await act(async () => {
        await result.current.handleRefreshChat();
      });

      expect(mockSetIsWaitingForResponse).toHaveBeenCalledWith(false);
      expect(result.current.showResponseTimeout).toBe(false);
      // The handleRefreshChat uses dispatch to update chat data instead of addMessage
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'setChatData',
        payload: expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ chat_message_id: 'msg-3' })
          ])
        })
      });
    });

    it('should continue polling if no new messages found', async () => {
      const { result } = renderHook(() => usePolling(defaultProps));
      
      await act(async () => {
        await result.current.handleRefreshChat();
      });

      expect(result.current.isPolling).toBe(true);
    });

    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => usePolling(defaultProps));
      
      await act(async () => {
        await result.current.handleRefreshChat();
      });

      // Should continue polling even on error
      expect(result.current.isPolling).toBe(true);
      // Check that setIsRefreshing was called with both true and false
      expect(mockSetIsRefreshing).toHaveBeenCalledWith(true);
      // Wait for the timeout to complete
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(mockSetIsRefreshing).toHaveBeenCalledWith(false);
    });

    it('should not refresh if already refreshing', async () => {
      const { result } = renderHook(() => usePolling(defaultProps));
      
      // Start first refresh
      const promise1 = act(async () => {
        await result.current.handleRefreshChat();
      });

      // Try to start second refresh immediately
      const promise2 = act(async () => {
        await result.current.handleRefreshChat();
      });

      await Promise.all([promise1, promise2]);

      // Should only call fetch once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopPolling', () => {
    it('should stop polling and clear intervals', () => {
      const { result } = renderHook(() => usePolling(defaultProps));
      
      act(() => {
        result.current.startPolling();
      });

      expect(result.current.isPolling).toBe(true);

      act(() => {
        result.current.stopPolling();
      });

      expect(result.current.isPolling).toBe(false);
    });
  });

  describe('timeout management', () => {
    it('should set showResponseTimeout when timeout is triggered', () => {
      const { result } = renderHook(() => usePolling(defaultProps));
      
      act(() => {
        result.current.setShowResponseTimeout(true);
      });

      expect(result.current.showResponseTimeout).toBe(true);
    });

    it('should clear timeout state on successful message retrieval', async () => {
      const newMessage = {
        chat_message_id: 'msg-3',
        role: 'assistant',
        content: 'New response',
        audio_url: 'audio.mp3',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ...mockChatState,
          messages: [...mockChatState.messages, newMessage],
        }),
      } as any);

      const { result } = renderHook(() => usePolling(defaultProps));
      
      // Set timeout state
      act(() => {
        result.current.setShowResponseTimeout(true);
      });

      // Refresh should clear timeout
      await act(async () => {
        await result.current.handleRefreshChat();
      });

      expect(result.current.showResponseTimeout).toBe(false);
      expect(mockSetIsWaitingForResponse).toHaveBeenCalledWith(false);
    });
  });

  describe('cleanup', () => {
    it('should cleanup intervals on unmount', () => {
      const { unmount } = renderHook(() => usePolling(defaultProps));
      
      unmount();

      // Advance timers to ensure no intervals are running
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      // No errors should occur from cleared intervals
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});