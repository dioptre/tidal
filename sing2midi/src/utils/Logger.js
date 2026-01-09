/**
 * Logger utility for capturing console output to display in Developer tab
 *
 * Configuration:
 * - CAPTURE_ENABLED: Set to true to enable log capture
 * - MAX_LOGS: Maximum number of log entries to keep in memory
 * - LOG_FILTERS: Array of strings to filter out from logs
 */

// Configuration
const CAPTURE_ENABLED = true; // Master switch for log capture
const MAX_LOGS = 1000;
const LOG_FILTERS = [
  '[Playhead]',
  'The kernel',
];

class Logger {
  constructor() {
    this.logs = []; // Plain array - no React state, no listeners, just raw storage
  }

  log(...args) {
    console.log(...args);
    if (CAPTURE_ENABLED) {
      this.capture('log', args);
    }
  }

  error(...args) {
    console.error(...args);
    if (CAPTURE_ENABLED) {
      this.capture('error', args);
    }
  }

  warn(...args) {
    console.warn(...args);
    if (CAPTURE_ENABLED) {
      this.capture('warn', args);
    }
  }

  info(...args) {
    console.info(...args);
    if (CAPTURE_ENABLED) {
      this.capture('info', args);
    }
  }

  capture(level, args) {
    // Store raw args - we'll stringify only when viewing logs
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS

    // Quick string conversion for filtering only
    const quickString = args.map(arg => String(arg)).join(' ');
    const shouldFilter = LOG_FILTERS.some(filter => quickString.includes(filter));
    if (shouldFilter) return;

    // Store raw entry - stringify later when needed
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp,
      level,
      args, // Store raw args, not stringified
    };

    this.logs.push(logEntry);

    // Trim to max size
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(-MAX_LOGS);
    }
  }

  getLogs() {
    // Stringify on demand when logs are requested
    return this.logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      level: log.level,
      message: log.args.map(arg => {
        if (typeof arg === 'object') {
          try {
            const stringified = JSON.stringify(arg, null, 2);
            return stringified.length > 1000 ? stringified.slice(0, 1000) + '...' : stringified;
          } catch (e) {
            const str = String(arg);
            return str.length > 1000 ? str.slice(0, 1000) + '...' : str;
          }
        }
        const str = String(arg);
        return str.length > 1000 ? str.slice(0, 1000) + '...' : str;
      }).join(' ')
    }));
  }

  clearLogs() {
    this.logs = [];
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
