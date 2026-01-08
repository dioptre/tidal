/**
 * Storage utility for saving and loading session data
 * Uses localStorage for web environment
 */

const STORAGE_PREFIX = 'sing2midi_';
const SESSIONS_KEY = `${STORAGE_PREFIX}sessions`;
const MAX_SESSIONS = 50; // Maximum number of sessions to store

class Storage {
  /**
   * Save a session with all its data
   * @param {Object} sessionData - Session data to save
   * @param {Array} sessionData.notes - Array of note objects
   * @param {string} sessionData.tidalCode - TidalCycles pattern code
   * @param {string} sessionData.strudelCode - Strudel JavaScript code
   * @param {string} sessionData.noteNames - Human-readable note names
   * @param {string} sessionData.audioBase64 - Base64-encoded audio data
   * @param {Object} sessionData.graphJson - Visualizer graph data
   * @returns {string} - Session ID
   */
  static saveSession(sessionData) {
    try {
      const sessionId = `session_${Date.now()}`;
      const timestamp = new Date().toISOString();

      const session = {
        id: sessionId,
        timestamp,
        ...sessionData,
      };

      // Get existing sessions
      const sessions = this.getAllSessions();

      // Add new session at the beginning
      sessions.unshift(session);

      // Limit to MAX_SESSIONS
      const trimmedSessions = sessions.slice(0, MAX_SESSIONS);

      // Save to localStorage
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(trimmedSessions));

      console.log(`Session saved: ${sessionId}`);
      return sessionId;
    } catch (error) {
      console.error('Failed to save session:', error);
      // Check if quota exceeded
      if (error.name === 'QuotaExceededError') {
        console.warn('Storage quota exceeded, clearing old sessions...');
        this.clearOldSessions(10); // Keep only last 10 sessions
        // Retry once
        try {
          const sessions = this.getAllSessions();
          sessions.unshift({
            id: `session_${Date.now()}`,
            timestamp: new Date().toISOString(),
            ...sessionData,
          });
          localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
          return sessions[0].id;
        } catch (retryError) {
          console.error('Failed to save session after clearing:', retryError);
          throw retryError;
        }
      }
      throw error;
    }
  }

  /**
   * Get all saved sessions
   * @returns {Array} - Array of session objects
   */
  static getAllSessions() {
    try {
      const sessionsJson = localStorage.getItem(SESSIONS_KEY);
      if (!sessionsJson) {
        return [];
      }
      return JSON.parse(sessionsJson);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      return [];
    }
  }

  /**
   * Get a specific session by ID
   * @param {string} sessionId - Session ID
   * @returns {Object|null} - Session object or null if not found
   */
  static getSession(sessionId) {
    const sessions = this.getAllSessions();
    return sessions.find(s => s.id === sessionId) || null;
  }

  /**
   * Delete a specific session
   * @param {string} sessionId - Session ID to delete
   * @returns {boolean} - True if deleted, false if not found
   */
  static deleteSession(sessionId) {
    try {
      const sessions = this.getAllSessions();
      const filtered = sessions.filter(s => s.id !== sessionId);

      if (filtered.length === sessions.length) {
        return false; // Session not found
      }

      localStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered));
      console.log(`Session deleted: ${sessionId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete session:', error);
      throw error;
    }
  }

  /**
   * Clear old sessions, keeping only the most recent N
   * @param {number} keepCount - Number of sessions to keep
   */
  static clearOldSessions(keepCount = MAX_SESSIONS) {
    try {
      const sessions = this.getAllSessions();
      const trimmed = sessions.slice(0, keepCount);
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(trimmed));
      console.log(`Cleared old sessions, keeping ${keepCount} most recent`);
    } catch (error) {
      console.error('Failed to clear old sessions:', error);
      throw error;
    }
  }

  /**
   * Clear all saved sessions
   */
  static clearAllSessions() {
    try {
      localStorage.removeItem(SESSIONS_KEY);
      console.log('All sessions cleared');
    } catch (error) {
      console.error('Failed to clear all sessions:', error);
      throw error;
    }
  }

  /**
   * Get storage usage information
   * @returns {Object} - Storage info with session count and estimated size
   */
  static getStorageInfo() {
    const sessions = this.getAllSessions();
    const dataStr = localStorage.getItem(SESSIONS_KEY) || '';
    const sizeBytes = new Blob([dataStr]).size;
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);

    return {
      sessionCount: sessions.length,
      sizeBytes,
      sizeMB,
      maxSessions: MAX_SESSIONS,
    };
  }
}

export default Storage;
