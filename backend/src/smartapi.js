const axios = require('axios');
const WebSocket = require('ws');
const { authenticator } = require('otplib');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { config } = require('./config');

// Active session state in memory
let session = {
  jwtToken: '',
  refreshToken: '',
  feedToken: '',
  profile: null,
  ws: null,
  wsConnected: false,
  wsReconnectCount: 0,
  wsLastMessageTime: null,
  apiLastResponseTime: null,
  activeSubscriptions: new Set(), // Set of "exchange:token" strings
  simulatedTicksTimer: null,
  mcxToken: '31181' // Default Multi Commodity Exchange of India Ltd NSE Token
};

// Map exchange codes for parsing binary ticks
const EXCHANGE_MAP = {
  1: 'NSE',
  2: 'NFO',
  3: 'BSE',
  5: 'MCX',
  7: 'NCDEX'
};

const STREAM_EXCHANGE_MAP = {
  'NSE': 1,
  'NFO': 2,
  'BSE': 3,
  'MCX': 5
};

const BASE_URL = 'https://apiconnect.angelone.in';

/**
 * Normalizes and generates 6-digit TOTP from base32 secret
 */
function generateTOTP(secret) {
  if (!secret) return '';
  const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
  return authenticator.generate(cleanSecret);
}

/**
 * Returns current API and WebSocket connectivity status
 */
function getStatus() {
  return {
    smartApiStatus: session.jwtToken ? 'Connected' : 'Disconnected',
    loginStatus: session.jwtToken ? 'Logged In' : 'Logged Out',
    jwtTokenStatus: session.jwtToken ? 'Active' : 'Expired/Inactive',
    wsStatus: session.wsConnected ? 'Connected' : (session.simulatedTicksTimer ? 'Simulated' : 'Disconnected'),
    lastApiResponseTime: session.apiLastResponseTime,
    lastWsMessageTime: session.wsLastMessageTime,
    reconnectCount: session.wsReconnectCount,
    activeSubscriptions: Array.from(session.activeSubscriptions),
    profile: session.profile,
    mcxToken: session.mcxToken
  };
}

/**
 * Performs Login using MPIN and TOTP
 */
