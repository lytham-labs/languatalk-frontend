import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { render, fireEvent } from '@testing-library/react-native';
import { usePolling } from '@/hooks/usePolling';
import { usePollingUnflagged } from '@/hooks/usePolling_unflagged';
import LoadingDots from '@/components/LoadingDots';
import { API_URL } from '@/constants/api';

// Mock dependencies
jest.mock('@/contexts/ChatDataContext');
jest.mock('@fortawesome/react-native-fontawesome', () => ({
  FontAwesomeIcon: 'FontAwesomeIcon',
}));
jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));
jest.mock('@/hooks/useDevice', () => ({
  __esModule: true,
  default: jest.fn(() => ({ isTablet: false })),
}));

global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Polling and Timeout Integration Flow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Complete timeout and refresh flow', () => {
    it('should handle the complete flow: timeout → show UI → refresh → clear states', async () => {
      // Setup
      const mockSetIsWaitingForResponse = jest.fn();
      const mockHandlePlayAudio = jest.fn();
      const mockOnRefresh = jest.fn();
      
      const chatData = {
        chat: { id: 'chat-123' },
        messages: [{ chat_message_id: 'msg-1', role: 'user', content: 'Hello' }],
      };

      // Mock fetch to return no new messages initially
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(chatData),
      } as any);

      // 1. Start with waiting for response
      mockSetIsWaitingForResponse.mockImplementation((value) => {
        console.log('setIsWaitingForResponse called with:', value);
      });

      // Render the polling hook
      const { result: pollingResult } = renderHook(() =>
        usePollingUnflagged({
          chatData,
          token: 'test-token',
          handlePlayAudio: mockHandlePlayAudio,
          usePollingSystem: true,
          setIsWaitingForResponse: mockSetIsWaitingForResponse,
        })
      );

      // 2. Start polling
      act(() => {
        pollingResult.current.startPolling();
      });

      expect(pollingResult.current.isPolling).toBe(true);

      // 3. Simulate timeout by setting timeout state
      act(() => {
        pollingResult.current.setShowResponseTimeout(true);
      });

      // 4. Render LoadingDots with timeout UI
      const { getByText, rerender } = render(
        <LoadingDots
          avatarUrl="avatar.jpg"
          showTimeout={pollingResult.current.showResponseTimeout}
          onRefresh={mockOnRefresh}
          newMessageArrived={false}
        />
      );

      expect(getByText(/AI model is taking longer than normal/i)).toBeTruthy();

      // 5. User clicks refresh
      const refreshButton = getByText(/Try refreshing/i);
      fireEvent.press(refreshButton);

      // 6. Trigger the actual refresh in the hook
      await act(async () => {
        pollingResult.current.handleRefreshChat();
      });

      // 7. Verify states are cleared
      expect(pollingResult.current.showResponseTimeout).toBe(false);
      expect(mockSetIsWaitingForResponse).toHaveBeenCalledWith(false);

      // 8. Update LoadingDots with new state
      rerender(
        <LoadingDots
          avatarUrl="avatar.jpg"
          showTimeout={pollingResult.current.showResponseTimeout}
          onRefresh={mockOnRefresh}
          newMessageArrived={false}
        />
      );

      // 9. Verify timeout UI is hidden
      expect(() => getByText(/AI model is taking longer than normal/i)).toThrow();
    });

    it('should unblock recording when timeout occurs', async () => {
      const mockSetIsWaitingForResponse = jest.fn();
      let isWaitingForResponse = true;
      
      mockSetIsWaitingForResponse.mockImplementation((value) => {
        isWaitingForResponse = value;
      });

      const chatData = {
        chat: { id: 'chat-123' },
        messages: [],
      };

      const { result } = renderHook(() =>
        usePollingUnflagged({
          chatData,
          token: 'test-token',
          handlePlayAudio: jest.fn(),
          usePollingSystem: true,
          setIsWaitingForResponse: mockSetIsWaitingForResponse,
        })
      );

      // Start in waiting state
      expect(isWaitingForResponse).toBe(true);

      // Trigger timeout
      act(() => {
        result.current.setShowResponseTimeout(true);
      });

      // Refresh should clear waiting state
      act(() => {
        result.current.handleRefreshChat();
      });

      // Recording should be unblocked
      expect(mockSetIsWaitingForResponse).toHaveBeenCalledWith(false);
      expect(isWaitingForResponse).toBe(false);
    });

    it('should handle message arrival during timeout', async () => {
      const mockSetIsWaitingForResponse = jest.fn();
      const mockHandlePlayAudio = jest.fn();
      
      const initialChatData = {
        chat: { id: 'chat-123' },
        messages: [{ chat_message_id: 'msg-1', role: 'user', content: 'Hello' }],
      };

      const newMessage = {
        chat_message_id: 'msg-2',
        role: 'assistant',
        content: 'Response',
        audio_url: 'audio.mp3',
        word_timings: [],
      };

      // First return no new messages, then return with new message
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(initialChatData),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            ...initialChatData,
            messages: [...initialChatData.messages, newMessage],
          }),
        } as any);

      const { result } = renderHook(() =>
        usePollingUnflagged({
          chatData: initialChatData,
          token: 'test-token',
          handlePlayAudio: mockHandlePlayAudio,
          usePollingSystem: true,
          setIsWaitingForResponse: mockSetIsWaitingForResponse,
        })
      );

      // Start polling
      act(() => {
        result.current.startPolling();
      });

      // First poll - no new messages
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // Set timeout state
      act(() => {
        result.current.setShowResponseTimeout(true);
      });

      // Second poll - message arrives
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // Should clear timeout and play audio
      expect(result.current.showResponseTimeout).toBe(false);
      expect(mockSetIsWaitingForResponse).toHaveBeenCalledWith(false);
      expect(mockHandlePlayAudio).toHaveBeenCalledWith(
        'audio.mp3',
        [],
        'msg-2',
        'Response'
      );
    });

    it('should handle multiple refresh attempts gracefully', async () => {
      const mockSetIsWaitingForResponse = jest.fn();
      
      const chatData = {
        chat: { id: 'chat-123' },
        messages: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(chatData),
      } as any);

      const { result } = renderHook(() =>
        usePollingUnflagged({
          chatData,
          token: 'test-token',
          handlePlayAudio: jest.fn(),
          usePollingSystem: true,
          setIsWaitingForResponse: mockSetIsWaitingForResponse,
        })
      );

      // Multiple rapid refresh attempts
      act(() => {
        result.current.handleRefreshChat();
        result.current.handleRefreshChat();
        result.current.handleRefreshChat();
      });

      // Should only process one refresh at a time
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      // setIsWaitingForResponse should only be called once per refresh
      const falseCallCount = mockSetIsWaitingForResponse.mock.calls.filter(
        call => call[0] === false
      ).length;
      
      expect(falseCallCount).toBe(1);
    });

    it('should maintain correct state through intermediate and final timeouts', () => {
      const { getByText, rerender, queryByText } = render(
        <LoadingDots
          avatarUrl="avatar.jpg"
          showTimeout={false}
          showIntermediateTimeout={false}
          onRefresh={jest.fn()}
        />
      );

      // Normal loading state
      expect(queryByText(/taking longer/i)).toBeNull();

      // Intermediate timeout
      rerender(
        <LoadingDots
          avatarUrl="avatar.jpg"
          showTimeout={false}
          showIntermediateTimeout={true}
          onRefresh={jest.fn()}
        />
      );

      expect(getByText(/Sorry, I'm thinking for longer than usual/i)).toBeTruthy();

      // Final timeout
      rerender(
        <LoadingDots
          avatarUrl="avatar.jpg"
          showTimeout={true}
          showIntermediateTimeout={false}
          onRefresh={jest.fn()}
        />
      );

      expect(getByText(/AI model is taking longer than normal/i)).toBeTruthy();
      expect(queryByText(/Sorry, I'm thinking/i)).toBeNull();
    });
  });

  describe('Error handling in timeout flow', () => {
    it('should continue polling even if refresh fetch fails', async () => {
      const chatData = {
        chat: { id: 'chat-123' },
        messages: [],
      };

      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        usePollingUnflagged({
          chatData,
          token: 'test-token',
          handlePlayAudio: jest.fn(),
          usePollingSystem: true,
          setIsWaitingForResponse: jest.fn(),
        })
      );

      act(() => {
        result.current.handleRefreshChat();
      });

      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      // Should still be polling despite error
      expect(result.current.isPolling).toBe(true);
    });

    it('should handle timeout UI correctly when message arrives with error', () => {
      const { rerender, queryByText } = render(
        <LoadingDots
          avatarUrl="avatar.jpg"
          showTimeout={true}
          onRefresh={jest.fn()}
          newMessageArrived={false}
        />
      );

      expect(queryByText(/AI model is taking longer/i)).toBeTruthy();

      // Message arrives (even if with error)
      rerender(
        <LoadingDots
          avatarUrl="avatar.jpg"
          showTimeout={true}
          onRefresh={jest.fn()}
          newMessageArrived={true}
        />
      );

      // Timeout UI should be hidden
      expect(queryByText(/AI model is taking longer/i)).toBeFalsy();
    });
  });
});