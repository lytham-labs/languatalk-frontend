// Mock expo-modules-core web build
jest.mock('expo-modules-core/build/web', () => ({
  EventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn(),
    removeListener: jest.fn(),
  })),
  NativeModulesProxy: new Proxy({}, {
    get: () => jest.fn(),
  }),
  requireNativeViewManager: jest.fn(),
  requireOptionalNativeModule: jest.fn(),
}));

// Mock expo build files
jest.mock('expo/build/winter', () => ({
  __esModule: true,
  default: {},
}));

// Mock expo-modules-core
jest.mock('expo-modules-core', () => ({
  EventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn(),
    removeListener: jest.fn(),
  })),
  NativeModulesProxy: new Proxy({}, {
    get: () => jest.fn(),
  }),
  requireNativeViewManager: jest.fn(),
  requireOptionalNativeModule: jest.fn(),
  requireNativeModule: jest.fn(() => ({})),
}));

// Mock setImmediate for React Native Animated
global.setImmediate = jest.fn((callback) => setTimeout(callback, 0));

// Mock fetch for Node.js environment
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: {
      get: jest.fn(() => 'mock-header-value'),
    },
  })
);

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
}));

// Mock expo-auth-session
jest.mock('expo-auth-session/providers/google', () => ({
  useAuthRequest: jest.fn(),
  useIdTokenAuthRequest: jest.fn(),
}));

// Mock expo-apple-authentication
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
  getCredentialStateAsync: jest.fn(),
}));

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openBrowserAsync: jest.fn(),
  dismissBrowser: jest.fn(),
  coolDownAsync: jest.fn(),
  warmUpAsync: jest.fn(),
}));

// Mock react-native-purchases
jest.mock('react-native-purchases', () => ({
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    getCustomerInfo: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
  },
  LOG_LEVEL: {
    DEBUG: 'DEBUG',
  },
  PURCHASES_ERROR_CODE: {
    PURCHASE_CANCELLED_ERROR: 'PURCHASE_CANCELLED_ERROR',
  },
}));

// Mock react-native-purchases-ui
jest.mock('react-native-purchases-ui', () => ({
  default: {
    presentPaywall: jest.fn(),
    presentPaywallIfNeeded: jest.fn(),
  },
  presentPaywall: jest.fn(),
  presentPaywallIfNeeded: jest.fn(),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {},
    expoVersion: '1.0.0',
    installationId: 'test-installation-id',
    isDetached: false,
    manifest: {},
    platform: { ios: {}, android: {} },
    systemFonts: [],
  },
}));

// Mock NativeEventEmitter
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');

// Mock react-native
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.NativeEventEmitter = jest.fn().mockImplementation(() => ({
    addListener: jest.fn(),
    removeListener: jest.fn(),
  }));
  return RN;
});

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock react-native/Libraries/Animated/NativeAnimatedHelper
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native/Libraries/Components/View/View');
  return {
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: View,
    Slider: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeViewGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    PanGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    /* Buttons */
    RawButton: View,
    BaseButton: View,
    RectButton: View,
    BorderlessButton: View,
    /* Other */
    FlatList: View,
    gestureHandlerRootHOC: jest.fn(),
    Directions: {},
  };
});

// Silence the warning: Animated: `useNativeDriver` is not supported
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  documentDirectory: 'file:///document/directory/',
  cacheDirectory: 'file:///cache/directory/',
}));

// Mock @sentry/react-native
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setExtra: jest.fn(),
  addBreadcrumb: jest.fn(),
  withProfiler: jest.fn((component) => component),
  Profiler: ({ children }) => children,
  Sentry: {
    ReactNavigationInstrumentation: jest.fn(),
  },
  Severity: {
    Error: 'error',
    Warning: 'warning',
    Info: 'info',
  },
})); 
