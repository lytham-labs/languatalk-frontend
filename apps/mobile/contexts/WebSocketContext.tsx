import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { API_URL, WS_URL } from '@/constants/api';
import { Platform, AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from './AuthContext';

type ChannelType = {
  name: string;
  params?: Record<string, any>;
}

interface WebSocketContextType {
  connectWebSocket: (id: number, channel: ChannelType) => void;
  closeWebSocket: (id: number) => void;
  closeAllWebSockets: () => void;
  isConnected: (id: number) => boolean;
  sendMessage: (id: number, message: any) => void;
  onMessage: (id: number, callback: (event: MessageEvent) => void) => void;
  removeMessageListener: (id: number, callback: (event: MessageEvent) => void) => void;
  connectionStatus: Record<number, string>;
  retryCount: Record<number, number>;
  waitForConnection: (chatId: number, timeout?: number) => Promise<boolean>;
}

export const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const webSockets = useRef<{ [key: number]: WebSocket }>({});
  const messageListeners = useRef<{ [key: number]: ((event: MessageEvent) => void)[] }>({});
  const [connectionAttempts, setConnectionAttempts] = useState<{ [key: number]: boolean }>({});
  const [connectionStatus, setConnectionStatus] = useState<Record<number, string>>({});
  const [retryCount, setRetryCount] = useState<Record<number, number>>({});
  const retryTimeouts = useRef<{ [key: number]: NodeJS.Timeout }>({});
  const reconnecting = useRef<{ [key: number]: boolean }>({});

  const MAX_RETRY_ATTEMPTS = 3;
  const RETRY_DELAY = 1000; // 1 second between retries

  const attemptConnection = async (id: number, channel: ChannelType, isReconnect: boolean = false) => {
    if (isReconnect) {
      reconnecting.current[id] = true;
    }
    
    // Check network connectivity
    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected || !networkState.isInternetReachable) {
      setConnectionStatus(prev => ({ ...prev, [id]: 'disconnected' }));
      console.log('No network connectivity');
      reconnecting.current[id] = false;
      return false;
    }

    const wsUrl = Platform.OS === 'ios'
      ? `${WS_URL}?token=${token}`
      : `${encodeURI(WS_URL)}?token=${encodeURIComponent(token || '')}`;

    const ws = new WebSocket(wsUrl);

    return new Promise<boolean>((resolve) => {
      const timeoutId = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeoutId);
        console.log(`WebSocket connected for ${channel.name} ${id}`);
        
        ws.send(JSON.stringify({
          command: 'subscribe',
          identifier: JSON.stringify({
            channel: channel.name,
            ...channel.params
          })
        }));

        webSockets.current[id] = ws;
        setConnectionAttempts(prev => ({ ...prev, [id]: false }));
        setConnectionStatus(prev => ({ ...prev, [id]: 'connected' }));
        setRetryCount(prev => ({ ...prev, [id]: 0 }));
        resolve(true);
      };

      ws.onclose = () => {
        clearTimeout(timeoutId);
        delete webSockets.current[id];
        setConnectionStatus(prev => ({ ...prev, [id]: 'disconnected' }));
        
        // Attempt to reconnect if this wasn't already a reconnection attempt
        if (!reconnecting.current[id]) {
          console.log(`Attempting to reconnect for chat ${id}`);
          connectWebSocket(id, {
            name: 'ChatChannel',
            params: { chat_id: id }
          });
        }
        
        reconnecting.current[id] = false;
        resolve(false);
      };

      ws.onerror = (error) => {
        clearTimeout(timeoutId);
        console.error(`WebSocket error for ${channel.name} ${id}:`, error);
        resolve(false);
      };

      ws.onmessage = (event) => {
        const listeners = messageListeners.current[id] || [];
        listeners.forEach(listener => listener(event));
      };
    });
  };

  const cleanupAllWebSocketConnections = () => {
    // Cleanup all existing connections
    Object.keys(webSockets.current).forEach((existingId) => {
      const numericId = parseInt(existingId, 10);
      console.log(`Cleaning up existing WebSocket connection for ID ${numericId}`);
      try {
        // Close the existing WebSocket
        webSockets.current[numericId].close(1000, 'Cleanup before new connection');
        delete webSockets.current[numericId];
        delete messageListeners.current[numericId];
        
        // Clear any retry timeouts
        if (retryTimeouts.current[numericId]) {
          clearTimeout(retryTimeouts.current[numericId]);
          delete retryTimeouts.current[numericId];
        }
        
        // Reset connection states for this ID
        setConnectionAttempts(prev => ({ ...prev, [numericId]: false }));
        setConnectionStatus(prev => ({ ...prev, [numericId]: 'disconnected' }));
        setRetryCount(prev => ({ ...prev, [numericId]: 0 }));
        reconnecting.current[numericId] = false;
      } catch (error) {
        console.error(`Error cleaning up WebSocket for ${numericId}:`, error);
      }
    });

    // Clear all refs completely
    webSockets.current = {};
    messageListeners.current = {};
    retryTimeouts.current = {};
    reconnecting.current = {};
  };

  const connectWebSocket = async (id: number, channel: ChannelType) => {
    // First, cleanup ALL existing connections since only one chat can be active
    cleanupAllWebSocketConnections();

    // Now proceed with establishing new connection
    if (connectionAttempts[id]) {
      console.log(`WebSocket connection already attempting to connect for ${channel.name} ${id}`);
      return;
    }

    setConnectionAttempts(prev => ({ ...prev, [id]: true }));
    
    const currentRetryCount = retryCount[id] || 0;
    let success = await attemptConnection(id, channel);
    
    if (!success && currentRetryCount < MAX_RETRY_ATTEMPTS) {
      // Clear any existing retry timeout
      if (retryTimeouts.current[id]) {
        clearTimeout(retryTimeouts.current[id]);
      }

      const retry = async (attempt: number) => {
        console.log(`Retry attempt ${attempt + 1} for ${channel.name} ${id}`);
        setRetryCount(prev => ({ ...prev, [id]: attempt + 1 }));
        
        success = await attemptConnection(id, channel);
        
        if (!success && attempt + 1 < MAX_RETRY_ATTEMPTS) {
          retryTimeouts.current[id] = setTimeout(() => {
            retry(attempt + 1);
          }, RETRY_DELAY);
        } else if (!success) {
          setConnectionAttempts(prev => ({ ...prev, [id]: false }));
          setConnectionStatus(prev => ({ ...prev, [id]: 'error' }));
        }
      };

      retryTimeouts.current[id] = setTimeout(() => {
        retry(currentRetryCount);
      }, RETRY_DELAY);
    }
  };

  const closeWebSocket = (id: number) => {
    // Clear any retry timeouts
    if (retryTimeouts.current[id]) {
      clearTimeout(retryTimeouts.current[id]);
      delete retryTimeouts.current[id];
    }

    const ws = webSockets.current[id];
    if (ws) {
      ws.close(1000, 'Normal closure');
      delete webSockets.current[id];
      delete messageListeners.current[id];
    }
  };

  const closeAllWebSockets = () => {
    Object.keys(webSockets.current).forEach(id => {
      closeWebSocket(Number(id));
    });
  };

  const isConnected = (id: number) => {
    return webSockets.current[id]?.readyState === WebSocket.OPEN;
  };

  const sendMessage = (id: number, message: any) => {
    const ws = webSockets.current[id];
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };

  const onMessage = (id: number, callback: (event: MessageEvent) => void) => {
    if (!messageListeners.current[id]) {
      messageListeners.current[id] = [];
    }
    messageListeners.current[id].push(callback);
  };

  const removeMessageListener = (id: number, callback: (event: MessageEvent) => void) => {
    const listeners = messageListeners.current[id];
    if (listeners) {
      messageListeners.current[id] = listeners.filter(listener => listener !== callback);
    }
  };

  // // Add AppState monitoring
  // useEffect(() => {
  //   const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
  //     if (nextAppState === 'active') {
  //       // Reconnect all existing websockets
  //       Object.keys(webSockets.current).forEach(chatId => {
  //         const numChatId = Number(chatId);
  //         if (!isConnected(numChatId)) {
  //           console.log(`Reconnecting WebSocket for chat ${chatId}`);
  //           connectWebSocket(numChatId, {
  //             name: 'ChatChannel',
  //             params: { chat_id: numChatId }
  //           });
  //         }
  //       });
  //     }
  //   });

  //   return () => {
  //     subscription.remove();
  //   };
  // }, []);

  // Add a waitForConnection helper
  const waitForConnection = async (chatId: number, timeout = 5000): Promise<boolean> => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (isConnected(chatId)) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  };

  // Add network state monitoring
  // useEffect(() => {
  //   const unsubscribe = NetInfo.addEventListener(state => {
  //     if (state.isConnected && state.isInternetReachable) {
  //       // When network is restored, attempt to reconnect all disconnected sockets
  //       Object.keys(connectionStatus).forEach(chatId => {
  //         const numChatId = Number(chatId);
  //         if (connectionStatus[numChatId] === 'disconnected' && !reconnecting.current[numChatId]) {
  //           console.log(`Network restored, reconnecting WebSocket for chat ${chatId}`);
  //           connectWebSocket(numChatId, {
  //             name: 'ChatChannel',
  //             params: { chat_id: numChatId }
  //           });
  //         }
  //       });
  //     }
  //   });

  //   return () => {
  //     unsubscribe();
  //   };
  // }, [connectionStatus]);

  return (
    <WebSocketContext.Provider value={{
      connectWebSocket,
      closeWebSocket,
      closeAllWebSockets,
      isConnected,
      sendMessage,
      onMessage,
      removeMessageListener,
      connectionStatus,
      retryCount,
      waitForConnection,
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}; 
