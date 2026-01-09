/**
 * Settings persistence layer
 * Stores user preferences and device capabilities
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceCapabilities from './DeviceCapabilities';
import Logger from './Logger';

const SETTINGS_KEY = 'sing2midi_settings';

class Settings {
  static DEFAULTS = {
    pitchDetectionMethod: 'hybrid', // Will be overridden by auto-detection
    deviceCapabilities: null, // Detected on first run
    settingsVersion: 1, // For future migrations
    lastUpdated: null
  };

  /**
   * Load settings from storage
   * @returns {Promise<Object>} Settings object
   */
  static async loadSettings() {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (!stored) {
        Logger.log('No stored settings found, using defaults');
        return { ...this.DEFAULTS };
      }

      const settings = JSON.parse(stored);
      Logger.log('Loaded settings:', settings);
      return settings;
    } catch (error) {
      Logger.error('Failed to load settings:', error);
      return { ...this.DEFAULTS };
    }
  }

  /**
   * Save settings to storage
   * @param {Object} settings - Settings object
   */
  static async saveSettings(settings) {
    try {
      const settingsWithTimestamp = {
        ...settings,
        lastUpdated: new Date().toISOString()
      };

      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsWithTimestamp));
      Logger.log('Settings saved:', settingsWithTimestamp);
    } catch (error) {
      Logger.error('Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * Initialize settings (auto-detect capabilities and set optimal method)
   * This is called on app startup
   * @returns {Promise<Object>} Initialized settings
   */
  static async initializeSettings() {
    Logger.log('Initializing settings...');

    // Load existing settings
    let settings = await this.loadSettings();

    // If no device capabilities detected yet, detect now
    if (!settings.deviceCapabilities) {
      Logger.log('First run - detecting device capabilities...');
      const capabilities = await DeviceCapabilities.detectCapabilities();

      settings = {
        ...settings,
        deviceCapabilities: capabilities,
        pitchDetectionMethod: capabilities.recommendedMethod
      };

      // Save for next time
      await this.saveSettings(settings);

      Logger.log(`Auto-selected ${capabilities.recommendedMethod}: ${capabilities.reason}`);
    } else {
      Logger.log(`Using existing settings: ${settings.pitchDetectionMethod}`);
    }

    return settings;
  }

  /**
   * Update pitch detection method
   * @param {string} method - New detection method
   */
  static async setPitchDetectionMethod(method) {
    const settings = await this.loadSettings();

    // Validate method against device capabilities
    if (settings.deviceCapabilities) {
      const validation = DeviceCapabilities.validateMethod(method, settings.deviceCapabilities);
      if (!validation.valid) {
        Logger.warn(`Method ${method} not optimal for this device:`, validation.warning);
      }
    }

    settings.pitchDetectionMethod = method;
    await this.saveSettings(settings);
    Logger.log(`Pitch detection method changed to: ${method}`);
  }

  /**
   * Get current pitch detection method
   * @returns {Promise<string>} Current method
   */
  static async getPitchDetectionMethod() {
    const settings = await this.loadSettings();
    return settings.pitchDetectionMethod || 'hybrid';
  }

  /**
   * Re-detect device capabilities
   * Useful if user changed browsers or device settings
   */
  static async redetectCapabilities() {
    Logger.log('Re-detecting device capabilities...');
    const capabilities = await DeviceCapabilities.detectCapabilities();

    const settings = await this.loadSettings();
    settings.deviceCapabilities = capabilities;

    // Suggest new method but don't force it
    if (capabilities.recommendedMethod !== settings.pitchDetectionMethod) {
      Logger.log(`Capabilities changed. Recommended: ${capabilities.recommendedMethod}, Current: ${settings.pitchDetectionMethod}`);
    }

    await this.saveSettings(settings);
    return capabilities;
  }

  /**
   * Reset settings to defaults (will re-detect on next init)
   */
  static async resetSettings() {
    Logger.log('Resetting settings to defaults...');
    await AsyncStorage.removeItem(SETTINGS_KEY);
  }

  /**
   * Get device capabilities from settings
   * @returns {Promise<Object|null>} Device capabilities or null
   */
  static async getDeviceCapabilities() {
    const settings = await this.loadSettings();
    return settings.deviceCapabilities;
  }
}

export default Settings;
