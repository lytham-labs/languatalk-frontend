import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { 
  WebSocketConfig,
  WebSocketPlatformAdapter,
  WebSocketNetworkAdapter
} from '@languatalk-frontend/data-access-websocket';
import { WS_URL } from '@/constants/api';

// Platform adapter for React Native
export const createReactNativeWebSocketPlatformAdapter = (): WebSocketPlatformAdapter => ({
  OS: Platform.OS,
  encodeURI: (uri: string) => encodeURI(uri),
  encodeURIComponent: (component: string) => encodeURIComponent(component),
});

// Network adapter for React Native
export const createReactNativeWebSocketNetworkAdapter = (): WebSocketNetworkAdapter => ({
  fetch: async () => {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected || false,
      isInternetReachable: state.isInternetReachable || undefined
    };
  },
  addEventListener: (listener: (state: any) => void) => {
    const unsubscribe = NetInfo.addEventListener(listener);
    return unsubscribe;
  },
});

// Factory function to create complete WebSocket config for React Native
export const createReactNativeWebSocketConfig = (
  getAuthToken: () => Promise<string | null>
): WebSocketConfig => ({
  wsUrl: WS_URL,
  getAuthToken,
  platformAdapter: createReactNativeWebSocketPlatformAdapter(),
  networkAdapter: createReactNativeWebSocketNetworkAdapter(),
});