async function login(customTotp = '') {
  const apiKey = config.apiKey;
  const clientCode = config.clientCode;
  const password = config.password;
  const totpSecret = config.totpSecret;

  if (!apiKey || !clientCode || !password) {
    const errorMsg = 'Missing credentials. Set API Key, Client Code, and Password first.';
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  let totp = '';
  if (customTotp) {
    totp = customTotp.trim();
    logger.authEvent(`Using dynamic TOTP code submitted from client: ${totp}`);
  } else if (totpSecret) {
    try {
      totp = generateTOTP(totpSecret);
      logger.authEvent(`Generated TOTP for ${clientCode}: ${totp}`);
    } catch (e) {
      const errorMsg = `TOTP Generation failed: ${e.message}. Check your TOTP Secret.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
  } else {
    const errorMsg = 'MFA TOTP Verification Required. Please provide a dynamic 6-digit TOTP code or configure SMART_TOTP_SECRET.';
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  const loginUrl = `${BASE_URL}/rest/auth/angelbroking/user/v1/loginByPassword`;
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-UserType': 'USER',
    'X-SourceID': 'WEB',
    'X-ClientLocalIP': '192.168.1.1',
    'X-ClientPublicIP': '106.193.147.98',
    'X-MACAddress': 'fe80::1%lo0',
    'X-PrivateKey': apiKey
  };
  const payload = {
    clientcode: clientCode,
    password: password,
    totp: totp
  };

  logger.apiReq('Triggering LoginbyPassword Request', { url: loginUrl, headers: { ...headers, 'X-PrivateKey': '***' }, payload: { ...payload, password: '***' } });
  
  const startTime = Date.now();
  try {
    const response = await axios.post(loginUrl, payload, { headers });
    session.apiLastResponseTime = `${Date.now() - startTime}ms`;
    
    logger.apiRes('Login response received', response.data);

    if (response.data && response.data.status === true && response.data.data) {
      session.jwtToken = response.data.data.jwtToken;
      session.refreshToken = response.data.data.refreshToken;
      session.feedToken = response.data.data.feedToken;
      
      logger.authEvent('Login Successful! JWT and Feed tokens acquired.');

      // Automatically fetch profile after successful login
      try {
        await getProfile();
      } catch (err) {
        logger.error('Auto-profile fetch failed', err.message);
      }

      // If we are currently simulating, stop simulator and connect to real WS if desired, 
      // otherwise run connection.
      startWebSocket();

      return response.data;
    } else {
      const errMsg = response.data?.message || 'Invalid username or password';
      logger.error(`Login failed: ${errMsg}`, response.data);
      throw new Error(errMsg);
    }
  } catch (err) {
    session.apiLastResponseTime = `${Date.now() - startTime}ms`;
    const errMsg = err.response?.data?.message || err.message;
    logger.error(`Login API connection error: ${errMsg}`, err.response?.data);
    throw new Error(errMsg);
  }
}

/**
 * Auto refreshes secure JWT session tokens using active Refresh Token
 */
async function refreshSession() {
  if (!session.refreshToken) {
    throw new Error('No refresh token available. Please log in first.');
  }

  const refreshUrl = `${BASE_URL}/rest/auth/angelbroking/jwt/v1/generateTokens`;
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-UserType': 'USER',
    'X-SourceID': 'WEB',
    'X-ClientLocalIP': '192.168.1.1',
    'X-ClientPublicIP': '106.193.147.98',
    'X-MACAddress': 'fe80::1%lo0',
    'X-PrivateKey': config.apiKey,
    'Authorization': `Bearer ${session.jwtToken}`
  };
  const payload = {
    refreshToken: session.refreshToken
  };

  logger.apiReq('Triggering JWT Auto-Refresh Request', { url: refreshUrl });
  const startTime = Date.now();

  try {
    const response = await axios.post(refreshUrl, payload, { headers });
    session.apiLastResponseTime = `${Date.now() - startTime}ms`;
    logger.apiRes('Auto-refresh response received', response.data);

    if (response.data && response.data.status === true && response.data.data) {
      session.jwtToken = response.data.data.jwtToken;
      session.refreshToken = response.data.data.refreshToken;
      session.feedToken = response.data.data.feedToken;
      logger.authEvent('Session tokens successfully refreshed automatically!');
      
      // If WS is active, restart to apply fresh feed token
      if (session.wsConnected) {
        startWebSocket();
      }
      return response.data;
    } else {
      throw new Error(response.data?.message || 'Refresh failed');
    }
  } catch (err) {
    session.apiLastResponseTime = `${Date.now() - startTime}ms`;
    const errMsg = err.response?.data?.message || err.message;
    logger.error(`Session auto-refresh error: ${errMsg}`);
    throw new Error(errMsg);
  }
}

/**
 * Helper to make authenticated Axios requests with auto token refresh retry logic
 */
async function authenticatedRequest(requestConfig) {
  if (!session.jwtToken) {
    throw new Error('Not logged in. Authenticate first.');
  }

  const execute = async (token) => {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': '192.168.1.1',
      'X-ClientPublicIP': '106.193.147.98',
      'X-MACAddress': 'fe80::1%lo0',
      'X-PrivateKey': config.apiKey,
      'Authorization': `Bearer ${token}`
    };
    
    const axiosConfig = {
      ...requestConfig,
      headers: { ...headers, ...requestConfig.headers }
    };
    
    return axios(axiosConfig);
  };

  try {
    const response = await execute(session.jwtToken);
    
    // Check if Angel One returned an auth error in a 200 OK wrapper (very common in SmartAPI)
    if (response.data && response.data.status === false && (response.data.errorcode === 'AG8001' || response.data.message?.toLowerCase().includes('invalid token'))) {
      logger.wsEvent('Detecting expired token in 200 OK (AG8001). Triggering Auto-Refresh...');
      await refreshSession();
      logger.wsEvent('Retrying request with fresh JWT...');
      return execute(session.jwtToken);
    }
    
    return response;
  } catch (err) {
    // Catch standard 401 HTTP errors
    if (err.response?.status === 401 || err.response?.data?.errorcode === 'AG8001') {
      logger.wsEvent('Axios 401 received. Triggering Auto-Refresh...');
      await refreshSession();
      logger.wsEvent('Retrying request with fresh JWT after 401...');
      return execute(session.jwtToken);
    }
    throw err;
  }
}

/**
 * Fetches user profile details
 */
async function getProfile() {
  logger.apiReq('Fetching profile details via REST');
  const startTime = Date.now();

  try {
    const response = await authenticatedRequest({
      method: 'GET',
      url: `${BASE_URL}/rest/secure/angelbroking/user/v1/getProfile`
    });
    session.apiLastResponseTime = `${Date.now() - startTime}ms`;
    logger.apiRes('Profile response received', response.data);

    if (response.data && response.data.status === true && response.data.data) {
      session.profile = response.data.data;
      return response.data;
    } else {
      throw new Error(response.data?.message || 'Failed to fetch profile');
    }
  } catch (err) {
    session.apiLastResponseTime = `${Date.now() - startTime}ms`;
    const errMsg = err.response?.data?.message || err.message;
    logger.error(`Profile fetch error: ${errMsg}`);
    throw new Error(errMsg);
  }
}

/**
 * Fetches a market quote via REST API
 */
async function getMarketQuote(exchange, token, mode = 'FULL') {
  logger.apiReq(`Fetching Market Quote [${exchange}:${token}] via REST`);
  const startTime = Date.now();

  try {
    const response = await authenticatedRequest({
      method: 'POST',
      url: `${BASE_URL}/rest/secure/angelbroking/market/v1/quote`,
      data: {
        mode: mode,
        exchangeTokens: {
          [exchange]: [token]
        }
      }
    });
    session.apiLastResponseTime = `${Date.now() - startTime}ms`;
    logger.apiRes(`Quote response received for [${exchange}:${token}]`, response.data);
    return response.data;
  } catch (err) {
    session.apiLastResponseTime = `${Date.now() - startTime}ms`;
    const errMsg = err.response?.data?.message || err.message;
    logger.error(`Market quote fetch error: ${errMsg}`);
    throw new Error(errMsg);
  }
}

/**
 * Fetches Historical Candle Data
 */
async function getHistoricalData(exchange, token, interval, fromDate, toDate) {
  logger.apiReq(`Fetching Historical Candles [${exchange}:${token}] via REST`);
  const startTime = Date.now();

  try {
    const response = await authenticatedRequest({
      method: 'POST',
      url: `${BASE_URL}/rest/secure/angelbroking/historical/v1/getCandleData`,
      data: {
        exchange: exchange,
        symboltoken: token,
        interval: interval || 'ONE_MINUTE',
        fromdate: fromDate,
        todate: toDate
      }
    });
    session.apiLastResponseTime = `${Date.now() - startTime}ms`;
    logger.apiRes(`Historical data response received [${exchange}:${token}]`, {
      status: response.data.status,
      count: response.data.data?.length || 0
    });
    return response.data;
  } catch (err) {
    session.apiLastResponseTime = `${Date.now() - startTime}ms`;
    const errMsg = err.response?.data?.message || err.message;
    logger.error(`Historical candles fetch error: ${errMsg}`);
    throw new Error(errMsg);
  }
}

/**
 * Log out
 */
async function logout() {
  if (!session.jwtToken) {
    return { status: true, message: 'Already logged out' };
  }

  const logoutUrl = `${BASE_URL}/rest/secure/angelbroking/user/v1/logout`;
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-UserType': 'USER',
    'X-SourceID': 'WEB',
    'X-PrivateKey': config.apiKey,
    'Authorization': `Bearer ${session.jwtToken}`
  };
  const payload = {
    clientcode: config.clientCode
  };

  logger.apiReq('Triggering Logout API', payload);
  const startTime = Date.now();

  try {
    await axios.post(logoutUrl, payload, { headers });
    session.apiLastResponseTime = `${Date.now() - startTime}ms`;
    logger.authEvent('Logout API call successful. Cleaning session.');
  } catch (err) {
    logger.error('Logout API call encountered error, cleaning locally anyway', err.message);
  } finally {
    session.jwtToken = '';
    session.refreshToken = '';
    session.feedToken = '';
    session.profile = null;
    disconnectWebSocket();
  }

  return { status: true, message: 'Logout Successful' };
}

/**
 * Connects to Angel One WebSocket 2.0 (Smart Stream)
 * or triggers a high-fidelity local simulator if not logged in / offline
 */
function startWebSocket() {
  disconnectWebSocket();

  if (!session.jwtToken || !session.feedToken) {
    logger.wsEvent('No active session. Starting Dynamic Market Ticks Simulator.');
    startSimulator();
    return;
  }

  const wsUrl = 'wss://smartapisocket.angelone.in/smart-stream';
  const headers = {
    'Authorization': `Bearer ${session.jwtToken}`,
    'x-api-key': config.apiKey,
    'x-client-code': config.clientCode,
    'x-feed-token': session.feedToken
  };

  logger.wsEvent(`Connecting to Smart Stream: ${wsUrl}`, {
    Authorization: 'Bearer ey...',
    'x-api-key': config.apiKey.substring(0, 5) + '...',
    'x-client-code': config.clientCode,
    'x-feed-token': '***'
  });

  try {
    session.ws = new WebSocket(wsUrl, { headers });

    session.ws.on('open', () => {
      session.wsConnected = true;
      session.wsReconnectCount = 0;
      session.wsLastMessageTime = new Date().toISOString();
      logger.wsEvent('Smart Stream WebSocket Connection Established!');
      
      // Resubscribe to existing tokens
      resubscribeAll();

      // Start ping heartbeat timer
      session.pingInterval = setInterval(() => {
        if (session.ws && session.ws.readyState === WebSocket.OPEN) {
          session.ws.send('ping');
          logger.wsEvent('Sent Heartbeat PING to Angel One');
        }
      }, 10000);
    });

    session.ws.on('message', (data) => {
      session.wsLastMessageTime = new Date().toISOString();
      
      // Handle pong
      if (data.toString() === 'pong') {
        logger.wsEvent('Received Heartbeat PONG from Angel One');
        return;
      }

      // Parse binary data
      try {
        const parsedTick = parseBinaryTick(data);
        if (parsedTick) {
          broadcastTick(parsedTick);
        }
      } catch (err) {
        logger.error('Failed to parse incoming WebSocket binary frame', err.message);
      }
    });

    session.ws.on('close', (code, reason) => {
      session.wsConnected = false;
      logger.wsEvent(`Smart Stream Connection Closed. Code: ${code}, Reason: ${reason || 'None'}`);
      cleanupWsTimers();
      
      // Auto-reconnect if logged in
      if (session.jwtToken && session.wsReconnectCount < 5) {
        session.wsReconnectCount++;
        const delay = Math.min(2000 * session.wsReconnectCount, 15000);
        logger.wsEvent(`Scheduling auto-reconnect in ${delay}ms (Attempt ${session.wsReconnectCount}/5)`);
        setTimeout(startWebSocket, delay);
      } else if (!session.jwtToken) {
        startSimulator();
      }
    });

    session.ws.on('error', (err) => {
      logger.error('Smart Stream WebSocket Error', err.message);
    });

  } catch (err) {
    logger.error('WebSocket creation exception', err.message);
    startSimulator();
  }
}

/**
 * Parse Binary Feed Frame
 */
function parseBinaryTick(buffer) {
  if (!buffer || buffer.length < 27) return null;

  const view = buffer.buffer 
    ? new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength) 
    : new DataView(buffer);
  
  const subscriptionMode = view.getUint8(0);
  const exchangeType = view.getUint8(1);
  
  // Extract token string (bytes 2-26)
  let token = '';
  for (let i = 2; i < 27; i++) {
    if (i >= buffer.length) break;
    const char = view.getUint8(i);
    if (char === 0) break;
    token += String.fromCharCode(char);
  }

  let tick = {
    subscriptionMode,
    exchangeType,
    exchange: EXCHANGE_MAP[exchangeType] || 'UNKNOWN',
    token,
    timestamp: new Date().toISOString()
  };

  // Parse based on Mode (LTP = 1, Quote = 2, SnapQuote = 3)
  try {
    if (subscriptionMode === 1) {
      if (buffer.length >= 51) {
        const ltpVal = Number(view.getBigInt64(43, true));
        tick.lastTradedPrice = ltpVal / 100;
      } else {
        return null;
      }
    } else if (subscriptionMode === 2 || subscriptionMode === 3) {
      if (buffer.length >= 123) {
        tick.lastTradedPrice = Number(view.getBigInt64(43, true)) / 100;
        tick.lastTradedQty = Number(view.getBigInt64(51, true));
        tick.avgTradedPrice = Number(view.getBigInt64(59, true)) / 100;
        tick.volume = Number(view.getBigInt64(67, true));
        
        // Open, High, Low, Close (present in Quote/Mode 2 & 3)
        tick.openPrice = Number(view.getBigInt64(91, true)) / 100;
        tick.highPrice = Number(view.getBigInt64(99, true)) / 100;
        tick.lowPrice = Number(view.getBigInt64(107, true)) / 100;
        tick.closePrice = Number(view.getBigInt64(115, true)) / 100;
        
        // Calculate Change and Change %
        if (tick.closePrice > 0) {
          tick.change = tick.lastTradedPrice - tick.closePrice;
          tick.changePercent = (tick.change / tick.closePrice) * 100;
        }
      } else {
        return null;
      }
    }
  } catch (err) {
    logger.error('Failed to unpack binary values in parseBinaryTick', err.message);
    return null;
  }

  return tick;
}

/**
 * Clean up active timers
 */
function cleanupWsTimers() {
  if (session.pingInterval) {
    clearInterval(session.pingInterval);
    session.pingInterval = null;
  }
}

/**
 * Disconnects active WebSocket client and stops simulator
 */
function disconnectWebSocket() {
  cleanupWsTimers();
  if (session.ws) {
    try {
      session.ws.removeAllListeners('close');
      session.ws.close();
    } catch (e) {}
    session.ws = null;
  }
  session.wsConnected = false;
  
  if (session.simulatedTicksTimer) {
    clearInterval(session.simulatedTicksTimer);
    session.simulatedTicksTimer = null;
    logger.wsEvent('Market Ticks Simulator Stopped');
  }
}

/**
 * Adds a new token subscription
 */
function subscribe(exchange, token, mode = 1) {
  const subKey = `${exchange}:${token}`;
  session.activeSubscriptions.add(subKey);

  logger.wsEvent(`Subscribed to instrument: ${subKey} (Mode: ${mode})`);

  // Forward to real WS if connected
  if (session.wsConnected && session.ws && session.ws.readyState === WebSocket.OPEN) {
    const exchangeType = STREAM_EXCHANGE_MAP[exchange] || 1;
    const req = {
      action: 1, // Subscribe
      params: {
        mode: mode,
        tokenList: [
          {
            exchangeType: parseInt(exchangeType, 10),
            tokens: [token]
          }
        ]
      }
    };
    session.ws.send(JSON.stringify(req));
  }
}

/**
 * Unsubscribes from a token
 */
function unsubscribe(exchange, token) {
  const subKey = `${exchange}:${token}`;
  session.activeSubscriptions.delete(subKey);

  logger.wsEvent(`Unsubscribed from instrument: ${subKey}`);

  if (session.wsConnected && session.ws && session.ws.readyState === WebSocket.OPEN) {
    const exchangeType = STREAM_EXCHANGE_MAP[exchange] || 1;
    const req = {
      action: 0, // Unsubscribe
      params: {
        mode: 1,
        tokenList: [
          {
            exchangeType: parseInt(exchangeType, 10),
            tokens: [token]
          }
        ]
      }
    };
    session.ws.send(JSON.stringify(req));
  }
}

/**
 * Resubscribes all active tokens on WS reconnect
 */
function resubscribeAll() {
  if (session.activeSubscriptions.size === 0) return;
  
  logger.wsEvent(`Resubscribing to ${session.activeSubscriptions.size} active instruments...`);
  
  // Group by exchange
  const exchangeGroups = {};
  session.activeSubscriptions.forEach(key => {
    const [exchange, token] = key.split(':');
    if (!exchangeGroups[exchange]) exchangeGroups[exchange] = [];
    exchangeGroups[exchange].push(token);
  });

  if (session.ws && session.ws.readyState === WebSocket.OPEN) {
    const tokenList = Object.keys(exchangeGroups).map(exchange => {
      const exchangeType = STREAM_EXCHANGE_MAP[exchange] || 1;
      return {
        exchangeType: parseInt(exchangeType, 10),
        tokens: exchangeGroups[exchange]
      };
    });

    const req = {
      action: 1, // Subscribe
      params: {
        mode: 2, // Use Quote mode to get full details
        tokenList: tokenList
      }
    };
    session.ws.send(JSON.stringify(req));
  }
}

// Global hook to attach client broadcast handler
let broadcastHandler = () => {};
function onTickBroadcast(callback) {
  broadcastHandler = callback;
}

function broadcastTick(tick) {
  // Pass to logger as a light logging entry (only for major/filtered events to prevent spamming log viewer)
  if (Math.random() < 0.1 || tick.exchange === 'MCX') {
    logger.wsEvent(`Tick streamed: ${tick.exchange}:${tick.token} -> LTP: ₹${tick.lastTradedPrice}`);
  }
  broadcastHandler(tick);
}

/**
 * HIGH-FIDELITY SIMULATOR
 * Generates realistic price feeds for subscribed tokens (especially NSE MCX Stock)
 */
const mockInstrumentData = {
  'NSE:31181': { name: 'MCX-EQ', price: 2984.00, close: 2975.00, volume: 541032, step: 1.5 },
  'NSE:3045': { name: 'SBIN-EQ', price: 830.45, close: 825.10, volume: 1543029, step: 0.15 },
  'NSE:3456': { name: 'RELIANCE-EQ', price: 2940.10, close: 2955.00, volume: 843022, step: 0.50 },
  'NSE:11536': { name: 'TCS-EQ', price: 3850.35, close: 3810.00, volume: 231456, step: 0.85 },
  'NSE:1333': { name: 'HDFCBANK-EQ', price: 1520.40, close: 1530.15, volume: 3241050, step: 0.30 }
};

/**
 * Dynamic Scrip Master Discoverer to find MCX stock token on NSE
 */
async function findMcxInstrument() {
  const scripsPath = path.resolve(__dirname, 'OpenAPIScripMaster.json');
  let scripsList = [];

  logger.apiReq('Starting MCX Stock Instrument Discovery...');

  try {
    if (fs.existsSync(scripsPath)) {
      logger.wsEvent('Reading cached Scrip Master list from local disk...');
      const rawData = fs.readFileSync(scripsPath, 'utf8');
      scripsList = JSON.parse(rawData);
    } else {
      logger.wsEvent('Downloading Scrip Master list from Angel One (this might take a few seconds)...');
      const response = await axios.get('https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json');
      scripsList = response.data;
      
      // Cache it
      fs.writeFileSync(scripsPath, JSON.stringify(scripsList), 'utf8');
      logger.wsEvent('Scrip Master list cached to disk successfully.');
    }

    // Lookup "MCX-EQ" or "MCX" in NSE
    const mcxScrip = scripsList.find(s => 
      s.exch_seg === 'NSE' && (s.symbol === 'MCX-EQ' || s.symbol === 'MCX')
    );

    if (mcxScrip) {
      session.mcxToken = mcxScrip.token;
      logger.authEvent(`Successfully discovered NSE MCX stock token: ${mcxScrip.token}`);
      
      // Auto-subscribe to the discovered token
      subscribe('NSE', mcxScrip.token, 2);
      
      return {
        status: true,
        source: 'Scrip Master Discovery',
        data: mcxScrip
      };
    } else {
      throw new Error('MCX symbol not found in Scrip Master list');
    }
  } catch (err) {
    logger.error(`Scrip Master search failed, utilizing fallback: ${err.message}`);
    
    // Fallback standard token
    const fallbackScrip = {
      token: '31181',
      symbol: 'MCX-EQ',
      name: 'Multi Commodity Exchange of India Ltd',
      exch_seg: 'NSE',
      expiry: '',
      lotsize: '1',
      tick_size: '10.000000'
    };
    
    session.mcxToken = fallbackScrip.token;
    subscribe('NSE', fallbackScrip.token, 2);
    
    return {
      status: true,
      source: 'Local Scrip Fallback',
      data: fallbackScrip
    };
  }
}

function startSimulator() {
  if (session.simulatedTicksTimer) return;
  
  logger.wsEvent('Starting Dynamic Market Ticks Simulator (Mock Mode)...');
  
  session.simulatedTicksTimer = setInterval(() => {
    session.wsLastMessageTime = new Date().toISOString();
    
    // Ensure activeSubscriptions contains the active MCX Stock Token
    const activeMcxKey = `NSE:${session.mcxToken}`;
    
    const activeSubs = session.activeSubscriptions.size > 0 
      ? Array.from(session.activeSubscriptions) 
      : [activeMcxKey, 'NSE:3045'];

    activeSubs.forEach(subKey => {
      let mockData = mockInstrumentData[subKey];
      const [exchange, token] = subKey.split(':');

      // Dynamically map active MCX token if it changed
      if (token === session.mcxToken && exchange === 'NSE' && !mockData) {
        mockInstrumentData[subKey] = { name: 'MCX-EQ', price: 2984.00, close: 2975.00, volume: 541032, step: 1.5 };
        mockData = mockInstrumentData[subKey];
      }

      if (!mockData) {
        // Create generic mock on the fly if user added random token
        mockInstrumentData[subKey] = {
          name: `${exchange}_TOKEN_${token}`,
          price: 100 + Math.random() * 900,
          close: 100 + Math.random() * 900,
          volume: Math.floor(Math.random() * 50000),
          step: Math.random() * 2
        };
        mockData = mockInstrumentData[subKey];
      }

      // Generate price fluctuation around ₹2984 for MCX stock
      const changePercent = (Math.random() - 0.495) * 0.15; // Realistic fluctuation
      const changeAmount = mockData.price * (changePercent / 100);
      mockData.price = parseFloat((mockData.price + changeAmount).toFixed(2));
      mockData.volume += Math.floor(Math.random() * 100);

      const change = mockData.price - mockData.close;
      const changePercentVal = (change / mockData.close) * 100;

      const tick = {
        subscriptionMode: 2,
        exchangeType: 1, // NSE is 1
        exchange: exchange,
        token: token,
        tradingSymbol: mockData.name,
        lastTradedPrice: mockData.price,
        lastTradedQty: Math.floor(Math.random() * 50) + 1,
        avgTradedPrice: parseFloat((mockData.price + 0.35).toFixed(2)),
        volume: mockData.volume,
        openPrice: parseFloat((mockData.close * 0.992).toFixed(2)),
        highPrice: parseFloat((Math.max(mockData.price, mockData.close) * 1.008).toFixed(2)),
        lowPrice: parseFloat((Math.min(mockData.price, mockData.close) * 0.990).toFixed(2)),
        closePrice: mockData.close,
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat(changePercentVal.toFixed(2)),
        timestamp: new Date().toISOString(),
        isSimulated: true
      };

      broadcastTick(tick);
    });
  }, 1000); // Ticks every 1 second
}

module.exports = {
  login,
  getProfile,
  getMarketQuote,
  getHistoricalData,
  logout,
  subscribe,
  unsubscribe,
  startWebSocket,
  disconnectWebSocket,
  getStatus,
  onTickBroadcast,
  findMcxInstrument,
  session
};
