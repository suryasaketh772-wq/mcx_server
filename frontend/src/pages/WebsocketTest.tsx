import React, { useState, useEffect } from 'react';
import { useWebSocket, TickData } from '../hooks/useWebSocket';
import { Network, Plus, ArrowRight, Zap, RefreshCw, Layers } from 'lucide-react';

export const WebsocketTest: React.FC = () => {
  const { status, ticks, subscribe, unsubscribe } = useWebSocket();
  const [customToken, setCustomToken] = useState('');
  const [customExchange, setCustomExchange] = useState('NSE');
  const [customMode, setCustomMode] = useState('2'); // Mode 2: Quote default

  const [tickStream, setTickStream] = useState<TickData[]>([]);

  // Collect incoming ticks globally in a log stream list for display
  useEffect(() => {
    const activeTicks = Object.values(ticks);
    if (activeTicks.length === 0) return;
    
    // Grab the latest tick from ticks dictionary and push to rolling list
    const latestTick = activeTicks.reduce((latest, current) => {
      return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest;
    });

    setTickStream((prev) => {
      // Avoid duplicating identical tick updates rapidly
      if (prev.length > 0 && prev[0].timestamp === latestTick.timestamp && prev[0].token === latestTick.token) {
        return prev;
      }
      const next = [latestTick, ...prev];
      return next.slice(0, 15); // Show latest 15 packets
    });
  }, [ticks]);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customToken) return;
    subscribe(customExchange, customToken, parseInt(customMode, 10));
    setCustomToken('');
  };

  return (
    <div className="space-y-6">
      {/* Header Diagnostics */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl -z-10" />
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Network size={24} />
            </div>
            <div>
              <h3 className="text-textBright font-semibold text-lg">WebSocket Feed & Subscription Tester</h3>
              <p className="text-xs text-textMuted mt-1">Verify real-time binary packet decoders, subscription correlations, and heartbeat round-trip channels.</p>
            </div>
          </div>
          <div className="flex gap-4 text-xs font-mono">
            <div className="bg-darkBg/60 border border-borderGray px-4 py-2 rounded-xl">
              <p className="text-[10px] text-textMuted uppercase font-semibold">Active Tickers</p>
              <p className="text-textBright font-semibold text-base mt-1">{status?.activeSubscriptions?.length || 0}</p>
            </div>
            <div className="bg-darkBg/60 border border-borderGray px-4 py-2 rounded-xl">
              <p className="text-[10px] text-textMuted uppercase font-semibold">Reconnect Count</p>
              <p className="text-textBright font-semibold text-base mt-1">{status?.reconnectCount || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscriptions Management Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Subscribe Form */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-textBright">
              <Plus size={18} className="text-brandBlue" />
              <h4 className="font-semibold text-sm uppercase tracking-wide">Add Subscription</h4>
            </div>

            <form onSubmit={handleSubscribe} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-textMuted font-semibold uppercase">Exchange</label>
                  <select
                    value={customExchange}
                    onChange={(e) => setCustomExchange(e.target.value)}
                    className="w-full bg-darkBg border border-borderGray rounded-lg px-3 py-2 text-textBright focus:outline-none focus:border-brandBlue"
                  >
                    <option value="NSE">NSE Stocks</option>
                    <option value="BSE">BSE Stocks</option>
                    <option value="MCX">MCX Commodities</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-textMuted font-semibold uppercase">Sub Mode</label>
                  <select
                    value={customMode}
                    onChange={(e) => setCustomMode(e.target.value)}
                    className="w-full bg-darkBg border border-borderGray rounded-lg px-3 py-2 text-textBright focus:outline-none focus:border-brandBlue"
                  >
                    <option value="1">Mode 1: LTP</option>
                    <option value="2">Mode 2: Quote (OHLC)</option>
                    <option value="3">Mode 3: Snap Depth</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-textMuted font-semibold uppercase">Instrument Token</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter Token (e.g. 3045)"
                    value={customToken}
                    onChange={(e) => setCustomToken(e.target.value)}
                    className="flex-1 bg-darkBg border border-borderGray rounded-lg px-3 py-2 text-textBright focus:outline-none focus:border-brandBlue font-mono"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-brandBlue hover:bg-brandBlue/90 text-white p-2 rounded-lg transition-trading"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Subscriptions List */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-textBright">
                <Layers size={18} className="text-brandBlue" />
                <h4 className="font-semibold text-sm uppercase tracking-wide">Subscribed Feeds</h4>
              </div>
              <span className="text-[10px] bg-borderGray px-2 py-0.5 rounded-full text-textMuted font-mono">
                {status?.activeSubscriptions?.length || 0} Total
              </span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {!status?.activeSubscriptions || status.activeSubscriptions.length === 0 ? (
                <p className="text-xs text-textMuted text-center py-6">No active WebSocket feeds subscribed.</p>
              ) : (
                status.activeSubscriptions.map((subKey) => {
                  const [exchange, token] = subKey.split(':');
                  const currentTick = ticks[subKey];
                  return (
                    <div key={subKey} className="flex items-center justify-between p-3 rounded-lg bg-darkBg border border-borderGray/40 text-xs">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-textBright font-semibold font-mono">{token}</span>
                          <span className="text-[9px] bg-borderGray px-1.5 py-0.2 rounded text-textMuted font-mono font-bold uppercase">{exchange}</span>
                        </div>
                        <p className="text-[10px] text-textMuted mt-0.5 truncate max-w-[120px]">
                          {currentTick?.tradingSymbol || 'Connecting...'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-textBright font-mono">
                          {currentTick?.lastTradedPrice ? `₹${currentTick.lastTradedPrice}` : 'Waiting...'}
                        </span>
                        <button
                          onClick={() => unsubscribe(exchange, token)}
                          className="text-brandRed hover:underline text-[10px] uppercase font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Raw Inbound Frame Log */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl flex flex-col h-[500px]">
          <div className="flex items-center justify-between pb-4 border-b border-borderGray/40">
            <div className="flex items-center gap-2 text-textBright">
              <Zap size={18} className="text-brandOrange animate-pulse" />
              <h4 className="font-semibold text-sm uppercase tracking-wide">Live Frame Decoded Buffer</h4>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-textMuted font-mono">
              <RefreshCw className="animate-spin text-brandBlue" size={12} />
              <span>Streaming Ticks</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto font-mono text-[11px] p-4 bg-black/60 rounded-xl mt-4 space-y-3 shadow-inner">
            {tickStream.length === 0 ? (
              <div className="h-full flex items-center justify-center text-textMuted font-sans">
                <p>Awaiting tick stream frames. Subscribe to stocks or check MCX tracker to initiate feeds.</p>
              </div>
            ) : (
              tickStream.map((tick, index) => (
                <div key={index} className="pb-2.5 border-b border-borderGray/15 last:border-0 leading-relaxed">
                  <div className="flex items-center justify-between text-textMuted text-[10px] pb-1 font-sans">
                    <span className="flex items-center gap-2">
                      <span className="text-brandGreen font-bold font-mono">
                        {tick.tradingSymbol || `${tick.exchange}:${tick.token}`}
                      </span>
                      <span>(Correlation: sub_{tick.token})</span>
                    </span>
                    <span>{new Date(tick.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <pre className="text-sky-300 overflow-x-auto whitespace-pre-wrap select-text">
                    {JSON.stringify(tick, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
