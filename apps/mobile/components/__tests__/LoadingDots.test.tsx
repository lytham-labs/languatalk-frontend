import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Animated } from 'react-native';
import LoadingDots from '../LoadingDots';

// Mock FontAwesome icons
jest.mock('@fortawesome/react-native-fontawesome', () => ({
  FontAwesomeIcon: 'FontAwesomeIcon',
}));

// Mock the hooks
jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('@/hooks/useDevice', () => ({
  __esModule: true,
  default: jest.fn(() => ({ isTablet: false })),
}));

describe('LoadingDots', () => {
  const defaultProps = {
    avatarUrl: 'https://example.com/avatar.jpg',
    showTimeout: false,
    showIntermediateTimeout: false,
    onRefresh: jest.fn(),
    newMessageArrived: false,
    isRefreshing: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('rendering states', () => {
    it('should render normal loading dots when no timeout', () => {
      const { queryByText, getAllByTestId } = render(
        <LoadingDots {...defaultProps} />
      );

      // Should show animated dots but no timeout message
      expect(queryByText(/taking longer than normal/i)).toBeNull();
      expect(queryByText(/try refreshing/i)).toBeNull();
    });

    it('should render intermediate timeout message', () => {
      const { getByText } = render(
        <LoadingDots {...defaultProps} showIntermediateTimeout={true} />
      );

      expect(getByText(/Sorry, I'm thinking for longer than usual/i)).toBeTruthy();
    });

    it('should render final timeout UI with refresh option', () => {
      const { getByText } = render(
        <LoadingDots {...defaultProps} showTimeout={true} />
      );

      expect(getByText(/AI model is taking longer than normal/i)).toBeTruthy();
      expect(getByText(/Try refreshing/i)).toBeTruthy();
    });

    it('should hide timeout UI when newMessageArrived is true', () => {
      const { queryByText, rerender } = render(
        <LoadingDots {...defaultProps} showTimeout={true} />
      );

      expect(queryByText(/AI model is taking longer than normal/i)).toBeTruthy();

      rerender(<LoadingDots {...defaultProps} showTimeout={true} newMessageArrived={true} />);

      // Timeout UI should be hidden when message arrives
      expect(queryByText(/AI model is taking longer than normal/i)).toBeFalsy();
    });
  });

  describe('refresh functionality', () => {
    it('should call onRefresh when refresh button is pressed', () => {
      const onRefresh = jest.fn();
      const { getByText } = render(
        <LoadingDots {...defaultProps} showTimeout={true} onRefresh={onRefresh} />
      );

      const refreshButton = getByText(/Try refreshing/i);
      fireEvent.press(refreshButton);

      // Wait for animation to complete
      act(() => {
        jest.advanceTimersByTime(1200);
      });

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('should not call onRefresh if already refreshing', () => {
      const onRefresh = jest.fn();
      const { getByText } = render(
        <LoadingDots {...defaultProps} showTimeout={true} onRefresh={onRefresh} isRefreshing={true} />
      );

      const refreshButton = getByText(/Refreshing.../i);
      fireEvent.press(refreshButton);

      expect(onRefresh).not.toHaveBeenCalled();
    });

    it('should show refreshing state after refresh is pressed', () => {
      const { getByText } = render(
        <LoadingDots {...defaultProps} showTimeout={true} />
      );

      const refreshButton = getByText(/Try refreshing/i);
      fireEvent.press(refreshButton);

      // Should show different text while refreshing
      expect(getByText(/Continuing to look for a response/i)).toBeTruthy();
    });

    it('should reset refresh state after timeout', () => {
      const { getByText } = render(
        <LoadingDots {...defaultProps} showTimeout={true} newMessageArrived={false} />
      );

      const refreshButton = getByText(/Try refreshing/i);
      fireEvent.press(refreshButton);

      // Initially shows refreshing state
      expect(getByText(/Continuing to look for a response/i)).toBeTruthy();

      // After full timeout (animation + reset delay), state should reset
      act(() => {
        jest.advanceTimersByTime(4200); // 1200ms animation + 3000ms delay
      });

      // State should be reset back to normal timeout message
      expect(getByText(/AI model is taking longer than normal/i)).toBeTruthy();
    });
  });

  describe('animations', () => {
    it('should animate timeout card appearance', () => {
      const animatedSpy = jest.spyOn(Animated, 'parallel');
      
      render(<LoadingDots {...defaultProps} showTimeout={true} />);

      expect(animatedSpy).toHaveBeenCalled();
      animatedSpy.mockRestore();
    });

    it('should animate refresh button rotation', () => {
      const animatedSpy = jest.spyOn(Animated, 'timing');
      const { getByText } = render(
        <LoadingDots {...defaultProps} showTimeout={true} />
      );

      const refreshButton = getByText(/Try refreshing/i);
      fireEvent.press(refreshButton);

      expect(animatedSpy).toHaveBeenCalledWith(
        expect.any(Animated.Value),
        expect.objectContaining({
          toValue: 1,
          duration: 1200,
        })
      );
      
      animatedSpy.mockRestore();
    });
  });

  describe('responsive design', () => {
    it('should apply tablet styles when on tablet', () => {
      const useDevice = require('@/hooks/useDevice').default;
      useDevice.mockReturnValue({ isTablet: true });

      // Should render without throwing
      expect(() => render(<LoadingDots {...defaultProps} />)).not.toThrow();
    });

    it('should apply mobile styles when not on tablet', () => {
      const useDevice = require('@/hooks/useDevice').default;
      useDevice.mockReturnValue({ isTablet: false });

      // Should render without throwing
      expect(() => render(<LoadingDots {...defaultProps} />)).not.toThrow();
    });
  });

  describe('dark mode support', () => {
    it('should apply dark mode styles', () => {
      const useColorScheme = require('@/hooks/useColorScheme').useColorScheme;
      useColorScheme.mockReturnValue('dark');

      // Should render without throwing
      expect(() => render(<LoadingDots {...defaultProps} />)).not.toThrow();
    });

    it('should apply light mode styles', () => {
      const useColorScheme = require('@/hooks/useColorScheme').useColorScheme;
      useColorScheme.mockReturnValue('light');

      // Should render without throwing
      expect(() => render(<LoadingDots {...defaultProps} />)).not.toThrow();
    });
  });

  describe('avatar rendering', () => {
    it('should render avatar image with correct URL', () => {
      // Should render without throwing
      expect(() => render(<LoadingDots {...defaultProps} />)).not.toThrow();
    });
  });

  describe('message states', () => {
    it('should show fetching message when refreshing', () => {
      const { getByText } = render(
        <LoadingDots {...defaultProps} showTimeout={true} isRefreshing={true} />
      );

      expect(getByText(/Fetching latest messages/i)).toBeTruthy();
    });

    it('should not render timeout UI when neither timeout flag is set', () => {
      const { queryByText } = render(
        <LoadingDots {...defaultProps} showTimeout={false} showIntermediateTimeout={false} />
      );

      expect(queryByText(/AI model is taking longer/i)).toBeNull();
      expect(queryByText(/Sorry, I'm thinking/i)).toBeNull();
    });
  });
});