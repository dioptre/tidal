/**
 * Logger utility for capturing console output to display in Developer tab
 *
 * Configuration:
 * - CAPTURE_FROM_START: Set to true to capture logs from app start, false to only capture after dev mode enabled
 * - MAX_LOGS: Maximum number of log entries to keep in memory
 * - LOG_FILTERS: Array of strings to filter out from logs
 */

// Configuration
const CAPTURE_FROM_START = false; // Change to false to only capture after clicking "by"
const MAX_LOGS = 1000;
const LOG_FILTERS = [
  '[Playhead]',
  'The kernel',
];

// EMERGENCY KILL SWITCH - Set to true to completely disable logger
const LOGGER_DISABLED = true;

class Logger {
  constructor() {
    this.logs = [];
    this.listeners = [];
    this.isCapturing = CAPTURE_FROM_START;
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
    };

    // Monkey-patch console methods
    this.patchConsole();
  }

  patchConsole() {
    // Skip patching if logger is disabled
    if (LOGGER_DISABLED) {
      return;
    }

    const self = this;

    console.log = function (...args) {
      self.capture('log', args);
      self.originalConsole.log.apply(console, args);
    };

    console.error = function (...args) {
      self.capture('error', args);
      self.originalConsole.error.apply(console, args);
    };

    console.warn = function (...args) {
      self.capture('warn', args);
      self.originalConsole.warn.apply(console, args);
    };

    console.info = function (...args) {
      self.capture('info', args);
      self.originalConsole.info.apply(console, args);
    };
  }

  capture(level, args) {
    if (!this.isCapturing || LOGGER_DISABLED) return;

    // Convert args to string
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    // Apply filters
    const shouldFilter = LOG_FILTERS.some(filter => message.includes(filter));
    if (shouldFilter) return;

    // Create log entry
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS
    const logEntry = {
      id: Date.now() + Math.random(), // Unique ID
      timestamp,
      level,
      message,
    };

    // Add to logs array
    this.logs.push(logEntry);

    // Trim to max size
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(-MAX_LOGS);
    }

    // Notify listeners
    this.notifyListeners();
  }

  enableCapture() {
    this.isCapturing = true;
  }

  disableCapture() {
    this.isCapturing = false;
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
    this.notifyListeners();
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  notifyListeners() {
    this.listeners.forEach(callback => callback(this.logs));
  }

  // Add a filter at runtime
  addFilter(filter) {
    if (!LOG_FILTERS.includes(filter)) {
      LOG_FILTERS.push(filter);
    }
  }

  // Remove a filter at runtime
  removeFilter(filter) {
    const index = LOG_FILTERS.indexOf(filter);
    if (index > -1) {
      LOG_FILTERS.splice(index, 1);
    }
  }

  getFilters() {
    return [...LOG_FILTERS];
  }
}

// Create singleton instance
const logger = new Logger();

export default logger;
