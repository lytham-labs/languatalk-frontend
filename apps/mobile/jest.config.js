module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?@?react-native|@react-native-community|@react-navigation|@fortawesome/.*|expo-.*|@expo/.*|expo-modules-core|@unimodules/.*|expo/build/.*|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|@sentry/.*|native-base|react-native-svg|@charlescoeder/react-native-kuromoji)'
  ],
  collectCoverage: false,
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    '!components/**/*.d.ts',
    '!components/**/*.test.{ts,tsx}',
    '!components/**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)', '**/*.test.[jt]s?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    'expo-file-system': '<rootDir>/tests/mocks/expo-file-system.js',
    'expo-asset': '<rootDir>/tests/mocks/expo-asset.js',
    '@sentry/react-native': '<rootDir>/node_modules/@sentry/react-native/dist/js/index.js'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  moduleDirectories: ['node_modules', 'src'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  globals: {
    'ts-jest': {
      babelConfig: true,
    },
  },
}; 
