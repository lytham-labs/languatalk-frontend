import React from 'react';
import { render } from '@testing-library/react-native';
import CallModeLimitReachedModal from './CallModeLimitReachedModal';
import useUserSubscription from '@/services/api/useUserSubscription';

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

// Mock react-native-purchases-ui
jest.mock('react-native-purchases-ui', () => ({
  presentPaywallIfNeeded: jest.fn(), // A common function, adjust if others are used
  presentCustomerSupport: jest.fn(), // Added based on potential usage in presentCustomerCenter
  // Add other functions from RevenueCatUI that your app might use directly or indirectly
}));

// Mock child components and hooks
jest.mock('@/services/api/useUserSubscription');

jest.mock('@/components/pricing/UpgradeProModal', () => {
  const RN = jest.requireActual('react-native');
  return (props: { isVisible: boolean; onClose: () => void }) => 
    props.isVisible ? <RN.View testID="mock-upgrade-pro-modal" {...props} /> : null;
});

jest.mock('@/components/pricing/UpgradeCommunicateCallLimitModal', () => {
  const RN = jest.requireActual('react-native');
  return (props: { isVisible: boolean; onClose: () => void }) => 
    props.isVisible ? <RN.View testID="mock-upgrade-communicate-modal" {...props} /> : null;
});

const mockUseUserSubscription = useUserSubscription as jest.Mock;

