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

  // For web builds, use PUBLIC_URL environment variable if available
  // This allows customizing the base path at build time
  // Examples:
  //   - GitHub Pages subdirectory: PUBLIC_URL=/tidal/ npm run build
  //   - Custom domain root: PUBLIC_URL=/ npm run build
  //   - Different subdirectory: PUBLIC_URL=/my-app/ npm run build
  if (isWeb && typeof window !== 'undefined') {
    // In CRA/craco builds, PUBLIC_URL is baked into process.env at build time
    const publicUrl = process.env.PUBLIC_URL || '/tidal/';
    // Ensure trailing slash
    return publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`;
  }

  return '/';
};

export const BASE_PATH = getBasePath();
export const IS_WEB = isWeb;

// Helper function to get asset source (works for both web and native)
export const getAssetSource = (assetName) => {
  // Asset mapping for both platforms
  const assetMap = {
    'mic-vocal': 'mic-vocal.png',
    'list-music': 'list-music.png',
    'keyboard-music': 'keyboard-music.png',
    'guitar': 'guitar.png',
    'strudel-icon': 'strudel-icon.png',
    'tidal-logo': 'tidal-logo.svg',
  };

  const fileName = assetMap[assetName];
  if (!fileName) {
    console.warn(`Unknown asset: ${assetName}`);
    return null;
  }

  // For native platforms, use static require() imports
  // Metro bundler needs static require() calls to bundle assets
  if (!isWeb) {
    // Map asset names to their require() calls
    const nativeAssets = {
      'mic-vocal': require('../public/assets/img/mic-vocal.png'),
      'list-music': require('../public/assets/img/list-music.png'),
      'keyboard-music': require('../public/assets/img/keyboard-music.png'),
      'guitar': require('../public/assets/img/guitar.png'),
      'strudel-icon': require('../public/assets/img/strudel-icon.png'),
      'tidal-logo': require('../public/assets/img/tidal-logo.svg'),
    };

    return nativeAssets[assetName] || null;
  }

  // For web, construct URI with base path
  const webPath = `assets/img/${fileName}`;
  return { uri: `${BASE_PATH}${webPath}` };
};

export default {
  BASE_PATH,
  IS_WEB,
  getAssetSource,
};
