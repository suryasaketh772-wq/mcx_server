import React, { useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { Play, Copy, RefreshCw, Terminal, Check } from 'lucide-react';

export const ApiTest: React.FC = () => {
  const { triggerRefreshStatus } = useWebSocket();
  const [activeApi, setActiveApi] = useState<string>('NONE');
  const [loading, setLoading] = useState<boolean>(false);
  const [jsonResponse, setJsonResponse] = useState<any>(null);
  const [responseTime, setResponseTime] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const runTest = async (apiName: string, url: string, options: RequestInit = {}) => {
    setActiveApi(apiName);
    setLoading(true);
    setJsonResponse(null);
    setResponseTime(null);
    setCopied(false);

    const startTime = Date.now();
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      setResponseTime(`${Date.now() - startTime}ms`);
      setJsonResponse(data);
      triggerRefreshStatus(); // Refresh status on state modifications
    } catch (err: any) {
      setResponseTime(`${Date.now() - startTime}ms`);
      setJsonResponse({ error: err.message || 'REST connection failed.' });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!jsonResponse) return;
    navigator.clipboard.writeText(JSON.stringify(jsonResponse, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tests = [
    {
      name: 'Find MCX Instrument',
      description: 'Queries Scrip Master dynamically to discover the unique NSE token for Multi Commodity Exchange Ltd.',
      action: () => runTest('Find MCX Token (POST /api/stocks/find-mcx)', '/api/stocks/find-mcx', { method: 'POST' })
    },
    {
      name: 'Login Session Handshake',
      description: 'Generates dynamic TOTP and logs in using client credentials.',
      action: () => runTest('Login Test (POST /api/login)', '/api/login', { method: 'POST' })
    },
    {
      name: 'Get User Profile',
      description: 'Retrieves account details, client name, and active exchanges.',
      action: () => runTest('Get Profile (GET /api/profile)', '/api/profile')
    },
    {
      name: 'Get REST Market Quote',
      description: 'Fetches standard full quote (SBIN-EQ NSE:3045) via REST API.',
      action: () => runTest('Market Quote Test (POST /api/market-quote)', '/api/market-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange: 'NSE', token: '3045' })
      })
    },
    {
      name: 'Get REST Historical Data',
      description: 'Fetches 1-minute historical OHLC candle arrays for charting.',
      action: () => {
        // Fetch last 2 hours
        const to = new Date();
        const from = new Date(to.getTime() - 2 * 60 * 60 * 1000);
        
        const pad = (n: number) => String(n).padStart(2, '0');
        const formatStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        
        runTest('Historical Data (POST /api/historical-data)', '/api/historical-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exchange: 'NSE',
            token: '3045',
            interval: 'ONE_MINUTE',
            fromdate: formatStr(from),
            todate: formatStr(to)
          })
        });
      }
    },
    {
      name: 'Logout Session Termination',
      description: 'Terminates active session token and clears memory buffer.',
      action: () => runTest('Logout Test (POST /api/logout)', '/api/logout', { method: 'POST' })
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 w-96 h-96 bg-brandBlue/5 rounded-full blur-3xl -z-10" />
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brandBlue/10 flex items-center justify-center text-brandBlue">
            <Terminal size={24} />
          </div>
          <div>
            <h3 className="text-textBright font-semibold text-lg">REST API Testing Sandbox</h3>
            <p className="text-xs text-textMuted mt-1">Execute isolated REST API method handshakes. Verify token states and inspect raw JSON payloads.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Buttons List Panel */}
        <div className="lg:col-span-2 space-y-3.5">
          <h4 className="text-sm font-semibold text-textBright uppercase tracking-wider pl-2">API Operations</h4>
          {tests.map((test, index) => (
            <div 
              key={index} 
              className="glass-panel p-4 rounded-xl flex items-center justify-between gap-4 hover:border-brandBlue/20 transition-all group"
            >
              <div className="space-y-1 max-w-[70%]">
                <h5 className="text-textBright font-semibold text-xs leading-normal">{test.name}</h5>
                <p className="text-[10px] text-textMuted leading-relaxed">{test.description}</p>
              </div>
              <button
                onClick={test.action}
                disabled={loading}
                className="flex items-center gap-1.5 bg-darkBg border border-borderGray hover:bg-brandBlue/10 hover:text-brandBlue disabled:opacity-50 text-textBright px-3.5 py-2 rounded-lg text-xs font-semibold font-mono transition-trading shrink-0 shadow-sm"
              >
                <Play size={12} />
                <span>Run</span>
              </button>
            </div>
          ))}
        </div>

        {/* JSON Display Console */}
        <div className="lg:col-span-3 glass-panel p-6 rounded-2xl flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-4 border-b border-borderGray/40">
            <div className="space-y-1">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-textBright">REST JSON Monitor</h4>
              <p className="text-[10px] text-textMuted font-mono uppercase font-semibold">
                {activeApi === 'NONE' ? 'Idle' : activeApi}
              </p>
            </div>

            {jsonResponse && (
              <div className="flex items-center gap-3">
                {responseTime && (
                  <span className="text-[10px] bg-borderGray px-2 py-0.5 rounded text-textMuted font-mono">
                    RTT: {responseTime}
                  </span>
                )}
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1 text-[10px] bg-brandBlue/15 text-brandBlue hover:bg-brandBlue/20 border border-brandBlue/35 px-2.5 py-1 rounded transition-trading font-sans uppercase font-bold"
                >
                  {copied ? <Check size={10} /> : <Copy size={10} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto font-mono text-[11px] p-4 bg-black/60 rounded-xl mt-4 shadow-inner">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-textMuted font-sans gap-2">
                <RefreshCw className="animate-spin text-brandBlue" size={24} />
                <p>Executing request payload handshake...</p>
              </div>
            ) : jsonResponse ? (
              <pre className="text-emerald-400 overflow-x-auto whitespace-pre-wrap select-text leading-relaxed">
                {JSON.stringify(jsonResponse, null, 2)}
              </pre>
            ) : (
              <div className="h-full flex items-center justify-center text-textMuted font-sans text-center">
                <p>No active API payload transaction loaded.<br />Click a "Run" button on the left to trigger a test.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
