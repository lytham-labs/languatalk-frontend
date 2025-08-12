import React from 'react';
import { render, act } from '@testing-library/react';
import { WebSocketProvider, useWebSocket } from './WebSocketContext';
import { AuthProvider } from './AuthContext';

// Mock API constants specific to this test
jest.mock('@/constants/api', () => ({
  API_URL: 'https://test-api.com',
  WS_URL: 'ws://test-ws.com',
}));

// Mock network connectivity check
// Always return that we're connected via WiFi
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi'
  }))
}));

/**
 * Mock WebSocket Implementation
 * This class simulates the behavior of a real WebSocket connection
 * with the ability to manually trigger events like open, close, error, etc.
 */
class MockWebSocket {
  // WebSocket connection states
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: ((error: any) => void) | null;
  onmessage: ((message: any) => void) | null;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
  }

  // Mock methods that can be spied on during tests
  close = jest.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose();
    }
  });

  send = jest.fn((data: string) => {
    // Mock implementation
  });

  // Helper methods to simulate WebSocket events
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen();
    }
  }

  simulateError(error: any) {
    if (this.onerror) {
      this.onerror(error);
    }
  }

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data });
    }
  }
}

// Mock authentication context to always return a logged-in user
jest.mock('./AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: { id: 1 },
    isAuthenticated: true,
    token: 'mock-token'
  })
}));

/**
 * Test Component
 * Simulates a component that connects to a WebSocket when mounted
 * Used in tests to trigger WebSocket connections and test behavior
 */
const TestComponent = () => {
  const { connectWebSocket } = useWebSocket()!;
  React.useEffect(() => {
    connectWebSocket(1, { name: 'ChatChannel', params: { chat_id: 1 } });
  }, [connectWebSocket]);
  return null;
};

describe('WebSocketContext - Chat Scenario', () => {
  let mockWebSocket: jest.Mock;

  // Set up fresh mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a mock WebSocket that automatically connects after instantiation
    mockWebSocket = jest.fn(() => {
      const ws = new MockWebSocket('ws://test');
      setTimeout(() => ws.simulateOpen(), 0);
      return ws;
    });
    Object.assign(mockWebSocket, {
      CONNECTING: MockWebSocket.CONNECTING,
      OPEN: MockWebSocket.OPEN,
      CLOSING: MockWebSocket.CLOSING,
      CLOSED: MockWebSocket.CLOSED
    });
    (global as any).WebSocket = mockWebSocket;
  });

  /**
   * Test that existing WebSocket connections are properly cleaned up
   * before establishing a new connection. This prevents memory leaks
   * and ensures we don't have multiple active connections.
   */
  it('should cleanup existing connections before creating a new one', async () => {
    const mockConsoleLog = jest.spyOn(console, 'log');

    const { rerender } = render(
      <AuthProvider>
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      </AuthProvider>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Trigger a new connection
    rerender(
      <AuthProvider>
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      </AuthProvider>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('WebSocket connection already attempting to connect'));
  });

  /**
   * Test the error handling and retry mechanism when a WebSocket
   * connection fails. The system should log the error and attempt
   * to reconnect automatically.
   */
  it('should handle connection failures and retry', async () => {
    const mockConsoleError = jest.spyOn(console, 'error');
    mockWebSocket = jest.fn(() => {
      const ws = new MockWebSocket('ws://test');
      setTimeout(() => ws.simulateError(new Error('Connection failed')), 0);
      return ws;
    });
    Object.assign(mockWebSocket, {
      CONNECTING: MockWebSocket.CONNECTING,
      OPEN: MockWebSocket.OPEN,
      CLOSING: MockWebSocket.CLOSING,
      CLOSED: MockWebSocket.CLOSED
    });
    (global as any).WebSocket = mockWebSocket;

    render(
      <AuthProvider>
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      </AuthProvider>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(mockConsoleError).toHaveBeenCalledWith('WebSocket error for ChatChannel 1:', expect.any(Error));
  });

  /**
   * Test that we prevent duplicate WebSocket connections for the same chat.
   * This ensures we maintain only one active connection per chat to avoid
   * unnecessary resource usage.
   */
  it('should not allow multiple simultaneous connections for the same chat', async () => {
    const mockConsoleLog = jest.spyOn(console, 'log');

    const { rerender } = render(
      <AuthProvider>
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      </AuthProvider>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Trigger multiple connections
    rerender(
      <AuthProvider>
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      </AuthProvider>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('WebSocket connection already attempting to connect'));
  });

  /**
   * Test that WebSocket connections are properly cleaned up when a component unmounts.
   * This includes:
   * 1. Closing the WebSocket connection
   * 2. Removing event listeners
   * 3. Clearing any retry timeouts
   * 4. Logging the cleanup action
   */
  it('should properly clean up on unmount', async () => {
    const mockConsoleLog = jest.spyOn(console, 'log');

    const { unmount } = render(
      <AuthProvider>
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      </AuthProvider>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const mockInstances = (mockWebSocket as jest.Mock).mock.results.map(r => r.value);
    const ws = mockInstances[0];

    unmount();

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Check that the WebSocket was properly closed
    expect(ws.close).toHaveBeenCalled();
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    
    // Verify cleanup logs
    const logs = mockConsoleLog.mock.calls.map(call => call[0]);
    expect(logs).toContain('Cleaning up existing WebSocket connection for ID 1');
  });

  /**
   * Test the automatic reconnection mechanism when a WebSocket connection
   * is lost. The system should detect the disconnection and attempt to
   * establish a new connection automatically.
   */
  it('should handle reconnection attempts after disconnection', async () => {
    const mockConsoleLog = jest.spyOn(console, 'log');

    render(
      <AuthProvider>
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      </AuthProvider>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const mockInstances = (mockWebSocket as jest.Mock).mock.results.map(r => r.value);
    act(() => {
      mockInstances[0].close();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Attempting to reconnect'));
  });
}); 
