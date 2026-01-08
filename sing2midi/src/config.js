// Configuration for different deployment targets
// This allows the app to work on GitHub Pages, native iOS/Android, and local development

import { Platform } from 'react-native';

// Check if running on web
const isWeb = Platform.OS === 'web';

// Get base path for web deployments
const getBasePath = () => {
  // For native (iOS/Android), use root path
  if (!isWeb) {
    return '/';
  }

  // For web builds, use the Vite base path
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.BASE_URL || '/';
  }

  return '/';
};

export const BASE_PATH = getBasePath();
export const IS_WEB = isWeb;

// Helper function to get asset source (works for both web and native)
export const getAssetSource = (assetName) => {
  // For native platforms, use require() imports
  // Note: When building for native, you'll need to add the require statements back
  // For now, we're optimizing for web deployment
  if (!isWeb) {
    // Native asset loading would go here
    // Example: return require('../public/assets/img/' + assetName + '.png');
    console.warn('Native asset loading not yet implemented');
    return null;
  }

  // For web, construct URI with base path
  const assetMap = {
    'mic-vocal': 'assets/img/mic-vocal.png',
    'list-music': 'assets/img/list-music.png',
    'keyboard-music': 'assets/img/keyboard-music.png',
    'guitar': 'assets/img/guitar.png',
    'strudel-icon': 'assets/img/strudel-icon.png',
    'tidal-logo': 'assets/img/tidal-logo.svg',
  };

  const path = assetMap[assetName];
  if (!path) {
    console.warn(`Unknown asset: ${assetName}`);
    return null;
  }

  // Combine base path with asset path
  return { uri: `${BASE_PATH}${path}` };
};

export default {
  BASE_PATH,
  IS_WEB,
  getAssetSource,
};
