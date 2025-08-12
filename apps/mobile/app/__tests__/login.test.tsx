import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Login from '../login';
import { useAuth } from '@/contexts/AuthContext';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/hooks/useDevice', () => ({
  useDevice: () => ({ isTablet: false }),
}));

jest.mock('@/lib/revenuecat', () => ({
  identifyUser: jest.fn(),
}));

const mockRouter = { push: jest.fn() };
const mockAuth = {
  login: jest.fn(),
  signup: jest.fn(),
  googleSignIn: jest.fn(),
  appleSignIn: jest.fn(),
};

describe('Login Screen Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
    (useAuth as jest.Mock).mockReturnValue(mockAuth);
  });

  describe('Error Display Format', () => {
    it('should display user-friendly error with support details for invalid credentials', async () => {
      mockAuth.login.mockRejectedValueOnce(new Error('Invalid email or password'));

      const { getByText, getByPlaceholderText, queryByText } = render(<Login />);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Log In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'wrongpassword');
      fireEvent.press(loginButton);

      await waitFor(() => {
        // Check for user-friendly message
        expect(getByText(/Invalid email or password. Please check for typos/)).toBeTruthy();
        
        // Check for support details
        expect(queryByText(/Error details for support:/)).toBeTruthy();
        expect(queryByText(/Code: invalid_credentials/)).toBeTruthy();
        expect(queryByText(/Time: \d{4}-\d{2}-\d{2}T/)).toBeTruthy();
      });
    });

    it('should display network error with support details', async () => {
      mockAuth.login.mockRejectedValueOnce(new TypeError('Network request failed'));

      const { getByText, getByPlaceholderText, queryByText } = render(<Login />);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Log In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText(/Network error. Please check your connection/)).toBeTruthy();
        expect(queryByText(/Code: network_error/)).toBeTruthy();
      });
    });

    it('should display validation errors for signup', async () => {
      mockAuth.signup.mockRejectedValueOnce(
        new Error('email: Email is already taken; password: Password must be at least 8 characters')
      );

      const { getByText, getByPlaceholderText, queryByText } = render(<Login />);

      // Switch to signup mode
      const signupTab = getByText('Sign Up');
      fireEvent.press(signupTab);

      const nameInput = getByPlaceholderText('Name');
      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Password');
      const signupButton = getByText('Sign Up');

      fireEvent.changeText(nameInput, 'Test User');
      fireEvent.changeText(emailInput, 'existing@example.com');
      fireEvent.changeText(passwordInput, 'short');
      fireEvent.press(signupButton);

      await waitFor(() => {
        expect(getByText(/Validation error: email: Email is already taken/)).toBeTruthy();
        expect(queryByText(/Code: validation_error/)).toBeTruthy();
      });
    });

    it('should display generic error for unknown errors', async () => {
      mockAuth.login.mockRejectedValueOnce(new Error('Something unexpected happened'));

      const { getByText, getByPlaceholderText, queryByText } = render(<Login />);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Log In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('Something unexpected happened')).toBeTruthy();
        expect(queryByText(/Code: unknown_error/)).toBeTruthy();
      });
    });
  });

  describe('Error Message Styling', () => {
    it('should display error with proper styling', async () => {
      mockAuth.login.mockRejectedValueOnce(new Error('Invalid email or password'));

      const { getByText, getByPlaceholderText, getByTestId, UNSAFE_getByType } = render(<Login />);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Log In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'wrongpassword');
      fireEvent.press(loginButton);

      await waitFor(() => {
        // Check that error container is present
        const errorTexts = UNSAFE_getByType('Text').filter(
          node => node.props.children && node.props.children.includes('Invalid email')
        );
        expect(errorTexts.length).toBeGreaterThan(0);
        
        // Check for proper class names (orange text for main error)
        const mainError = errorTexts[0];
        expect(mainError.props.className).toContain('text-orange-600');
        
        // Check for support details with gray text
        const supportTexts = UNSAFE_getByType('Text').filter(
          node => node.props.children && node.props.children.includes('Error details')
        );
        if (supportTexts.length > 0) {
          expect(supportTexts[0].props.className).toContain('text-gray-500');
        }
      });
    });
  });

  describe('Social Login Error Handling', () => {
    it('should display cancelled message for Google sign in cancellation', async () => {
      mockAuth.googleSignIn.mockRejectedValueOnce(new Error('Sign in was cancelled'));

      const { getByText, queryByText } = render(<Login />);

      // Find Google button by text or icon
      const googleButton = getByText(/Continue with Google/i);
      fireEvent.press(googleButton);

      await waitFor(() => {
        expect(queryByText('Sign in was cancelled')).toBeTruthy();
        expect(queryByText(/Code: unknown_error/)).toBeTruthy();
      });
    });

    it('should display network error for Google sign in failure', async () => {
      mockAuth.googleSignIn.mockRejectedValueOnce(new Error('NETWORK_ERROR'));

      const { getByText, queryByText } = render(<Login />);

      const googleButton = getByText(/Continue with Google/i);
      fireEvent.press(googleButton);

      await waitFor(() => {
        expect(queryByText(/Network error/)).toBeTruthy();
        expect(queryByText(/Code: network_error/)).toBeTruthy();
      });
    });
  });

  describe('Error Clearing', () => {
    it('should clear error when switching between login and signup', async () => {
      mockAuth.login.mockRejectedValueOnce(new Error('Invalid email or password'));

      const { getByText, getByPlaceholderText, queryByText } = render(<Login />);

      // Trigger an error
      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Log In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'wrongpassword');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(queryByText(/Invalid email or password/)).toBeTruthy();
      });

      // Switch to signup
      const signupTab = getByText('Sign Up');
      fireEvent.press(signupTab);

      // Error should be cleared
      expect(queryByText(/Invalid email or password/)).toBeFalsy();
    });

    it('should clear error when attempting new authentication', async () => {
      mockAuth.login
        .mockRejectedValueOnce(new Error('Invalid email or password'))
        .mockResolvedValueOnce(undefined);

      const { getByText, getByPlaceholderText, queryByText } = render(<Login />);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Log In');

      // First attempt - error
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'wrongpassword');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(queryByText(/Invalid email or password/)).toBeTruthy();
      });

      // Second attempt - should clear error before trying
      fireEvent.changeText(passwordInput, 'correctpassword');
      fireEvent.press(loginButton);

      // Error should be cleared immediately
      await waitFor(() => {
        expect(queryByText(/Invalid email or password/)).toBeFalsy();
      });
    });
  });

  describe('Field Validation', () => {
    it('should show error for empty fields on login', async () => {
      const { getByText, queryByText } = render(<Login />);

      const loginButton = getByText('Log In');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(queryByText('Please enter both email and password')).toBeTruthy();
      });

      // Should not call login function
      expect(mockAuth.login).not.toHaveBeenCalled();
    });

    it('should show error for empty fields on signup', async () => {
      const { getByText, queryByText } = render(<Login />);

      // Switch to signup
      const signupTab = getByText('Sign Up');
      fireEvent.press(signupTab);

      const signupButton = getByText('Sign Up');
      fireEvent.press(signupButton);

      await waitFor(() => {
        expect(queryByText('Please fill in all fields')).toBeTruthy();
      });

      // Should not call signup function
      expect(mockAuth.signup).not.toHaveBeenCalled();
    });
  });
});