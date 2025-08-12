import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { View, TouchableOpacity, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import useUserSubscription from '@/services/api/useUserSubscription';
import { hasExceededCallLimit } from '@/services/CallTimeService';

// Mock all dependencies
jest.mock('expo-router');
jest.mock('@/contexts/AuthContext');
jest.mock('@/services/api/useUserSubscription');
jest.mock('@/services/CallTimeService');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@/constants/api', () => ({ API_URL: 'https://mock-api.com' }));

// Mock the createChat functionality from speak/index.tsx
const MockSpeakIndexScreen = ({ 
  user,
  subscriptionInfo,
  settings,
  onCreateChatAttempt
}: {
  user: any;
  subscriptionInfo: any;
  settings: any;
  onCreateChatAttempt: (limitExceeded: boolean) => void;
}) => {
  const [showCallTimeLimitModal, setShowCallTimeLimitModal] = React.useState(false);
  const router = useRouter();

  const createChat = async () => {
    // Check for call limit before creating call mode chat
    if (settings.mode === 'call_mode' && user?.id) {
      try {
        const limitExceeded = await hasExceededCallLimit(
          user.id.toString(), 
          subscriptionInfo?.plan?.id, 
          subscriptionInfo?.plan?.name, 
          subscriptionInfo?.plan?.product_id
        );
        
        onCreateChatAttempt(limitExceeded);
        
        if (limitExceeded) {
          setShowCallTimeLimitModal(true);
          return;
        }
      } catch (error) {
        // Handle error gracefully - don't show modal or proceed with chat creation
        console.error('Error checking call limit:', error);
        return;
      }
    }
    
    // Mock API call and navigation
    const mockChatData = { chat: { id: 456 } };
    
    if (settings.mode === 'call_mode') {
      router.push({
        pathname: '/(tabs)/speak/call',
        params: { chatId: mockChatData.chat.id }
      });
    } else {
      router.push({
        pathname: '/(tabs)/speak/chat',
        params: { chatId: mockChatData.chat.id, initialData: JSON.stringify(mockChatData) }
      });
    }
  };

  return (
    <View>
      <TouchableOpacity 
        testID="create-chat-button"
        onPress={createChat}
      >
        <Text>Start Chat</Text>
      </TouchableOpacity>
      {showCallTimeLimitModal && (
        <View testID="call-limit-modal">
          <Text>Call limit reached</Text>
          <TouchableOpacity 
            testID="close-modal"
            onPress={() => setShowCallTimeLimitModal(false)}
          >
            <Text>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

describe('Speak Index Screen Call Mode Limits', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
  const mockUseUserSubscription = useUserSubscription as jest.MockedFunction<typeof useUserSubscription>;
  const mockHasExceededCallLimit = hasExceededCallLimit as jest.MockedFunction<typeof hasExceededCallLimit>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter as any);
  });

  describe('Call Mode Chat Creation', () => {
    const user = { id: 'user-123' };
    const callModeSettings = { mode: 'call_mode' };

    describe('Free Plan Users', () => {
      const freeSubscription = {
        plan: {
          id: 'free',
          name: 'Free Plan',
          product_id: 'free'
        }
      };

      beforeEach(() => {
        mockUseAuth.mockReturnValue({ user, token: 'token' } as any);
        mockUseUserSubscription.mockReturnValue({ 
          subscriptionInfo: freeSubscription,
          loading: false 
        } as any);
      });

      it('should show modal when free user tries to create call mode chat over limit', async () => {
        mockHasExceededCallLimit.mockResolvedValue(true);
        const mockOnCreateChatAttempt = jest.fn();

        const { getByTestId, queryByTestId } = render(
          <MockSpeakIndexScreen 
            user={user}
            subscriptionInfo={freeSubscription}
            settings={callModeSettings}
            onCreateChatAttempt={mockOnCreateChatAttempt}
          />
        );

        expect(queryByTestId('call-limit-modal')).toBeNull();

        await act(async () => {
          fireEvent.press(getByTestId('create-chat-button'));
        });

        await waitFor(() => {
          expect(mockHasExceededCallLimit).toHaveBeenCalledWith(
            'user-123',
            'free',
            'Free Plan',
            'free'
          );
          expect(mockOnCreateChatAttempt).toHaveBeenCalledWith(true);
          expect(getByTestId('call-limit-modal')).toBeTruthy();
          expect(mockRouter.push).not.toHaveBeenCalled();
        });
      });

      it('should create call mode chat when free user is under limit', async () => {
        mockHasExceededCallLimit.mockResolvedValue(false);
        const mockOnCreateChatAttempt = jest.fn();

        const { getByTestId, queryByTestId } = render(
          <MockSpeakIndexScreen 
            user={user}
            subscriptionInfo={freeSubscription}
            settings={callModeSettings}
            onCreateChatAttempt={mockOnCreateChatAttempt}
          />
        );

        await act(async () => {
          fireEvent.press(getByTestId('create-chat-button'));
        });

        await waitFor(() => {
          expect(mockHasExceededCallLimit).toHaveBeenCalledWith(
            'user-123',
            'free',
            'Free Plan',
            'free'
          );
          expect(mockOnCreateChatAttempt).toHaveBeenCalledWith(false);
          expect(queryByTestId('call-limit-modal')).toBeNull();
          expect(mockRouter.push).toHaveBeenCalledWith({
            pathname: '/(tabs)/speak/call',
            params: { chatId: 456 }
          });
        });
      });
    });

    describe('Communicate Plan Users', () => {
      const communicateUser = { id: 'communicate-user-789' };
      const googlePlaySubscription = {
        plan: {
          id: 'GPA.3392-8909-2570-57225..1',
          name: 'Communicate Plan',
          product_id: 'communicate_monthly'
        }
      };

      beforeEach(() => {
        mockUseAuth.mockReturnValue({ user: communicateUser, token: 'token' } as any);
        mockUseUserSubscription.mockReturnValue({ 
          subscriptionInfo: googlePlaySubscription,
          loading: false 
        } as any);
      });

      it('should show modal when communicate user exceeds 30-minute limit', async () => {
        mockHasExceededCallLimit.mockResolvedValue(true);
        const mockOnCreateChatAttempt = jest.fn();

        const { getByTestId } = render(
          <MockSpeakIndexScreen 
            user={communicateUser}
            subscriptionInfo={googlePlaySubscription}
            settings={callModeSettings}
            onCreateChatAttempt={mockOnCreateChatAttempt}
          />
        );

        await act(async () => {
          fireEvent.press(getByTestId('create-chat-button'));
        });

        await waitFor(() => {
          expect(mockHasExceededCallLimit).toHaveBeenCalledWith(
            'communicate-user-789',
            'GPA.3392-8909-2570-57225..1',
            'Communicate Plan',
            'communicate_monthly'
          );
          expect(mockOnCreateChatAttempt).toHaveBeenCalledWith(true);
          expect(getByTestId('call-limit-modal')).toBeTruthy();
          expect(mockRouter.push).not.toHaveBeenCalled();
        });
      });

      it('should create call mode chat when communicate user is under limit', async () => {
        mockHasExceededCallLimit.mockResolvedValue(false);
        const mockOnCreateChatAttempt = jest.fn();

        const { getByTestId, queryByTestId } = render(
          <MockSpeakIndexScreen 
            user={communicateUser}
            subscriptionInfo={googlePlaySubscription}
            settings={callModeSettings}
            onCreateChatAttempt={mockOnCreateChatAttempt}
          />
        );

        await act(async () => {
          fireEvent.press(getByTestId('create-chat-button'));
        });

        await waitFor(() => {
          expect(mockHasExceededCallLimit).toHaveBeenCalledWith(
            'communicate-user-789',
            'GPA.3392-8909-2570-57225..1',
            'Communicate Plan',
            'communicate_monthly'
          );
          expect(mockOnCreateChatAttempt).toHaveBeenCalledWith(false);
          expect(queryByTestId('call-limit-modal')).toBeNull();
          expect(mockRouter.push).toHaveBeenCalledWith({
            pathname: '/(tabs)/speak/call',
            params: { chatId: 456 }
          });
        });
      });
    });
  });

  describe('Non-Call Mode Chat Creation', () => {
    const user = { id: 'user-123' };
    const textModeSettings = { mode: 'text_audio' };
    const freeSubscription = { plan: { id: 'free' } };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user, token: 'token' } as any);
      mockUseUserSubscription.mockReturnValue({ 
        subscriptionInfo: freeSubscription,
        loading: false 
      } as any);
    });

    it('should not check call limits for non-call mode chats', async () => {
      const mockOnCreateChatAttempt = jest.fn();

      const { getByTestId } = render(
        <MockSpeakIndexScreen 
          user={user}
          subscriptionInfo={freeSubscription}
          settings={textModeSettings}
          onCreateChatAttempt={mockOnCreateChatAttempt}
        />
      );

      await act(async () => {
        fireEvent.press(getByTestId('create-chat-button'));
      });

      await waitFor(() => {
        expect(mockHasExceededCallLimit).not.toHaveBeenCalled();
        expect(mockOnCreateChatAttempt).not.toHaveBeenCalled();
        expect(mockRouter.push).toHaveBeenCalledWith({
          pathname: '/(tabs)/speak/chat',
          params: { chatId: 456, initialData: expect.any(String) }
        });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing user gracefully', async () => {
      mockUseAuth.mockReturnValue({ user: null, token: 'token' } as any);
      mockUseUserSubscription.mockReturnValue({ 
        subscriptionInfo: { plan: { id: 'free' } },
        loading: false 
      } as any);

      const mockOnCreateChatAttempt = jest.fn();
      const callModeSettings = { mode: 'call_mode' };

      const { getByTestId } = render(
        <MockSpeakIndexScreen 
          user={null}
          subscriptionInfo={{ plan: { id: 'free' } }}
          settings={callModeSettings}
          onCreateChatAttempt={mockOnCreateChatAttempt}
        />
      );

      await act(async () => {
        fireEvent.press(getByTestId('create-chat-button'));
      });

      // Should skip call limit check and proceed to create chat
      await waitFor(() => {
        expect(mockHasExceededCallLimit).not.toHaveBeenCalled();
        expect(mockOnCreateChatAttempt).not.toHaveBeenCalled();
        expect(mockRouter.push).toHaveBeenCalledWith({
          pathname: '/(tabs)/speak/call',
          params: { chatId: 456 }
        });
      });
    });

    it('should handle missing subscription info gracefully', async () => {
      const user = { id: 'user-123' };
      mockUseAuth.mockReturnValue({ user, token: 'token' } as any);
      mockUseUserSubscription.mockReturnValue({ 
        subscriptionInfo: null,
        loading: false 
      } as any);
      mockHasExceededCallLimit.mockResolvedValue(false);

      const mockOnCreateChatAttempt = jest.fn();
      const callModeSettings = { mode: 'call_mode' };

      const { getByTestId } = render(
        <MockSpeakIndexScreen 
          user={user}
          subscriptionInfo={null}
          settings={callModeSettings}
          onCreateChatAttempt={mockOnCreateChatAttempt}
        />
      );

      await act(async () => {
        fireEvent.press(getByTestId('create-chat-button'));
      });

      await waitFor(() => {
        expect(mockHasExceededCallLimit).toHaveBeenCalledWith(
          'user-123',
          undefined,
          undefined,
          undefined
        );
        expect(mockOnCreateChatAttempt).toHaveBeenCalledWith(false);
      });
    });

    it('should handle hasExceededCallLimit errors gracefully', async () => {
      const user = { id: 'user-123' };
      mockUseAuth.mockReturnValue({ user, token: 'token' } as any);
      mockUseUserSubscription.mockReturnValue({ 
        subscriptionInfo: { plan: { id: 'free' } },
        loading: false 
      } as any);
      mockHasExceededCallLimit.mockRejectedValue(new Error('Storage error'));

      const mockOnCreateChatAttempt = jest.fn();
      const callModeSettings = { mode: 'call_mode' };

      const { getByTestId, queryByTestId } = render(
        <MockSpeakIndexScreen 
          user={user}
          subscriptionInfo={{ plan: { id: 'free' } }}
          settings={callModeSettings}
          onCreateChatAttempt={mockOnCreateChatAttempt}
        />
      );

      await act(async () => {
        fireEvent.press(getByTestId('create-chat-button'));
      });

      await waitFor(() => {
        expect(mockHasExceededCallLimit).toHaveBeenCalled();
        // Should fail safely and not proceed with chat creation
        expect(queryByTestId('call-limit-modal')).toBeNull();
        expect(mockRouter.push).not.toHaveBeenCalled();
      });
    });
  });

  describe('Modal Interactions', () => {
    const user = { id: 'user-123' };
    const subscription = { plan: { id: 'free', name: 'Free Plan', product_id: 'free' } };
    const callModeSettings = { mode: 'call_mode' };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user, token: 'token' } as any);
      mockUseUserSubscription.mockReturnValue({ 
        subscriptionInfo: subscription,
        loading: false 
      } as any);
    });

    it('should close modal when close button is pressed', async () => {
      mockHasExceededCallLimit.mockResolvedValue(true);
      const mockOnCreateChatAttempt = jest.fn();

      const { getByTestId, queryByTestId } = render(
        <MockSpeakIndexScreen 
          user={user}
          subscriptionInfo={subscription}
          settings={callModeSettings}
          onCreateChatAttempt={mockOnCreateChatAttempt}
        />
      );

      // Trigger limit exceeded
      await act(async () => {
        fireEvent.press(getByTestId('create-chat-button'));
      });

      await waitFor(() => {
        expect(getByTestId('call-limit-modal')).toBeTruthy();
      });

      // Close modal
      fireEvent.press(getByTestId('close-modal'));
      
      await waitFor(() => {
        expect(queryByTestId('call-limit-modal')).toBeNull();
      });
    });
  });

  describe('Different Chat Modes', () => {
    const user = { id: 'user-123' };
    const freeSubscription = { plan: { id: 'free' } };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user, token: 'token' } as any);
      mockUseUserSubscription.mockReturnValue({ 
        subscriptionInfo: freeSubscription,
        loading: false 
      } as any);
    });

    const modeTestCases = [
      {
        mode: 'text_only',
        description: 'text only mode',
        shouldCheckLimits: false,
        expectedPath: '/(tabs)/speak/chat'
      },
      {
        mode: 'audio_only', 
        description: 'audio only mode',
        shouldCheckLimits: false,
        expectedPath: '/(tabs)/speak/chat'
      },
      {
        mode: 'text_audio',
        description: 'text and audio mode',
        shouldCheckLimits: false,
        expectedPath: '/(tabs)/speak/chat'
      },
      {
        mode: 'call_mode',
        description: 'call mode',
        shouldCheckLimits: true,
        expectedPath: '/(tabs)/speak/call'
      }
    ];

    modeTestCases.forEach(({ mode, description, shouldCheckLimits, expectedPath }) => {
      it(`should handle ${description} correctly`, async () => {
        if (shouldCheckLimits) {
          mockHasExceededCallLimit.mockResolvedValue(false);
        }

        const mockOnCreateChatAttempt = jest.fn();
        const settings = { mode };

        const { getByTestId } = render(
          <MockSpeakIndexScreen 
            user={user}
            subscriptionInfo={freeSubscription}
            settings={settings}
            onCreateChatAttempt={mockOnCreateChatAttempt}
          />
        );

        await act(async () => {
          fireEvent.press(getByTestId('create-chat-button'));
        });

        await waitFor(() => {
          if (shouldCheckLimits) {
            expect(mockHasExceededCallLimit).toHaveBeenCalled();
            expect(mockOnCreateChatAttempt).toHaveBeenCalledWith(false);
          } else {
            expect(mockHasExceededCallLimit).not.toHaveBeenCalled();
          }
          
          expect(mockRouter.push).toHaveBeenCalledWith(
            expect.objectContaining({
              pathname: expectedPath,
              params: expect.objectContaining({ chatId: 456 })
            })
          );
        });
      });
    });
  });
});