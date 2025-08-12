import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { ActionCable, Cable } from '@kesha-antonov/react-native-action-cable';
import { Platform } from 'react-native';
import { WS_URL } from '@/constants/api';
import { useAuth } from './AuthContext';

type ChannelType = {
  name: string;
  params?: Record<string, any>;
}

interface WebSocketContextType {
  connectWebSocket: (id: number, channel: ChannelType) => void;
  closeWebSocket: (id: number, channelName: string) => void;
  closeAllWebSockets: () => void;
  isConnected: (id: number) => boolean;
  sendMessage: (id: number, message: any) => void;
  onMessage: (id: number, callback: (event: MessageEvent) => void) => void;
  removeMessageListener: (id: number, callback: (event: MessageEvent) => void) => void;
  connectionStatus: Record<number, string>;
  retryCount: Record<number, number>;
  waitForConnection: (chatId: number, timeout?: number) => Promise<boolean>;
}

export const ActionCableContext = createContext<WebSocketContextType | null>(null);

// Initialize ActionCable and Cable once outside the component
let globalActionCable: any = null;
let globalCable: any = null;

export const ActionCableProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<Record<number, string>>({});
  const [retryCount, setRetryCount] = useState<Record<number, number>>({});
  const messageListeners = useRef<{ [key: number]: ((event: MessageEvent) => void)[] }>({});

  useEffect(() => {
    if (!token || globalActionCable) return;

    const wsUrl = Platform.OS === 'ios'
      ? `${WS_URL}?token=${token}`
      : `${encodeURI(WS_URL)}?token=${encodeURIComponent(token || '')}`;
    
    console.log('🔌 Initializing ActionCable with URL:', wsUrl);
    globalActionCable = ActionCable.createConsumer(wsUrl);
    globalCable = new Cable({});
    setIsInitialized(true);

    return () => {
      if (globalActionCable) {
        globalActionCable.disconnect();
        globalActionCable = null;
        globalCable = null;
        setIsInitialized(false);
      }
    };
  }, [token]);

  const waitForInitialization = async (timeout = 5000): Promise<boolean> => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (isInitialized && globalActionCable && globalCable) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  };

  const connectWebSocket = async (id: number, channel: ChannelType) => {
    console.log('📡 Attempting to connect websocket:', { id, channel });
    closeWebSocket(id, channel.name);

    const isReady = await waitForInitialization();
    if (!isReady) {
      console.error('⚠️ ActionCable failed to initialize');
      setConnectionStatus(prev => ({ ...prev, [id]: 'error' }));
      return;
    }

    try {
      const channelName = `chat_${id}`;
      const subscription = globalActionCable.subscriptions.create({
        channel: channel.name,
        ...channel.params
      });

      const cableChannel = globalCable.setChannel(channelName, subscription);

      cableChannel
        .on('received', (data: any) => {
          const listeners = messageListeners.current[id] || [];
          listeners.forEach(listener => listener({ data } as MessageEvent));
        })
        .on('connected', () => {
          setConnectionStatus(prev => ({ ...prev, [id]: 'connected' }));
          setRetryCount(prev => ({ ...prev, [id]: 0 }));
        })
        .on('disconnected', () => {
          setConnectionStatus(prev => ({ ...prev, [id]: 'disconnected' }));
        })
        .on('rejected', () => {
          setConnectionStatus(prev => ({ ...prev, [id]: 'error' }));
          setRetryCount(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
        });

    } catch (error) {
      console.error('💥 Error creating subscription:', { id, error });
      setConnectionStatus(prev => ({ ...prev, [id]: 'error' }));
    }
  };

  const closeWebSocket = (id: number, channelName: string) => {
    if (!globalCable) return;
    
    const channel = globalCable.channel(channelName || `chat_${id}`);
    
    if (channel) {
      console.log('🔌 Closing websocket:', { id });
      channel
        .removeAllListeners('received')
        .removeAllListeners('connected')
        .removeAllListeners('disconnected')
        .removeAllListeners('rejected');
      
      channel.unsubscribe();
      delete globalCable.channels[channelName];
      delete messageListeners.current[id];
      setConnectionStatus(prev => ({ ...prev, [id]: 'disconnected' }));
      setRetryCount(prev => ({ ...prev, [id]: 0 }));
    }
  };

  const closeAllWebSockets = () => {
    if (!globalCable || !globalActionCable) return;

    console.log('🔌 Closing all websockets');
    Object.keys(globalCable.channels).forEach(channelName => {
      const id = parseInt(channelName.replace('chat_', ''), 10);
      closeWebSocket(id, channelName);
    });
    globalActionCable.disconnect();
  };

  const isConnected = (id: number) => {
    return !!globalCable?.channel(`chat_${id}`);
  };

  const sendMessage = (id: number, message: any) => {
    const channel = globalCable?.channel(`chat_${id}`);
    if (channel) {
      channel.perform('receive', message);
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

  return (
    <ActionCableContext.Provider value={{
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
    </ActionCableContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(ActionCableContext);
  if (!context) {
    throw new Error('useWebSocket must be used within an ActionCableProvider');
  }
  return context;
};
