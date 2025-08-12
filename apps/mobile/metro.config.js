// Learn more https://docs.expo.io/guides/customizing-metro
// metro.config.js
const { getDefaultConfig } = require('@expo/metro-config');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');

const config = getSentryExpoConfig(__dirname);

// Get the default asset extensions
const defaultAssetExts = config.resolver.assetExts;

config.resolver.extraNodeModules = config.resolver.extraNodeModules || {};
// Add path-browserify polyfill for the 'path' module
config.resolver.extraNodeModules['path'] = require.resolve('path-browserify');

// Add your custom extensions to the default list
config.resolver.assetExts = [
  ...defaultAssetExts,
  'bin', // Add 'bin'
  'dat', // Add 'dat'
  'gz',  // Add 'gz' if you are requiring the .gz files directly
  'dat.gz',
  'idx.gz',
  // Add any other custom asset extensions you might need
];

module.exports = withNativeWind(config, { input: './assets/stylesheets/global.css' })
