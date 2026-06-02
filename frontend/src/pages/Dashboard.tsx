import React from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { NavLink } from 'react-router-dom';
import { 
  ShieldCheck, 
  Activity, 
  Wifi, 
  KeyRound, 
  Clock, 
  ArrowRight,
  UserCheck
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { status } = useWebSocket();

  // Metrics details configuration
  const metrics = [
    {
      label: 'SmartAPI Server',
      value: status?.smartApiStatus || 'Disconnected',
      status: status?.smartApiStatus === 'Connected' ? 'success' : 'danger',
      icon: ShieldCheck,
      details: status?.smartApiStatus === 'Connected' ? 'Authenticated session active' : 'Session connection not established'
    },
    {
      label: 'Login State',
      value: status?.loginStatus || 'Logged Out',
      status: status?.loginStatus === 'Logged In' ? 'success' : 'danger',
      icon: UserCheck,
      details: status?.profile?.name ? `Logged as ${status.profile.name}` : 'MPIN / TOTP verification required'
    },
    {
      label: 'JWT Session Token',
      value: status?.jwtTokenStatus || 'Inactive',
      status: status?.jwtTokenStatus === 'Active' ? 'success' : 'danger',
      icon: KeyRound,
      details: status?.jwtTokenStatus === 'Active' ? 'Headers authorization verified' : 'Tokens not requested'
    },
    {
      label: 'WebSocket Feed',
      value: status?.wsStatus || 'Disconnected',
      status: status?.wsStatus === 'Connected' ? 'success' : (status?.wsStatus === 'Simulated' ? 'warning' : 'danger'),
      icon: Wifi,
      details: status?.wsStatus === 'Connected' ? 'Real-time binary streams active' : (status?.wsStatus === 'Simulated' ? 'Local tick generator running' : 'Feed subscription disconnected')
    },
    {
      label: 'Last API Time',
      value: status?.lastApiResponseTime || '0ms',
      status: 'info',
      icon: Clock,
      details: 'Round-trip duration of recent API request'
    },
    {
      label: 'Last WS Message',
      value: status?.lastWsMessageTime 
        ? new Date(status.lastWsMessageTime).toLocaleTimeString() 
        : 'Never',
      status: 'info',
      icon: Clock,
      details: 'Local timestamp of last incoming frame tick'
    }
  ];

  const getStatusBg = (st: string) => {
    if (st === 'success') return 'bg-brandGreen/10 border-brandGreen/25 text-brandGreen';
    if (st === 'warning') return 'bg-brandOrange/10 border-brandOrange/25 text-brandOrange';
    if (st === 'danger') return 'bg-brandRed/10 border-brandRed/25 text-brandRed';
    return 'bg-brandBlue/10 border-brandBlue/25 text-brandBlue';
  };

  const getStatusDot = (st: string) => {
    if (st === 'success') return 'bg-brandGreen indicator-glow-green';
    if (st === 'warning') return 'bg-brandOrange indicator-glow-orange';
    if (st === 'danger') return 'bg-brandRed indicator-glow-red';
    return 'bg-brandBlue indicator-glow-blue';
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="glass-panel p-8 rounded-3xl relative overflow-hidden flex flex-wrap items-center justify-between gap-6 border border-borderGray/50 shadow-2xl">
        <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 w-[400px] h-[400px] bg-brandBlue/5 rounded-full blur-[100px] -z-10" />
        
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brandBlue/10 border border-brandBlue/20 text-brandBlue text-xs font-mono font-semibold">
            <Activity size={12} className="animate-pulse" />
            <span>SmartAPI Sandbox Sandbox Suite</span>
          </div>
          <h2 className="text-2xl font-bold text-textBright tracking-tight">Angel One SmartAPI Tester Platform</h2>
          <p className="text-xs text-textMuted leading-relaxed">
            Verify REST API responses, test secure dynamic TOTP authentication handshakes, and stream real-time binary market data. Use the settings page to establish active broker credentials securely.
          </p>
        </div>

        <div className="flex gap-4 shrink-0">
          <NavLink
            to="/settings"
            className="flex items-center gap-2 bg-brandBlue hover:bg-brandBlue/90 text-white font-medium text-xs px-5 py-3 rounded-xl transition-trading shadow-lg shadow-brandBlue/20"
          >
            <span>Configure Credentials</span>
            <ArrowRight size={14} />
          </NavLink>
        </div>
      </div>

      {/* Connectivity Health Status Dials Grid */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-textBright uppercase tracking-wider pl-2">Session Monitors</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div 
                key={index} 
                className="glass-panel p-6 rounded-2xl flex flex-col justify-between h-40 border border-borderGray/40 hover:border-borderGray/80 hover:shadow-lg transition-all duration-300 group"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-textMuted uppercase font-bold tracking-wider">{metric.label}</span>
                    <div className="text-lg font-bold text-textBright font-sans group-hover:text-brandBlue transition-colors">
                      {metric.value}
                    </div>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${getStatusBg(metric.status)}`}>
                    <Icon size={20} />
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-borderGray/15 pt-3.5 mt-2 text-[10px] text-textMuted font-mono">
                  <span className={`w-2 h-2 rounded-full animate-pulse-fast ${getStatusDot(metric.status)}`} />
                  <span className="truncate">{metric.details}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Visual Quick Actions & Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sandbox Operations */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <h4 className="text-sm font-semibold text-textBright uppercase tracking-wider">Quick Actions & Sandbox Operations</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <NavLink 
              to="/mcx-share-price"
              className="p-4 rounded-xl bg-darkBg hover:bg-cardHover border border-borderGray/45 flex items-center justify-between group transition-all"
            >
              <div>
                <h5 className="font-semibold text-textBright">MCX Share Price</h5>
                <p className="text-[10px] text-textMuted mt-1">Track NSE MCX Stock live</p>
              </div>
              <ArrowRight size={14} className="text-textMuted group-hover:translate-x-1 transition-transform" />
            </NavLink>

            <NavLink 
              to="/stock-search"
              className="p-4 rounded-xl bg-darkBg hover:bg-cardHover border border-borderGray/45 flex items-center justify-between group transition-all"
            >
              <div>
                <h5 className="font-semibold text-textBright">Multi-Exchange Search</h5>
                <p className="text-[10px] text-textMuted mt-1">Search & stream scrips</p>
              </div>
              <ArrowRight size={14} className="text-textMuted group-hover:translate-x-1 transition-transform" />
            </NavLink>

            <NavLink 
              to="/api-test"
              className="p-4 rounded-xl bg-darkBg hover:bg-cardHover border border-borderGray/45 flex items-center justify-between group transition-all"
            >
              <div>
                <h5 className="font-semibold text-textBright">REST Diagnostic Board</h5>
                <p className="text-[10px] text-textMuted mt-1">Verify profiles & historical data</p>
              </div>
              <ArrowRight size={14} className="text-textMuted group-hover:translate-x-1 transition-transform" />
            </NavLink>

            <NavLink 
              to="/logs"
              className="p-4 rounded-xl bg-darkBg hover:bg-cardHover border border-borderGray/45 flex items-center justify-between group transition-all"
            >
              <div>
                <h5 className="font-semibold text-textBright">Inbound Terminal Logs</h5>
                <p className="text-[10px] text-textMuted mt-1">Debug requests & socket packets</p>
              </div>
              <ArrowRight size={14} className="text-textMuted group-hover:translate-x-1 transition-transform" />
            </NavLink>
          </div>
        </div>

        {/* System Diagnostics Info */}
        <div className="glass-panel p-6 rounded-2xl space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-textBright uppercase tracking-wider">Architecture Details</h4>
            <p className="text-xs text-textMuted leading-relaxed">
              This sandbox isolates all secure network API keys and client passwords in backend environment variables. The server acts as a secure reverse proxy, handling credentials, calculating TOTP tokens, and decapsulating live binary ticks. Raw payloads are decoded into normalized structures, keeping the React frontend simple, fast, and completely safe.
            </p>
          </div>
          
          <div className="p-4 rounded-xl bg-darkBg/50 border border-borderGray/40 text-[10px] font-mono leading-loose text-textMuted mt-4 space-y-1">
            <p>🔧 HOSTING MODE: <strong className="text-brandBlue">Express Secure Reverse Proxy</strong></p>
            <p>📡 WEBSOCKET RELAY: <strong className="text-brandGreen">Node.js ws relay (Port 5001)</strong></p>
            <p>🔒 SECURITY COMPLIANCE: <strong className="text-brandGreen">Full credentials isolation (.env)</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
};
