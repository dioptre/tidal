import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import Logger from './Logger';

/**
 * Asset loader for iOS to use bundled files instead of CDN
 * Dramatically speeds up boot time by avoiding network requests
 */
class AssetLoader {
  /**
   * Get the path to a bundled asset
   * @param {string} assetPath - Path relative to Assets folder
   * @returns {Promise<string>} - File path (file:// URL for iOS, HTTP URL for web)
   */
  static async getAssetPath(assetPath) {
    if (Platform.OS === 'ios') {
      // iOS: Use bundled assets from main bundle
      const bundlePath = `${RNFS.MainBundlePath}/Assets/${assetPath}`;

      // Check if file exists
      const exists = await RNFS.exists(bundlePath);
      if (!exists) {
        Logger.warn(`[AssetLoader] Bundled asset not found: ${bundlePath}`);
        Logger.warn('[AssetLoader] Falling back to CDN');
        return null;
      }

      Logger.log(`[AssetLoader] Using bundled asset: ${bundlePath}`);
      // Return file:// URL that TensorFlow.js can load
      return `file://${bundlePath}`;
    } else if (Platform.OS === 'android') {
      // Android: Similar approach, using assets folder
      // TODO: Implement Android asset loading
      Logger.warn('[AssetLoader] Android bundled assets not yet implemented');
      return null;
    } else {
      // Web: Use CDN (browser caches automatically)
      return null;
    }
  }

  /**
   * Get the Basic Pitch model path
   * ONLY for iOS - web uses CDN with browser caching
   * @returns {Promise<string|null>} - Model path or null to use CDN
   */
  static async getBasicPitchModelPath() {
    // Web should always use CDN (browser caches automatically)
    if (Platform.OS === 'web') {
      return null;
    }

    return await this.getAssetPath('basic-pitch-model/model.json');
  }

  /**
   * Copy a bundled asset to the document directory (if needed for processing)
   * @param {string} assetPath - Path relative to Assets folder
   * @param {string} destFilename - Destination filename
   * @returns {Promise<string>} - Path to copied file
   */
  static async copyAssetToDocuments(assetPath, destFilename) {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      throw new Error('copyAssetToDocuments is only supported on iOS and Android');
    }

    const sourcePath = Platform.OS === 'ios'
      ? `${RNFS.MainBundlePath}/Assets/${assetPath}`
      : `${RNFS.MainBundlePath}/${assetPath}`;

    const destPath = `${RNFS.DocumentDirectoryPath}/${destFilename}`;

    // Check if already copied
    const exists = await RNFS.exists(destPath);
    if (exists) {
      Logger.log(`[AssetLoader] Asset already copied: ${destPath}`);
      return destPath;
    }

    // Copy file
    await RNFS.copyFile(sourcePath, destPath);
    Logger.log(`[AssetLoader] Copied asset: ${sourcePath} -> ${destPath}`);
    return destPath;
  }
}

export default AssetLoader;
