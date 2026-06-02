const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const { config, getMaskedConfig, updateConfig } = require('./config');
const logger = require('./logger');
const smartapi = require('./smartapi');

const app = express();
app.use(cors());
app.use(express.json());

// Global Price Alerts in-memory state
let alerts = [];

// ----------------------------------------------------
// REST API ENDPOINTS
// ----------------------------------------------------

// Get smartapi and system status
app.get('/api/status', (req, res) => {
  res.json(smartapi.getStatus());
});

// Get masked config
app.get('/api/settings', (req, res) => {
  res.json(getMaskedConfig());
});

// Update settings (writes to .env)
app.post('/api/settings', (req, res) => {
  try {
    const masked = updateConfig(req.body);
    logger.authEvent('Configuration credentials updated successfully.');
    res.json({ status: true, data: masked });
  } catch (err) {
    logger.error('Failed to save settings to .env', err.message);
    res.status(500).json({ status: false, error: err.message });
  }
});

// Trigger login flow
app.post('/api/login', async (req, res) => {
  try {
    const { totp } = req.body;
    const result = await smartapi.login(totp);
    res.json(result);
  } catch (err) {
    res.status(401).json({ status: false, error: err.message });
  }
});

// Fetch user profile (proxy)
app.get('/api/profile', async (req, res) => {
  try {
    const result = await smartapi.getProfile();
    res.json(result);
  } catch (err) {
    res.status(400).json({ status: false, error: err.message });
  }
});

// Fetch market quotes (REST proxy) with alert evaluation fallback
app.post('/api/market-quote', async (req, res) => {
  const { exchange, token } = req.body;
  if (!exchange || !token) {
    return res.status(400).json({ status: false, error: 'Exchange and Token are required' });
  }
  try {
    const result = await smartapi.getMarketQuote(exchange, token);
    
    // Evaluate alerts if quote fetch succeeded
    if (result && result.status && result.data && result.data.fetched && result.data.fetched[0]) {
      const quote = result.data.fetched[0];
      const price = quote.ltp;
      
      alerts.forEach(alert => {
        if (alert.active && !alert.triggered && alert.exchange === exchange && alert.token === token) {
          let shouldTrigger = false;
          if (alert.criteria === 'ABOVE' && price >= alert.value) {
            shouldTrigger = true;
          } else if (alert.criteria === 'BELOW' && price <= alert.value) {
            shouldTrigger = true;
          }

          if (shouldTrigger) {
            alert.triggered = true;
            alert.active = false;
            alert.triggeredAt = new Date().toISOString();
            alert.triggeredValue = price;

            logger.authEvent(`Price Alert Triggered (REST): ${alert.exchange}:${alert.symbol} went ${alert.criteria} ${alert.value} (Current: ₹${price})`);

            // Broadcast alert trigger message to all active clients
            const alertMsg = JSON.stringify({
              type: 'alert_triggered',
              data: alert
            });
            wss.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(alertMsg);
              }
            });
          }
        }
      });
    }

    res.json(result);
  } catch (err) {
    res.status(400).json({ status: false, error: err.message });
  }
});

// Fetch historical data (REST proxy)
app.post('/api/historical-data', async (req, res) => {
  const { exchange, token, interval, fromdate, todate } = req.body;
  if (!exchange || !token || !fromdate || !todate) {
    return res.status(400).json({ status: false, error: 'Exchange, Token, FromDate, and ToDate are required' });
  }
  try {
    const result = await smartapi.getHistoricalData(exchange, token, interval, fromdate, todate);
    res.json(result);
  } catch (err) {
    res.status(400).json({ status: false, error: err.message });
  }
});

// Trigger logout
app.post('/api/logout', async (req, res) => {
  try {
    const result = await smartapi.logout();
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: false, error: err.message });
  }
});

// Get rolling system logs
app.get('/api/logs', (req, res) => {
  res.json(logger.getLogs());
});

// Clear system logs
app.post('/api/logs/clear', (req, res) => {
  logger.clearLogs();
  res.json({ status: true, message: 'Logs cleared' });
});

// Price Alerts Endpoints
app.get('/api/alerts', (req, res) => {
  res.json(alerts);
});

app.post('/api/alerts', (req, res) => {
  const { exchange, token, symbol, criteria, value } = req.body;
  if (!exchange || !token || !criteria || !value) {
    return res.status(400).json({ status: false, error: 'Exchange, Token, Criteria, and Value are required' });
  }
  const newAlert = {
    id: Date.now().toString(),
    exchange,
    token,
    symbol: symbol || token,
    criteria, // 'ABOVE' or 'BELOW'
    value: parseFloat(value),
    active: true,
    triggered: false,
    triggeredAt: null,
    triggeredValue: null
  };
  alerts.push(newAlert);
  logger.authEvent(`Price alert created: ${exchange}:${symbol} went ${criteria} ${value}`);
  res.json({ status: true, alert: newAlert });
});

app.delete('/api/alerts/:id', (req, res) => {
  const { id } = req.params;
  alerts = alerts.filter(a => a.id !== id);
  res.json({ status: true, message: 'Alert deleted' });
});

// Find and cache MCX NSE stock instrument
app.post('/api/stocks/find-mcx', async (req, res) => {
  try {
    const result = await smartapi.findMcxInstrument();
    res.json(result);
  } catch (err) {
    logger.error('Find MCX Stock Instrument error', err.message);
    res.status(500).json({ status: false, error: err.message });
  }
});

