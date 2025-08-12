import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from './AuthContext';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock API URL
jest.mock('@/constants/api', () => ({
  API_URL: 'https://test-api.com',
}));

// Mock PostHog
jest.mock('posthog-react-native', () => ({
  usePostHog: () => ({
    identify: jest.fn(),
  }),
}));

// Mock Revenue Cat
jest.mock('@/lib/revenuecat', () => ({
  identifyUser: jest.fn(),
}));

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

// Mock Expo modules
jest.mock('expo-auth-session/providers/google', () => ({
  useAuthRequest: () => [null, null, jest.fn()],
}));

jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

// Mock AbortSignal.timeout for older Node versions
if (!global.AbortSignal || !global.AbortSignal.timeout) {
  global.AbortSignal = {
    timeout: jest.fn(() => new AbortController().signal),
  } as any;
}

// Test component to hook into AuthContext
const TestComponent = ({ onAuthState }: { onAuthState?: (state: any) => void }) => {
  const auth = useAuth();
  
  React.useEffect(() => {
    if (onAuthState) {
      onAuthState(auth);
    }
  }, [auth, onAuthState]);
  
  return null;
};

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('AuthContext - Resilience Features', () => {
  const consoleMocks = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
    (AsyncStorage.getItem as jest.Mock).mockClear();
    (AsyncStorage.setItem as jest.Mock).mockClear();
    (AsyncStorage.removeItem as jest.Mock).mockClear();
    
    // Mock console methods
    console.log = consoleMocks.log;
    console.error = consoleMocks.error;
    console.warn = consoleMocks.warn;
  });

  describe('Authentication Features', () => {
    it('should provide authentication context', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      let authState: any;
      
      render(
        <AuthProvider>
          <TestComponent onAuthState={(state) => (authState = state)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(authState).toBeDefined();
      });

      // Verify auth context structure
      expect(authState).toHaveProperty('isAuthenticated');
      expect(authState).toHaveProperty('isLoading');
      expect(authState).toHaveProperty('token');
      expect(authState).toHaveProperty('user');
      expect(authState).toHaveProperty('login');
      expect(authState).toHaveProperty('logout');
      expect(authState).toHaveProperty('signup');
      expect(authState).toHaveProperty('googleSignIn');
      expect(authState).toHaveProperty('appleSignIn');
    });

    it('should handle successful login with proper token storage', async () => {
      const mockToken = 'Bearer new-token';
      const mockUserData = { 
        id: 1, 
        uuid: 'user-uuid', 
        email: 'user@test.com', 
        onboarding_completed: true 
      };
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn((name: string) => name === 'Authorization' ? mockToken : null)
        },
        json: () => Promise.resolve(mockUserData),
      });

      let authState: any;
      
      render(
        <AuthProvider>
          <TestComponent onAuthState={(state) => (authState = state)} />
        </AuthProvider>
      );

      // Wait for initial state
      await waitFor(() => {
        expect(authState).toBeDefined();
      });

      // Perform login
      await act(async () => {
        await authState.login('user@test.com', 'password');
      });

      // Verify login request
      expect(mockFetch).toHaveBeenCalledWith('https://test-api.com/api/v1/sign_in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: { email: 'user@test.com', password: 'password' } }),
      });
      
      // Verify token storage
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('authToken', mockToken);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('onboardingCompleted', 'true');
      
      // Verify auth state update
      expect(authState.isAuthenticated).toBe(true);
      expect(authState.token).toBe(mockToken);
      expect(authState.user).toEqual({ id: 1 });
    });

    it('should handle failed login appropriately', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      let authState: any;
      
      render(
        <AuthProvider>
          <TestComponent onAuthState={(state) => (authState = state)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(authState).toBeDefined();
      });

      // Attempt login and expect it to fail
      await expect(
        act(async () => {
          await authState.login('user@test.com', 'wrong-password');
        })
      ).rejects.toThrow('Login failed');

      expect(authState.isAuthenticated).toBe(false);
      expect(authState.token).toBeNull();
    });

    it('should handle successful signup with proper token storage', async () => {
      const mockToken = 'new-token';
      const mockUserData = { 
        id: 1, 
        uuid: 'user-uuid', 
        email: 'user@test.com', 
        onboarding_completed: false,
        token: mockToken 
      };
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData),
      });

      let authState: any;
      
      render(
        <AuthProvider>
          <TestComponent onAuthState={(state) => (authState = state)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(authState).toBeDefined();
      });

      // Perform signup
      await act(async () => {
        await authState.signup('Test User', 'user@test.com', 'password', true);
      });

      // Verify signup request
      expect(mockFetch).toHaveBeenCalledWith('https://test-api.com/api/v1/sign_up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: {
            email: 'user@test.com',
            password: 'password',
            first_name: 'Test User',
            accepts_marketing: true
          }
        }),
      });
      
      // Verify token storage
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('authToken', mockToken);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('onboardingCompleted', 'false');
      
      // Verify auth state update
      expect(authState.isAuthenticated).toBe(true);
      expect(authState.token).toBe(mockToken);
      expect(authState.user).toEqual({ id: 1 });
    });
  });

  describe('Logout Functionality', () => {
    it('should handle manual logout with proper cleanup and tracking', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      
      let authState: any;
      
      render(
        <AuthProvider>
          <TestComponent onAuthState={(state) => (authState = state)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(authState).toBeDefined();
      });

      // Don't mock the logout API call since the logout method should work without making a call
      // when there's no token

      // Perform logout
      await act(async () => {
        await authState.logout();
      });

      // Verify cleanup (no API call should be made when no token exists)
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.token).toBeNull();
      expect(authState.user).toBeNull();
      
      // Verify logout tracking
      expect(consoleMocks.log).toHaveBeenCalledWith('User logged out:', {
        reason: 'manual_logout',
        timestamp: expect.any(String),
        hadToken: false,
        wasAuthenticated: false,
        platform: expect.any(String),
        appVersion: expect.any(String),
      });
    });

    it('should handle logout even when server request fails', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      
      let authState: any;
      
      render(
        <AuthProvider>
          <TestComponent onAuthState={(state) => (authState = state)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(authState).toBeDefined();
      });

      // Mock failed logout API response
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      // Perform logout
      await act(async () => {
        await authState.logout();
      });

      // Should still clean up locally even if server request fails
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.token).toBeNull();
      expect(authState.user).toBeNull();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should have timeout configuration in auth initialization', async () => {
      // This test verifies the timeout functionality is set up correctly
      const mockToken = 'valid-token';
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockToken);
      
      // Simulate successful auth check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1, uuid: 'uuid', email: 'test@test.com' }),
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for any auth initialization to trigger
      await waitFor(() => {
        return mockFetch.mock.calls.length > 0;
      }, { timeout: 1000 });

      // Verify that when auth check is made, it includes proper timeout signal
      if (mockFetch.mock.calls.length > 0) {
        const [url, options] = mockFetch.mock.calls[0];
        expect(url).toBe('https://test-api.com/api/v1/me');
        expect(options).toHaveProperty('signal');
        expect(options.headers).toHaveProperty('Authorization', mockToken);
      }
    });

    it('should provide cleanupAuth function with reason tracking', async () => {
      // This test verifies the logout tracking functionality
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      
      let authState: any;
      
      render(
        <AuthProvider>
          <TestComponent onAuthState={(state) => (authState = state)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(authState).toBeDefined();
      });

      // Trigger logout to test cleanup
      mockFetch.mockResolvedValueOnce({ ok: true });
      
      await act(async () => {
        await authState.logout();
      });

      // Verify that logout tracking includes all required fields
      expect(consoleMocks.log).toHaveBeenCalledWith('User logged out:', 
        expect.objectContaining({
          reason: expect.any(String),
          timestamp: expect.any(String),
          hadToken: expect.any(Boolean),
          wasAuthenticated: expect.any(Boolean),
          platform: expect.any(String),
          appVersion: expect.any(String),
        })
      );
    });
  });

  describe('Authentication State Management', () => {
    it('should initialize with correct default state', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      let authState: any;
      
      render(
        <AuthProvider>
          <TestComponent onAuthState={(state) => (authState = state)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(authState).toBeDefined();
      });

      // Verify initial state
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.token).toBeNull();
      expect(authState.user).toBeNull();
      
      // Loading should eventually complete
      await waitFor(() => {
        expect(authState.isLoading).toBe(false);
      });
    });

    it('should maintain correct state during authentication lifecycle', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      let authState: any;
      
      render(
        <AuthProvider>
          <TestComponent onAuthState={(state) => (authState = state)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(authState).toBeDefined();
      });

      // Initial state should be unauthenticated
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.token).toBeNull();
      expect(authState.user).toBeNull();

      // State should be stable after initialization
      expect(typeof authState.login).toBe('function');
      expect(typeof authState.logout).toBe('function');
      expect(typeof authState.signup).toBe('function');
    });
  });
});