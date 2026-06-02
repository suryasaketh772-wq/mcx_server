import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

export interface TickData {
  subscriptionMode: number;
  exchangeType: number;
  exchange: string;
  token: string;
  tradingSymbol?: string;
  lastTradedPrice: number;
  lastTradedQty?: number;
  avgTradedPrice?: number;
  volume: number;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  closePrice?: number;
  change?: number;
  changePercent?: number;
  timestamp: string;
  isSimulated?: boolean;
}

export interface LogData {
  id: number;
  timestamp: string;
  type: 'api_req' | 'api_res' | 'ws_event' | 'auth_event' | 'error';
  message: string;
  details?: string | null;
}

export interface SystemStatus {
  smartApiStatus: string;
  loginStatus: string;
  jwtTokenStatus: string;
  wsStatus: string;
  lastApiResponseTime: string | null;
  lastWsMessageTime: string | null;
  reconnectCount: number;
  activeSubscriptions: string[];
  profile: any | null;
  mcxToken?: string;
}

interface WebSocketContextType {
  status: SystemStatus | null;
  ticks: Record<string, TickData>; // key: "exchange:token"
  logs: LogData[];
  connectionState: 'connecting' | 'connected' | 'disconnected';
  subscribe: (exchange: string, token: string, mode?: number) => void;
  unsubscribe: (exchange: string, token: string) => void;
  clearSystemLogs: () => void;
  triggerRefreshStatus: () => void;
  // Alert system additions
  alerts: any[];
  triggeredAlert: any | null;
  setTriggeredAlert: (alert: any | null) => void;
  addAlert: (exchange: string, token: string, symbol: string, criteria: 'ABOVE' | 'BELOW', value: number) => Promise<void>;
  deleteAlert: (id: string) => Promise<void>;
  fetchAlerts: () => Promise<void>;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

// HTML5 Web Audio Synth Notification arpeggio
const playSynthNotification = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    const playNote = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.05); // Attack
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration); // Decay
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(start);
      osc.stop(start + duration);
    };
    
    const now = ctx.currentTime;
    playNote(523.25, now, 0.4);       // C5
    playNote(659.25, now + 0.08, 0.4);  // E5
    playNote(783.99, now + 0.16, 0.5);  // G5
  } catch (e) {
    console.error('Audio synthesis failed', e);
  }
};

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [ticks, setTicks] = useState<Record<string, TickData>>({});
  const [logs, setLogs] = useState<LogData[]>([]);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  
  // Alert system states
  const [alerts, setAlerts] = useState<any[]>([]);
  const [triggeredAlert, setTriggeredAlert] = useState<any | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/alerts');
      const data = await response.json();
      setAlerts(data);
    } catch (e) {
      console.error('Failed to fetch alerts', e);
    }
  };

  const addAlert = async (exchange: string, token: string, symbol: string, criteria: 'ABOVE' | 'BELOW', value: number) => {
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange, token, symbol, criteria, value })
      });
      const data = await response.json();
      if (data.status) {
        await fetchAlerts();
      }
    } catch (e) {
      console.error('Failed to create alert', e);
    }
  };

  const deleteAlert = async (id: string) => {
    try {
      const response = await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.status) {
        await fetchAlerts();
      }
    } catch (e) {
      console.error('Failed to delete alert', e);
    }
  };

  const connect = () => {
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) return;

    setConnectionState('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use relative path for production (Docker/Nginx) or absolute localhost in dev
    const wsUrl = process.env.NODE_ENV === 'production' 
      ? `${protocol}//${window.location.host}/ws`
      : `ws://localhost:5001/ws`;

    console.log(`Connecting to WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionState('connected');
      console.log('Connected to local backend WebSocket proxy');
      fetchAlerts(); // Sync alerts on connect
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, data } = message;

        if (type === 'status') {
          setStatus(data);
        } else if (type === 'logs_init') {
          setLogs(data);
        } else if (type === 'log') {
          setLogs((prev) => {
            const next = [...prev, data];
            return next.slice(-200); // Limit to 200 logs on client
          });
        } else if (type === 'tick') {
          const tick = data as TickData;
          setTicks((prev) => ({
            ...prev,
            [`${tick.exchange}:${tick.token}`]: tick
          }));
        } else if (type === 'alert_triggered') {
          // Play clean audio arpeggio!
          playSynthNotification();
          // Update triggered alert state
          setTriggeredAlert(data);
          // Sync backend alerts
          fetchAlerts();
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    ws.onclose = () => {
      setConnectionState('disconnected');
      console.log('Backend WebSocket connection closed, retrying in 3 seconds...');
      setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket connection error:', err);
    };
  };

  useEffect(() => {
    connect();
    
    // Periodically fetch status via REST just in case
    const statusInterval = setInterval(triggerRefreshStatus, 5000);
    // Periodically sync alerts list to keep frontend in sync
    const alertsInterval = setInterval(fetchAlerts, 5000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(alertsInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const subscribe = (exchange: string, token: string, mode = 2) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'subscribe',
        exchange,
        token,
        mode
      }));
    }
  };

  const unsubscribe = (exchange: string, token: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'unsubscribe',
        exchange,
        token
      }));
    }
  };

  const clearSystemLogs = async () => {
    try {
      await fetch('/api/logs/clear', { method: 'POST' });
      setLogs([]);
    } catch (e) {
      console.error('Failed to clear logs', e);
    }
  };

  const triggerRefreshStatus = async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      setStatus(data);
    } catch (e) {
      // Backend offline
    }
  };

  return (
    <WebSocketContext.Provider value={{
      status,
      ticks,
      logs,
      connectionState,
      subscribe,
      unsubscribe,
      clearSystemLogs,
      triggerRefreshStatus,
      alerts,
      triggeredAlert,
      setTriggeredAlert,
      addAlert,
      deleteAlert,
      fetchAlerts
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};
