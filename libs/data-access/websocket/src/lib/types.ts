export type ChannelType = {
  name: string;
  params?: Record<string, any>;
}

export interface WebSocketContextType {
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

// Platform abstraction interfaces
export interface WebSocketConfig {
  wsUrl: string;
  getAuthToken: () => Promise<string | null>;
  platformAdapter: WebSocketPlatformAdapter;
  networkAdapter?: WebSocketNetworkAdapter;
}

export interface WebSocketPlatformAdapter {
  OS: string;
  encodeURI: (uri: string) => string;
  encodeURIComponent: (component: string) => string;
}

export interface WebSocketNetworkAdapter {
  fetch: () => Promise<{ isConnected: boolean; isInternetReachable?: boolean }>;
  addEventListener?: (listener: (state: any) => void) => () => void;
}

export interface WebSocketState {
  webSockets: { [key: number]: WebSocket };
  messageListeners: { [key: number]: ((event: MessageEvent) => void)[] };
  connectionAttempts: { [key: number]: boolean };
  connectionStatus: Record<number, string>;
  retryCount: Record<number, number>;
  retryTimeouts: { [key: number]: NodeJS.Timeout };
  reconnecting: { [key: number]: boolean };
}