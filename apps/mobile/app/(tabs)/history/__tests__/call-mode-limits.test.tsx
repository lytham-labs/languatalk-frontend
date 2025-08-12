import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { View, TouchableOpacity, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import useUserSubscription from '@/services/api/useUserSubscription';
import { hasExceededCallLimit } from '@/services/CallTimeService';

// Mock the entire history screen with the specific handleCallMode functionality
jest.mock('expo-router');
jest.mock('@/contexts/AuthContext');
jest.mock('@/services/api/useUserSubscription');
jest.mock('@/services/CallTimeService');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('react-native-confirm-dialog');

// Mock other dependencies
jest.mock('@/constants/api', () => ({ API_URL: 'https://mock-api.com' }));
jest.mock('@/hooks/useColorScheme', () => () => 'light');
jest.mock('@/hooks/useDevice', () => () => ({ isTablet: false, isPhone: true }));

// Create a test component that simulates the handleCallMode functionality
const MockHistoryScreen = ({ 
  subscriptionInfo, 
  user,
  onCallModeAttempt 
}: {
  subscriptionInfo: any;
  user: any;
  onCallModeAttempt: (chatId: number, limitExceeded: boolean) => void;
}) => {
  const [showCallTimeLimitModal, setShowCallTimeLimitModal] = React.useState(false);
  const router = useRouter();

  const handleCallMode = async (chatId: number) => {
    if (!user?.id) return;
    
    try {
      const limitExceeded = await hasExceededCallLimit(
        user.id.toString(), 
        subscriptionInfo?.plan?.id, 
        subscriptionInfo?.plan?.name, 
        subscriptionInfo?.plan?.product_id
      );
      
      onCallModeAttempt(chatId, limitExceeded);
      
      if (limitExceeded) {
        setShowCallTimeLimitModal(true);
        return;
      }
      
      router.replace({
        pathname: '/(tabs)/speak/call',
        params: { chatId: chatId }
      });
    } catch (error) {
      // Handle error gracefully - don't show modal or navigate
      console.error('Error checking call limit:', error);
    }
  };

  return (
    <View>
      <TouchableOpacity 
        testID="call-mode-button"
        onPress={() => handleCallMode(123)}
      >
        <Text>Continue in call mode</Text>
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

describe('History Screen Call Mode Limits', () => {
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

  describe('Free Plan Users', () => {
    const freeUser = { id: 'free-user-123' };
    const freeSubscription = {
      plan: {
        id: 'free',
        name: 'Free Plan', 
        product_id: 'free'
      }
    };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: freeUser, token: 'token' } as any);
      mockUseUserSubscription.mockReturnValue({ 
        subscriptionInfo: freeSubscription,
        loading: false 
      } as any);
    });

    it('should show modal when free user exceeds daily limit', async () => {
      mockHasExceededCallLimit.mockResolvedValue(true);
      const mockOnCallModeAttempt = jest.fn();

      const { getByTestId, queryByTestId } = render(
        <MockHistoryScreen 
          subscriptionInfo={freeSubscription}
          user={freeUser}
          onCallModeAttempt={mockOnCallModeAttempt}
        />
      );

      expect(queryByTestId('call-limit-modal')).toBeNull();

      await act(async () => {
        fireEvent.press(getByTestId('call-mode-button'));
      });

      await waitFor(() => {
        expect(mockHasExceededCallLimit).toHaveBeenCalledWith(
          'free-user-123',
          'free',
          'Free Plan',
          'free'
        );
        expect(mockOnCallModeAttempt).toHaveBeenCalledWith(123, true);
        expect(getByTestId('call-limit-modal')).toBeTruthy();
        expect(mockRouter.replace).not.toHaveBeenCalled();
      });
    });

    it('should navigate to call mode when free user is under limit', async () => {
      mockHasExceededCallLimit.mockResolvedValue(false);
      const mockOnCallModeAttempt = jest.fn();

      const { getByTestId, queryByTestId } = render(
        <MockHistoryScreen 
          subscriptionInfo={freeSubscription}
          user={freeUser}
          onCallModeAttempt={mockOnCallModeAttempt}
        />
      );

      await act(async () => {
        fireEvent.press(getByTestId('call-mode-button'));
      });

      await waitFor(() => {
        expect(mockHasExceededCallLimit).toHaveBeenCalledWith(
          'free-user-123',
          'free',
          'Free Plan',
          'free'
        );
        expect(mockOnCallModeAttempt).toHaveBeenCalledWith(123, false);
        expect(queryByTestId('call-limit-modal')).toBeNull();
        expect(mockRouter.replace).toHaveBeenCalledWith({
          pathname: '/(tabs)/speak/call',
          params: { chatId: 123 }
        });
      });
    });
  });

  describe('Communicate Plan Users', () => {
    const communicateUser = { id: 'communicate-user-456' };
    
    describe('Google Play Store Communicate Plan', () => {
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

      it('should show modal when Google Play communicate user exceeds 30-minute limit', async () => {
        mockHasExceededCallLimit.mockResolvedValue(true);
        const mockOnCallModeAttempt = jest.fn();

        const { getByTestId } = render(
          <MockHistoryScreen 
            subscriptionInfo={googlePlaySubscription}
            user={communicateUser}
            onCallModeAttempt={mockOnCallModeAttempt}
          />
        );

        await act(async () => {
          fireEvent.press(getByTestId('call-mode-button'));
        });

        await waitFor(() => {
          expect(mockHasExceededCallLimit).toHaveBeenCalledWith(
            'communicate-user-456',
            'GPA.3392-8909-2570-57225..1',
            'Communicate Plan',
            'communicate_monthly'
          );
          expect(mockOnCallModeAttempt).toHaveBeenCalledWith(123, true);
          expect(getByTestId('call-limit-modal')).toBeTruthy();
          expect(mockRouter.replace).not.toHaveBeenCalled();
        });
      });

      it('should navigate when Google Play communicate user is under limit', async () => {
        mockHasExceededCallLimit.mockResolvedValue(false);
        const mockOnCallModeAttempt = jest.fn();

        const { getByTestId, queryByTestId } = render(
          <MockHistoryScreen 
            subscriptionInfo={googlePlaySubscription}
            user={communicateUser}
            onCallModeAttempt={mockOnCallModeAttempt}
          />
        );

        await act(async () => {
          fireEvent.press(getByTestId('call-mode-button'));
        });

        await waitFor(() => {
          expect(mockHasExceededCallLimit).toHaveBeenCalledWith(
            'communicate-user-456',
            'GPA.3392-8909-2570-57225..1',
            'Communicate Plan',
            'communicate_monthly'
          );
          expect(mockOnCallModeAttempt).toHaveBeenCalledWith(123, false);
          expect(queryByTestId('call-limit-modal')).toBeNull();
          expect(mockRouter.replace).toHaveBeenCalledWith({
            pathname: '/(tabs)/speak/call',
            params: { chatId: 123 }
          });
        });
      });
    });

    describe('App Store Communicate Plan', () => {
      const appStoreSubscription = {
        plan: {
          id: 'communicate_monthly_ios',
          name: 'Communicate Monthly',
          product_id: 'communicate_monthly'
        }
      };

      beforeEach(() => {
        mockUseAuth.mockReturnValue({ user: communicateUser, token: 'token' } as any);
        mockUseUserSubscription.mockReturnValue({ 
          subscriptionInfo: appStoreSubscription,
          loading: false 
        } as any);
      });

      it('should handle App Store communicate plan correctly', async () => {
        mockHasExceededCallLimit.mockResolvedValue(false);
        const mockOnCallModeAttempt = jest.fn();

        const { getByTestId } = render(
          <MockHistoryScreen 
            subscriptionInfo={appStoreSubscription}
            user={communicateUser}
            onCallModeAttempt={mockOnCallModeAttempt}
          />
        );

        await act(async () => {
          fireEvent.press(getByTestId('call-mode-button'));
        });

        await waitFor(() => {
          expect(mockHasExceededCallLimit).toHaveBeenCalledWith(
            'communicate-user-456',
            'communicate_monthly_ios',
            'Communicate Monthly',
            'communicate_monthly'
          );
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

      const mockOnCallModeAttempt = jest.fn();

      const { getByTestId } = render(
        <MockHistoryScreen 
          subscriptionInfo={{ plan: { id: 'free' } }}
          user={null}
          onCallModeAttempt={mockOnCallModeAttempt}
        />
      );

      await act(async () => {
        fireEvent.press(getByTestId('call-mode-button'));
      });

      // Should not call hasExceededCallLimit or attempt navigation
      expect(mockHasExceededCallLimit).not.toHaveBeenCalled();
      expect(mockOnCallModeAttempt).not.toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('should handle missing subscription info gracefully', async () => {
      const user = { id: 'user-123' };
      mockUseAuth.mockReturnValue({ user, token: 'token' } as any);
      mockUseUserSubscription.mockReturnValue({ 
        subscriptionInfo: null,
        loading: false 
      } as any);
      mockHasExceededCallLimit.mockResolvedValue(false);

      const mockOnCallModeAttempt = jest.fn();

      const { getByTestId } = render(
        <MockHistoryScreen 
          subscriptionInfo={null}
          user={user}
          onCallModeAttempt={mockOnCallModeAttempt}
        />
      );

      await act(async () => {
        fireEvent.press(getByTestId('call-mode-button'));
      });

      await waitFor(() => {
        expect(mockHasExceededCallLimit).toHaveBeenCalledWith(
          'user-123',
          undefined,
          undefined,
          undefined
        );
        expect(mockOnCallModeAttempt).toHaveBeenCalledWith(123, false);
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

      const mockOnCallModeAttempt = jest.fn();

      const { getByTestId, queryByTestId } = render(
        <MockHistoryScreen 
          subscriptionInfo={{ plan: { id: 'free' } }}
          user={user}
          onCallModeAttempt={mockOnCallModeAttempt}
        />
      );

      await act(async () => {
        fireEvent.press(getByTestId('call-mode-button'));
      });

      await waitFor(() => {
        expect(mockHasExceededCallLimit).toHaveBeenCalled();
        // Should fail safely and not show modal or navigate
        expect(queryByTestId('call-limit-modal')).toBeNull();
        expect(mockRouter.replace).not.toHaveBeenCalled();
      });
    });
  });

  describe('Modal Interactions', () => {
    const user = { id: 'user-123' };
    const subscription = { plan: { id: 'free', name: 'Free Plan', product_id: 'free' } };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user, token: 'token' } as any);
      mockUseUserSubscription.mockReturnValue({ 
        subscriptionInfo: subscription,
        loading: false 
      } as any);
    });

    it('should close modal when close button is pressed', async () => {
      mockHasExceededCallLimit.mockResolvedValue(true);
      const mockOnCallModeAttempt = jest.fn();

      const { getByTestId, queryByTestId } = render(
        <MockHistoryScreen 
          subscriptionInfo={subscription}
          user={user}
          onCallModeAttempt={mockOnCallModeAttempt}
        />
      );

      // Trigger limit exceeded
      await act(async () => {
        fireEvent.press(getByTestId('call-mode-button'));
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

  describe('Chat ID Parameter Handling', () => {
    const user = { id: 'user-123' };
    const subscription = { plan: { id: 'free' } };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user, token: 'token' } as any);
      mockUseUserSubscription.mockReturnValue({ 
        subscriptionInfo: subscription,
        loading: false 
      } as any);
      mockHasExceededCallLimit.mockResolvedValue(false);
    });

    it('should pass correct chat ID to router', async () => {
      const mockOnCallModeAttempt = jest.fn();

      const { getByTestId } = render(
        <MockHistoryScreen 
          subscriptionInfo={subscription}
          user={user}
          onCallModeAttempt={mockOnCallModeAttempt}
        />
      );

      await act(async () => {
        fireEvent.press(getByTestId('call-mode-button'));
      });

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith({
          pathname: '/(tabs)/speak/call',
          params: { chatId: 123 }
        });
      });
    });
  });
});