let logBuffer = [];
const MAX_LOGS = 500;
let logId = 1;
const listeners = new Set();

/**
 * Structured logger to record and broadcast events.
 * Types: 'api_req', 'api_res', 'ws_event', 'auth_event', 'error'
 */
function log(type, message, details = null) {
  const newLog = {
    id: logId++,
    timestamp: new Date().toISOString(),
    type,
    message,
    details: details ? (typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details)) : null
  };

  // Add to buffer
  logBuffer.push(newLog);
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift();
  }

  // Print to system console for dev tracking
  const colorMap = {
    api_req: '\x1b[36m',   // Cyan
    api_res: '\x1b[32m',   // Green
    ws_event: '\x1b[35m',  // Magenta
    auth_event: '\x1b[34m',// Blue
    error: '\x1b[31m'      // Red
  };
  const reset = '\x1b[0m';
  const color = colorMap[type] || reset;
  console.log(`${color}[${type.toUpperCase()}] [${newLog.timestamp}] ${message}${reset}`);

  // Broadcast to all active listeners (e.g. WebSocket clients looking at the logs page)
  listeners.forEach(listener => {
    try {
      listener(newLog);
    } catch (e) {
      // Ignore listener errors
    }
  });

  return newLog;
}

function apiReq(message, details = null) { return log('api_req', message, details); }
function apiRes(message, details = null) { return log('api_res', message, details); }
function wsEvent(message, details = null) { return log('ws_event', message, details); }
function authEvent(message, details = null) { return log('auth_event', message, details); }
function error(message, details = null) { return log('error', message, details); }

function getLogs() {
  return logBuffer;
}

function clearLogs() {
  logBuffer = [];
  log('auth_event', 'System log viewer cleared');
  return true;
}

function addListener(callback) {
  listeners.add(callback);
}

function removeListener(callback) {
  listeners.delete(callback);
}

module.exports = {
  log,
  apiReq,
  apiRes,
  wsEvent,
  authEvent,
  error,
  getLogs,
  clearLogs,
  addListener,
  removeListener
};
