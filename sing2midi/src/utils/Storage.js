/**
 * Storage utility for saving and loading session data
 * Uses AsyncStorage for both React Native and web (it has built-in web support)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Logger from './Logger';

const STORAGE_PREFIX = 'sing2midi_';
const SESSIONS_KEY = `${STORAGE_PREFIX}sessions`;
const CURRENT_SESSION_KEY = `${STORAGE_PREFIX}current_session`;
const MAX_SESSIONS = 50; // Maximum number of sessions to store

class Storage {
  /**
   * Save/update the current session (overwrites existing)
   * This is used for auto-save during editing to avoid filling up storage
   * @param {Object} sessionData - Session data to save
   * @returns {Promise<string>} - Session ID
   */
  static async saveCurrentSession(sessionData) {
    try {
      const sessionId = `session_${Date.now()}`;
      const timestamp = new Date().toISOString();

      const session = {
        id: sessionId,
        timestamp,
        ...sessionData,
      };

      // Save as the current session (overwrites previous)
      await AsyncStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
      Logger.log(`Current session saved: ${sessionId}`);
      return sessionId;
    } catch (error) {
      Logger.error('Failed to save current session:', error);
      // If quota exceeded, just overwrite (no history to clear)
      if (error.name === 'QuotaExceededError') {
        Logger.warn('Storage quota exceeded, cannot save session');
      }
      throw error;
    }
  }

  /**
   * Get the current session
   * @returns {Promise<Object|null>} - Current session object or null
   */
  static async getCurrentSession() {
    try {
      const sessionJson = await AsyncStorage.getItem(CURRENT_SESSION_KEY);
      if (!sessionJson) {
        return null;
      }
      return JSON.parse(sessionJson);
    } catch (error) {
      Logger.error('Failed to load current session:', error);
      return null;
    }
  }

  /**
   * Save a session with all its data (adds to history)
   * @param {Object} sessionData - Session data to save
   * @param {Array} sessionData.notes - Array of note objects
   * @param {string} sessionData.tidalCode - TidalCycles pattern code
   * @param {string} sessionData.strudelCode - Strudel JavaScript code
   * @param {string} sessionData.noteNames - Human-readable note names
   * @param {string} sessionData.audioBase64 - Base64-encoded audio data
   * @param {Object} sessionData.graphJson - Visualizer graph data
   * @returns {Promise<string>} - Session ID
   */
  static async saveSession(sessionData) {
    try {
      const sessionId = `session_${Date.now()}`;
      const timestamp = new Date().toISOString();

      const session = {
        id: sessionId,
        timestamp,
        ...sessionData,
      };

      // Get existing sessions
      const sessions = await this.getAllSessions();

      // Add new session at the beginning
      sessions.unshift(session);

      // Limit to MAX_SESSIONS
      const trimmedSessions = sessions.slice(0, MAX_SESSIONS);

      // Save to storage
      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(trimmedSessions));

      Logger.log(`Session saved: ${sessionId}`);
      return sessionId;
    } catch (error) {
      Logger.error('Failed to save session:', error);
      // Check if quota exceeded
      if (error.name === 'QuotaExceededError') {
        Logger.warn('Storage quota exceeded, clearing old sessions...');
        await this.clearOldSessions(10); // Keep only last 10 sessions
        // Retry once
        try {
          const sessions = await this.getAllSessions();
          sessions.unshift({
            id: `session_${Date.now()}`,
            timestamp: new Date().toISOString(),
            ...sessionData,
          });
          await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
          return sessions[0].id;
        } catch (retryError) {
          Logger.error('Failed to save session after clearing:', retryError);
          throw retryError;
        }
      }
      throw error;
    }
  }

  /**
   * Update an existing session in history
   * @param {string} sessionId - Session ID to update
   * @param {Object} sessionData - New session data
   * @returns {Promise<boolean>} - True if updated, false if not found
   */
  static async updateSession(sessionId, sessionData) {
    try {
      const sessions = await this.getAllSessions();
      const index = sessions.findIndex(s => s.id === sessionId);

      if (index === -1) {
        Logger.warn(`Session ${sessionId} not found in history`);
        return false;
      }

      // Update the session while preserving ID and timestamp
      sessions[index] = {
        id: sessionId,
        timestamp: sessions[index].timestamp, // Keep original timestamp
        ...sessionData,
      };

      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
      return true;
    } catch (error) {
      Logger.error('Failed to update session:', error);
      throw error;
    }
  }

  /**
   * Get all saved sessions
   * @returns {Promise<Array>} - Array of session objects
   */
  static async getAllSessions() {
    try {
      const sessionsJson = await AsyncStorage.getItem(SESSIONS_KEY);
      if (!sessionsJson) {
        return [];
      }
      return JSON.parse(sessionsJson);
    } catch (error) {
      Logger.error('Failed to load sessions:', error);
      return [];
    }
  }

  /**
   * Get a specific session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} - Session object or null if not found
   */
  static async getSession(sessionId) {
    const sessions = await this.getAllSessions();
    return sessions.find(s => s.id === sessionId) || null;
  }

  /**
   * Delete a specific session
   * @param {string} sessionId - Session ID to delete
   * @returns {Promise<boolean>} - True if deleted, false if not found
   */
  static async deleteSession(sessionId) {
    try {
      const sessions = await this.getAllSessions();
      const filtered = sessions.filter(s => s.id !== sessionId);

      if (filtered.length === sessions.length) {
        return false; // Session not found
      }

      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered));
      Logger.log(`Session deleted: ${sessionId}`);
      return true;
    } catch (error) {
      Logger.error('Failed to delete session:', error);
      throw error;
    }
  }

  /**
   * Clear old sessions, keeping only the most recent N
   * @param {number} keepCount - Number of sessions to keep
   */
  static async clearOldSessions(keepCount = MAX_SESSIONS) {
    try {
      const sessions = await this.getAllSessions();
      const trimmed = sessions.slice(0, keepCount);
      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(trimmed));
      Logger.log(`Cleared old sessions, keeping ${keepCount} most recent`);
    } catch (error) {
      Logger.error('Failed to clear old sessions:', error);
      throw error;
    }
  }

  /**
   * Clear all saved sessions
   */
  static async clearAllSessions() {
    try {
      await AsyncStorage.removeItem(SESSIONS_KEY);
      Logger.log('All sessions cleared');
    } catch (error) {
      Logger.error('Failed to clear all sessions:', error);
      throw error;
    }
  }

  /**
   * Get storage usage information
   * @returns {Promise<Object>} - Storage info with session count and estimated size
   */
  static async getStorageInfo() {
    const sessions = await this.getAllSessions();
    const dataStr = (await AsyncStorage.getItem(SESSIONS_KEY)) || '';
    const sizeBytes = new Blob([dataStr]).size;
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);

    return {
      sessionCount: sessions.length,
      sizeBytes,
      sizeMB,
      maxSessions: MAX_SESSIONS,
    };
  }

  /**
   * Generic get item from storage
   * @param {string} key - Storage key
   * @returns {Promise<string|null>} - Value or null if not found
   */
  static async getItem(key) {
    try {
      return await AsyncStorage.getItem(`${STORAGE_PREFIX}${key}`);
    } catch (error) {
      Logger.error(`[Storage] Failed to get item ${key}:`, error);
      return null;
    }
  }

  /**
   * Generic set item to storage
   * @param {string} key - Storage key
   * @param {string} value - Value to store
   * @returns {Promise<void>}
   */
  static async setItem(key, value) {
    try {
      await AsyncStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
    } catch (error) {
      Logger.error(`[Storage] Failed to set item ${key}:`, error);
    }
  }
}

export default Storage;