// Stock Search Scrip master search (returns popular NSE/BSE/MCX instruments)
app.get('/api/stocks/search', (req, res) => {
  const q = (req.query.q || '').toUpperCase();
  
  const popularScrips = [
    { exchange: 'MCX', token: '251394', symbol: 'GOLD26JUNFUT', name: 'MCX GOLD FUTURE', type: 'Commodity' },
    { exchange: 'MCX', token: '251395', symbol: 'CRUDEOIL16JUNFUT', name: 'MCX CRUDE OIL FUTURE', type: 'Commodity' },
    { exchange: 'NSE', token: '3045', symbol: 'SBIN-EQ', name: 'STATE BANK OF INDIA', type: 'Stock' },
    { exchange: 'NSE', token: '3456', symbol: 'RELIANCE-EQ', name: 'RELIANCE INDUSTRIES LTD', type: 'Stock' },
    { exchange: 'NSE', token: '11536', symbol: 'TCS-EQ', name: 'TATA CONSULTANCY SERVICES', type: 'Stock' },
    { exchange: 'NSE', token: '1333', symbol: 'HDFCBANK-EQ', name: 'HDFC BANK LTD', type: 'Stock' },
    { exchange: 'NSE', token: '14366', symbol: 'INFY-EQ', name: 'INFOSYS LTD', type: 'Stock' },
    { exchange: 'BSE', token: '500112', symbol: 'SBIN', name: 'STATE BANK OF INDIA (BSE)', type: 'Stock' },
    { exchange: 'BSE', token: '500325', symbol: 'RELIANCE', name: 'RELIANCE INDUSTRIES LTD (BSE)', type: 'Stock' }
  ];

  if (!q) {
    return res.json(popularScrips);
  }

  const results = popularScrips.filter(scrip => 
    scrip.symbol.includes(q) || 
    scrip.name.includes(q) || 
    scrip.exchange.includes(q)
  );

  res.json(results);
});

// ----------------------------------------------------
// WEB SERVER & WEBSOCKET CORE
// ----------------------------------------------------

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

// Handle HTTP upgrade requests for WebSockets
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Client connection event
wss.on('connection', (ws) => {
  logger.wsEvent('React frontend client connected to local WebSocket proxy.');

  // Send initial session status, configurations and active logs
  ws.send(JSON.stringify({
    type: 'status',
    data: smartapi.getStatus()
  }));

  ws.send(JSON.stringify({
    type: 'logs_init',
    data: logger.getLogs()
  }));

  // Handle incoming commands from frontend
  ws.on('message', (message) => {
    try {
      const payload = JSON.parse(message.toString());
      const { action, exchange, token, mode } = payload;
      
      if (action === 'subscribe') {
        smartapi.subscribe(exchange, token, mode || 2);
      } else if (action === 'unsubscribe') {
        smartapi.unsubscribe(exchange, token);
      } else if (action === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      }
    } catch (err) {
      logger.error('Error handling frontend WS message', err.message);
    }
  });

  ws.on('close', () => {
    logger.wsEvent('React frontend client disconnected from WebSocket proxy.');
  });
});

// Broadcast market data ticks to all connected clients & evaluate alerts
smartapi.onTickBroadcast((tick) => {
  const msg = JSON.stringify({
    type: 'tick',
    data: tick
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });

  // Evaluate active alerts
  alerts.forEach(alert => {
    if (alert.active && !alert.triggered && alert.exchange === tick.exchange && alert.token === tick.token) {
      const price = tick.lastTradedPrice;
      let shouldTrigger = false;
      if (alert.criteria === 'ABOVE' && price >= alert.value) {
        shouldTrigger = true;
      } else if (alert.criteria === 'BELOW' && price <= alert.value) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        alert.triggered = true;
        alert.active = false;
        alert.triggeredAt = new Date().toISOString();
        alert.triggeredValue = price;

        logger.authEvent(`Price Alert Triggered (WS): ${alert.exchange}:${alert.symbol} went ${alert.criteria} ${alert.value} (Current: ₹${price})`);

        // Send alert trigger WS message to all connected clients
        const alertMsg = JSON.stringify({
          type: 'alert_triggered',
          data: alert
        });
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(alertMsg);
          }
        });
      }
    }
  });
});

// Broadcast rolling logger events to all connected clients
logger.addListener((newLog) => {
  const msg = JSON.stringify({
    type: 'log',
    data: newLog
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
});

// Start listening
const PORT = config.port;
server.listen(PORT, async () => {
  logger.authEvent(`Angel One SmartAPI Tester Backend running on port ${PORT} in ${config.nodeEnv} mode.`);
  
  // Auto-login on boot if full credentials are set in .env
  if (config.apiKey && config.clientCode && config.password && config.totpSecret) {
    try {
      logger.authEvent('Detecting complete credentials in .env. Triggering automated boot login...');
      await smartapi.login();
    } catch (err) {
      logger.error(`Automated boot login failed: ${err.message}. Starting simulator fallback.`);
      smartapi.startWebSocket();
    }
  } else {
    // Start WebSocket client automatically if configured (will start simulator)
    smartapi.startWebSocket();
  }
});