describe('CallModeLimitReachedModal', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementation
    mockUseUserSubscription.mockReturnValue({
      subscriptionInfo: null,
      loading: false,
      error: null,
    });
  });

  it('should render null when loading', () => {
    mockUseUserSubscription.mockReturnValueOnce({
      subscriptionInfo: null,
      loading: true,
      error: null,
    });
    const { queryByTestId } = render(
      <CallModeLimitReachedModal isVisible={true} onClose={mockOnClose} />
    );
    expect(queryByTestId('mock-upgrade-pro-modal')).toBeNull();
    expect(queryByTestId('mock-upgrade-communicate-modal')).toBeNull();
  });

  it('should render null and log error when there is an error fetching subscription', () => {
    const consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockUseUserSubscription.mockReturnValueOnce({
      subscriptionInfo: null,
      loading: false,
      error: 'Fetch error',
    });
    const { queryByTestId } = render(
      <CallModeLimitReachedModal isVisible={true} onClose={mockOnClose} />
    );
    expect(queryByTestId('mock-upgrade-pro-modal')).toBeNull();
    expect(queryByTestId('mock-upgrade-communicate-modal')).toBeNull();
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Error fetching subscription info for CallModeLimitReachedModal:',
      'Fetch error'
    );
    consoleErrorMock.mockRestore();
  });

  it('should render UpgradeProModal for a free user when visible', () => {
    mockUseUserSubscription.mockReturnValueOnce({
      subscriptionInfo: { plan: { id: 'free' } },
      loading: false,
      error: null,
    });
    const { getByTestId, queryByTestId } = render(
      <CallModeLimitReachedModal isVisible={true} onClose={mockOnClose} />
    );
    expect(getByTestId('mock-upgrade-pro-modal')).toBeTruthy();
    expect(queryByTestId('mock-upgrade-communicate-modal')).toBeNull();
  });

  it('should render UpgradeProModal for a FREE user (case-insensitive) when visible', () => {
    mockUseUserSubscription.mockReturnValueOnce({
      subscriptionInfo: { plan: { id: 'FrEe' } },
      loading: false,
      error: null,
    });
    const { getByTestId } = render(
      <CallModeLimitReachedModal isVisible={true} onClose={mockOnClose} />
    );
    expect(getByTestId('mock-upgrade-pro-modal')).toBeTruthy();
  });

  it('should render UpgradeCommunicateCallLimitModal for a communicate plan user when visible', () => {
    mockUseUserSubscription.mockReturnValueOnce({
      subscriptionInfo: { plan: { id: 'pro_communicate_monthly' } },
      loading: false,
      error: null,
    });
    const { getByTestId, queryByTestId } = render(
      <CallModeLimitReachedModal isVisible={true} onClose={mockOnClose} />
    );
    expect(getByTestId('mock-upgrade-communicate-modal')).toBeTruthy();
    expect(queryByTestId('mock-upgrade-pro-modal')).toBeNull();
  });

  it('should render UpgradeCommunicateCallLimitModal for a COMMUNICATE plan user (case-insensitive) when visible', () => {
    mockUseUserSubscription.mockReturnValueOnce({
      subscriptionInfo: { plan: { id: 'MyCommunicatePlan' } },
      loading: false,
      error: null,
    });
    const { getByTestId } = render(
      <CallModeLimitReachedModal isVisible={true} onClose={mockOnClose} />
    );
    expect(getByTestId('mock-upgrade-communicate-modal')).toBeTruthy();
  });

  it('should render null and log warning for an unexpected plan ID when visible', () => {
    const consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockUseUserSubscription.mockReturnValueOnce({
      subscriptionInfo: { plan: { id: 'unlimited_annual' } },
      loading: false,
      error: null,
    });
    const { queryByTestId } = render(
      <CallModeLimitReachedModal isVisible={true} onClose={mockOnClose} />
    );
    expect(queryByTestId('mock-upgrade-pro-modal')).toBeNull();
    expect(queryByTestId('mock-upgrade-communicate-modal')).toBeNull();
    expect(consoleWarnMock).toHaveBeenCalledWith(
      'CallModeLimitReachedModal shown for unexpected plan: unlimited_annual'
    );
    consoleWarnMock.mockRestore();
  });

  it('should not render any modal when isVisible is false', () => {
    mockUseUserSubscription.mockReturnValueOnce({
      subscriptionInfo: { plan: { id: 'free' } }, // Any valid plan
      loading: false,
      error: null,
    });
    const { queryByTestId } = render(
      <CallModeLimitReachedModal isVisible={false} onClose={mockOnClose} />
    );
    expect(queryByTestId('mock-upgrade-pro-modal')).toBeNull();
    expect(queryByTestId('mock-upgrade-communicate-modal')).toBeNull();
  });

  it('should pass down the onClose prop to UpgradeProModal and ensure it calls the original onClose', () => {
    mockUseUserSubscription.mockReturnValueOnce({
      subscriptionInfo: { plan: { id: 'free' } },
      loading: false,
      error: null,
    });
    const { getByTestId } = render(
      <CallModeLimitReachedModal isVisible={true} onClose={mockOnClose} />
    );
    const proModal = getByTestId('mock-upgrade-pro-modal');
    expect(proModal.props.onClose).toEqual(expect.any(Function)); // Check it's a function

    // Simulate the child calling its onClose
    proModal.props.onClose(); 
    expect(mockOnClose).toHaveBeenCalledTimes(1); // Check original mock was called
  });

  it('should pass down the onClose prop to UpgradeCommunicateCallLimitModal and ensure it calls the original onClose', () => {
    mockUseUserSubscription.mockReturnValueOnce({
      subscriptionInfo: { plan: { id: 'communicate_monthly' } },
      loading: false,
      error: null,
    });
    const { getByTestId } = render(
      <CallModeLimitReachedModal isVisible={true} onClose={mockOnClose} />
    );
    const communicateModal = getByTestId('mock-upgrade-communicate-modal');
    expect(communicateModal.props.onClose).toEqual(expect.any(Function)); // Check it's a function

    // Simulate the child calling its onClose
    communicateModal.props.onClose();
    expect(mockOnClose).toHaveBeenCalledTimes(1); // Check original mock was called
  });

   it('should render null if subscriptionInfo is null (e.g., user not logged in or error state not caught by `error` prop)', () => {
    mockUseUserSubscription.mockReturnValueOnce({
      subscriptionInfo: null, // Explicitly null, not just loading/error
      loading: false,
      error: null,
    });
    const consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { queryByTestId } = render(
      <CallModeLimitReachedModal isVisible={true} onClose={mockOnClose} />
    );
    expect(queryByTestId('mock-upgrade-pro-modal')).toBeNull();
    expect(queryByTestId('mock-upgrade-communicate-modal')).toBeNull();
    // It will try to access planId of null, which becomes undefined.
    // The console.warn for unexpected plan will be hit with 'undefined'
    expect(consoleWarnMock).toHaveBeenCalledWith(
      'CallModeLimitReachedModal shown for unexpected plan: undefined'
    );
    consoleWarnMock.mockRestore();
  });
}); 
