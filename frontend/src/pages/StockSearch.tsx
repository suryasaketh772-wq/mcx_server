import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { Search, Plus, Trash2, Watch, ArrowUpRight, ArrowDownRight, Layers, Bell, BellRing } from 'lucide-react';

interface Scrip {
  exchange: string;
  token: string;
  symbol: string;
  name: string;
  type: string;
}

export const StockSearch: React.FC = () => {
  const { 
    status, 
    ticks, 
    subscribe, 
    unsubscribe, 
    alerts, 
    addAlert, 
    deleteAlert, 
    triggeredAlert, 
    setTriggeredAlert 
  } = useWebSocket();

  const [activeAlertConfigKey, setActiveAlertConfigKey] = useState<string | null>(null);
  const [alertCriteria, setAlertCriteria] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [alertValue, setAlertValue] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Scrip[]>([]);
  const [watchlistKeys, setWatchlistKeys] = useState<string[]>([]);
  
  // Track previous prices to trigger flashing animations
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});
  const [flashStates, setFlashStates] = useState<Record<string, 'up' | 'down' | null>>({});
  const [restQuotes, setRestQuotes] = useState<Record<string, any>>({});

  // Query scrip master
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      try {
        const response = await fetch(`/api/stocks/search?q=${searchQuery}`);
        const data = await response.json();
        setSearchResults(data);
      } catch (err) {
        console.error('Failed to search stocks', err);
      }
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Sync watchlist keys from status activeSubscriptions
  useEffect(() => {
    if (status?.activeSubscriptions) {
      setWatchlistKeys(status.activeSubscriptions);
    }
  }, [status]);

  // Backfill and poll REST quotes for watchlist items every 5 seconds
  useEffect(() => {
    if (status?.smartApiStatus !== 'Connected' || watchlistKeys.length === 0) return;

    const pollQuotes = () => {
      watchlistKeys.forEach(async (subKey) => {
        const [exchange, token] = subKey.split(':');
        try {
          const res = await fetch('/api/market-quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exchange, token })
          });
          const data = await res.json();
          if (data && data.status && data.data && data.data.fetched && data.data.fetched[0]) {
            setRestQuotes(prev => ({
              ...prev,
              [subKey]: data.data.fetched[0]
            }));
          }
        } catch (e) {
          console.error(`Failed to poll REST quote for ${subKey}`, e);
        }
      });
    };

    // Run once immediately
    pollQuotes();

    // Poll every 5 seconds
    const intervalId = setInterval(pollQuotes, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [watchlistKeys, status?.smartApiStatus]);

  // Handle flash animations upon price change
  useEffect(() => {
    const newFlashes: Record<string, 'up' | 'down' | null> = {};
    let hasChanges = false;

    watchlistKeys.forEach((subKey) => {
      const currentTick = ticks[subKey];
      if (!currentTick) return;

      const prevPrice = prevPrices[subKey];
      const currentPrice = currentTick.lastTradedPrice;

      if (prevPrice !== undefined && prevPrice !== currentPrice) {
        newFlashes[subKey] = currentPrice > prevPrice ? 'up' : 'down';
        setPrevPrices(prev => ({ ...prev, [subKey]: currentPrice }));
        hasChanges = true;
      } else if (prevPrice === undefined) {
        setPrevPrices(prev => ({ ...prev, [subKey]: currentPrice }));
      }
    });

    let timer: any = null;
    if (hasChanges) {
      setFlashStates((prev) => ({ ...prev, ...newFlashes }));
      // Clear flashes after 600ms animation finishes
      timer = setTimeout(() => {
        setFlashStates({});
      }, 600);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [ticks, watchlistKeys, prevPrices]);

  const handleSubscribe = (scrip: Scrip) => {
    subscribe(scrip.exchange, scrip.token, 2); // Mode 2: Quote (full details)
    setSearchQuery('');
  };

  const getPriceFlashClass = (key: string) => {
    const state = flashStates[key];
    if (state === 'up') return 'bg-brandGreen/25 text-brandGreen font-bold transition-all duration-100';
    if (state === 'down') return 'bg-brandRed/25 text-brandRed font-bold transition-all duration-100';
    return '';
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 w-96 h-96 bg-brandBlue/5 rounded-full blur-3xl -z-10" />
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brandBlue/10 flex items-center justify-center text-brandBlue">
            <Search size={24} />
          </div>
          <div>
            <h3 className="text-textBright font-semibold text-lg">Multi-Exchange Scrip Search</h3>
            <p className="text-xs text-textMuted mt-1">Search scrips on NSE, BSE, and MCX, subscribe, and view live market feed streams.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Search Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <h4 className="text-xs font-semibold text-textBright uppercase tracking-wide">Lookup Symbol</h4>
            <div className="relative text-xs">
              <input
                type="text"
                placeholder="Search TCS, SBI, GOLD..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-darkBg border border-borderGray rounded-lg pl-9 pr-4 py-2 text-textBright focus:outline-none focus:border-brandBlue font-sans"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" size={14} />
            </div>

            {/* Results Deck */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="text-xs text-textMuted text-center py-4">No matching symbols found.</p>
              ) : (
                searchResults.map((scrip) => {
                  const isSubscribed = watchlistKeys.includes(`${scrip.exchange}:${scrip.token}`);
                  return (
                    <div 
                      key={`${scrip.exchange}:${scrip.token}`}
                      className="p-3 rounded-lg bg-darkBg border border-borderGray/40 text-xs flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-textBright font-semibold font-mono">{scrip.symbol}</span>
                          <span className="text-[8px] bg-borderGray px-1.5 py-0.2 rounded text-textMuted font-mono font-bold uppercase">{scrip.exchange}</span>
                        </div>
                        <p className="text-[10px] text-textMuted mt-0.5 truncate max-w-[120px]">{scrip.name}</p>
                      </div>
                      
                      <button
                        onClick={() => handleSubscribe(scrip)}
                        disabled={isSubscribed}
                        className={`flex items-center justify-center p-1.5 rounded-lg border transition-trading shrink-0
                          ${isSubscribed 
                            ? 'bg-transparent border-borderGray/30 text-textMuted/45' 
                            : 'bg-brandBlue/10 border-brandBlue/20 hover:bg-brandBlue/15 text-brandBlue'}
                        `}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Watchlist Panel */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between pl-2">
            <h4 className="text-sm font-semibold text-textBright uppercase tracking-wider flex items-center gap-2">
              <Watch size={16} className="text-brandBlue" />
              <span>Live Streaming Watchlist</span>
            </h4>
            <span className="text-xs text-textMuted font-mono uppercase font-semibold">
              {watchlistKeys.length} Assets Active
            </span>
          </div>

          {watchlistKeys.length === 0 ? (
            <div className="glass-panel p-16 rounded-2xl text-center text-textMuted space-y-2">
              <Layers className="mx-auto text-textMuted/40" size={36} />
              <p className="font-medium text-sm">Your live watchlist is currently empty.</p>
              <p className="text-xs text-textMuted/60">Search and add stock or MCX symbols to view dynamic feeds.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {watchlistKeys.map((subKey) => {
                const [exchange, token] = subKey.split(':');
                const tick = ticks[subKey];
                const restQuote = restQuotes[subKey];
                
                const displayData = tick ? {
                  tradingSymbol: tick.tradingSymbol || token,
                  lastTradedPrice: tick.lastTradedPrice,
                  change: tick.change || 0,
                  changePercent: tick.changePercent || 0,
                  openPrice: tick.openPrice,
                  highPrice: tick.highPrice,
                  lowPrice: tick.lowPrice,
                  volume: tick.volume,
                  isStatic: false,
                  isSimulated: tick.isSimulated
                } : restQuote ? {
                  tradingSymbol: restQuote.tradingSymbol || token,
                  lastTradedPrice: restQuote.ltp,
                  change: restQuote.ltp - restQuote.close,
                  changePercent: restQuote.close ? ((restQuote.ltp - restQuote.close) / restQuote.close) * 100 : 0,
                  openPrice: restQuote.open,
                  highPrice: restQuote.high,
                  lowPrice: restQuote.low,
                  volume: restQuote.volume,
                  isStatic: true,
                  isSimulated: false
                } : null;

                const flashClass = getPriceFlashClass(subKey);
                const isPositive = (displayData?.change || 0) >= 0;

                return (
                  <div 
                    key={subKey} 
                    className="glass-panel p-5 rounded-2xl space-y-4 border border-borderGray/40 relative overflow-hidden group hover:shadow-lg hover:shadow-brandBlue/5 transition-all duration-300"
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-textBright font-mono">{displayData?.tradingSymbol || token}</span>
                          <span className="text-[9px] bg-borderGray px-1.5 py-0.2 rounded text-textMuted font-mono font-bold uppercase">{exchange}</span>
                        </div>
                        <p className="text-[10px] text-textMuted mt-0.5 max-w-[180px] truncate">
                          {displayData ? (displayData.isStatic ? 'REST Quote (After Hours)' : `${exchange} Instrument`) : 'Connecting...'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Alert bell toggle */}
                        <button
                          onClick={() => {
                            if (activeAlertConfigKey === subKey) {
                              setActiveAlertConfigKey(null);
                            } else {
                              setActiveAlertConfigKey(subKey);
                              setAlertCriteria('ABOVE');
                              setAlertValue(displayData?.lastTradedPrice ? displayData.lastTradedPrice.toFixed(2) : '');
                            }
                          }}
                          className={`p-1 rounded transition-colors relative ${
                            alerts.filter(a => a.active && a.token === token).length > 0 
                              ? 'text-brandOrange hover:text-brandOrange/80' 
                              : 'text-textMuted hover:text-brandBlue'
                          }`}
                          title="Configure price alerts"
                        >
                          <Bell size={14} className={alerts.filter(a => a.active && a.token === token).length > 0 ? 'animate-pulse' : ''} />
                          {alerts.filter(a => a.active && a.token === token).length > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-brandOrange text-black font-sans font-bold text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
                              {alerts.filter(a => a.active && a.token === token).length}
                            </span>
                          )}
                        </button>

                        <button
                          onClick={() => unsubscribe(exchange, token)}
                          className="text-textMuted hover:text-brandRed p-1 rounded transition-trading shrink-0"
                          title="Remove scrip"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Price Info Grid */}
                    <div className="grid grid-cols-2 gap-2 border-t border-b border-borderGray/15 py-3.5 my-2">
                      {/* Left: LTP */}
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-textMuted uppercase font-semibold">Last Traded Price</span>
                        <div className={`text-base font-bold font-mono py-0.5 rounded transition-all duration-100 ${flashClass}`}>
                          {displayData?.lastTradedPrice ? `₹${displayData.lastTradedPrice.toFixed(2)}` : 'Fetching...'}
                        </div>
                      </div>

                      {/* Right: Change */}
                      <div className="space-y-0.5 text-right">
                        <span className="text-[9px] text-textMuted uppercase font-semibold">Daily Change</span>
                        <div className={`flex items-center justify-end gap-1 text-xs font-bold font-mono py-0.5 ${isPositive ? 'text-brandGreen' : 'text-brandRed'}`}>
                          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          <span>{displayData?.change ? `${isPositive ? '+' : ''}${displayData.change.toFixed(2)}` : '0.00'}</span>
                          <span className="text-[10px] font-medium">({displayData?.changePercent ? `${isPositive ? '+' : ''}${displayData.changePercent.toFixed(2)}%` : '0.00%'})</span>
                        </div>
                      </div>
                    </div>

                    {/* Volume and Status Indicators */}
                    <div className="flex justify-between items-center text-[10px] text-textMuted font-mono">
                      <div className="flex gap-4">
                        <span>Open: <strong className="text-textBright">{displayData?.openPrice ? `₹${displayData.openPrice.toFixed(1)}` : '—'}</strong></span>
                        <span>High: <strong className="text-textBright">{displayData?.highPrice ? `₹${displayData.highPrice.toFixed(1)}` : '—'}</strong></span>
                        <span>Low: <strong className="text-textBright">{displayData?.lowPrice ? `₹${displayData.lowPrice.toFixed(1)}` : '—'}</strong></span>
                      </div>
                      <span className="text-textMuted shrink-0">Vol: <strong className="text-textBright">{displayData?.volume?.toLocaleString() || '0'}</strong></span>
                    </div>

                    {/* Glow indicators if simulated */}
                    {displayData?.isSimulated && (
                      <div className="absolute top-0 right-0 w-2 h-2 bg-brandOrange/40 rounded-bl-full" title="Mock Feed Active" />
                    )}

                    {/* Inline Alert Configuration Panel */}
                    {activeAlertConfigKey === subKey && (
                      <div className="pt-3 border-t border-borderGray/15 mt-3 space-y-3 animate-fade-in text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-textBright flex items-center gap-1">
                            <BellRing size={12} className="text-brandOrange" />
                            <span>Set Price Alert</span>
                          </span>
                          <span className="text-[9px] text-textMuted font-mono">For {displayData?.tradingSymbol || token}</span>
                        </div>

                        <div className="flex gap-2">
                          <select
                            value={alertCriteria}
                            onChange={(e) => setAlertCriteria(e.target.value as 'ABOVE' | 'BELOW')}
                            className="bg-darkBg border border-borderGray/40 rounded px-1.5 py-1 text-[10px] text-textBright font-semibold focus:outline-none focus:border-brandBlue cursor-pointer"
                          >
                            <option value="ABOVE">ABOVE (&gt;=)</option>
                            <option value="BELOW">BELOW (&lt;=)</option>
                          </select>

                          <div className="relative flex-1">
                            <input
                              type="number"
                              step="0.05"
                              value={alertValue}
                              onChange={(e) => setAlertValue(e.target.value)}
                              placeholder="Target price..."
                              className="w-full bg-darkBg border border-borderGray/40 rounded pl-2 pr-6 py-1 text-[10px] text-textBright font-mono focus:outline-none focus:border-brandBlue no-spinner"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-textMuted font-mono text-[9px]">₹</span>
                          </div>

                          <button
                            onClick={async () => {
                              const parsedVal = parseFloat(alertValue);
                              if (isNaN(parsedVal) || parsedVal <= 0) return;
                              await addAlert(exchange, token, displayData?.tradingSymbol || token, alertCriteria, parsedVal);
                              setAlertValue('');
                            }}
                            className="bg-brandOrange hover:bg-brandOrange/85 text-black font-bold px-2.5 py-1 rounded transition-all flex items-center gap-0.5 cursor-pointer shrink-0 font-bold text-[10px]"
                          >
                            <Plus size={12} />
                            <span>Set</span>
                          </button>
                        </div>

                        {/* List of active alerts for this specific symbol */}
                        {alerts.filter(a => a.active && a.token === token).length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[8px] text-textMuted uppercase font-semibold">Active Alerts:</span>
                            <div className="space-y-1 max-h-24 overflow-y-auto">
                              {alerts.filter(a => a.active && a.token === token).map((alert: any) => (
                                <div key={alert.id} className="flex justify-between items-center text-[10px] p-1.5 rounded bg-black/35 border border-borderGray/15 font-mono">
                                  <span className={`px-1 rounded text-[7px] font-bold ${
                                    alert.criteria === 'ABOVE' ? 'bg-brandGreen/10 text-brandGreen' : 'bg-brandRed/10 text-brandRed'
                                  }`}>
                                    {alert.criteria} {alert.value.toFixed(2)}
                                  </span>
                                  <button
                                    onClick={() => deleteAlert(alert.id)}
                                    className="text-textMuted hover:text-brandRed p-0.5 rounded"
                                    title="Remove alert"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Real-time price alert popup overlay */}
      {triggeredAlert && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-300">
          <div className="relative glass-panel rounded-3xl p-8 max-w-sm w-full text-center space-y-6 border border-brandOrange/30 shadow-2xl shadow-brandOrange/5">
            <div className="absolute inset-0 bg-gradient-to-b from-brandOrange/10 via-transparent to-transparent pointer-events-none rounded-3xl" />
            
            {/* Pulsing Alert Icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-brandOrange/10 border border-brandOrange/25 flex items-center justify-center text-brandOrange animate-pulse shadow-lg shadow-brandOrange/10">
              <Bell size={32} />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-brandOrange font-mono px-2.5 py-1 rounded bg-brandOrange/5 border border-brandOrange/15">
                🔔 Price Alert Breach
              </span>
              <h3 className="text-xl font-black text-textBright mt-3">Price Target Reached!</h3>
              <p className="text-xs text-textMuted font-mono">Instrument: {triggeredAlert.exchange}:{triggeredAlert.symbol}</p>
            </div>

            <div className="p-4 rounded-xl border border-borderGray/30 bg-black/40 space-y-1.5 font-mono">
              <span className="text-[10px] text-textMuted uppercase font-semibold">Trigger Condition</span>
              <div className="text-sm font-bold text-textBright flex justify-center items-center gap-1.5">
                <span className={triggeredAlert.criteria === 'ABOVE' ? 'text-brandGreen' : 'text-brandRed'}>
                  {triggeredAlert.criteria === 'ABOVE' ? 'ABOVE (>=)' : 'BELOW (<=)'}
                </span>
                <span>₹{triggeredAlert.value.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-borderGray/15 mt-2 space-y-0.5">
                <span className="text-[9px] text-textMuted uppercase font-semibold block">Breached Value</span>
                <span className="text-lg font-black text-brandOrange font-bold">₹{triggeredAlert.triggeredValue?.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => setTriggeredAlert(null)}
              className="w-full bg-brandOrange hover:bg-brandOrange/85 text-black font-black font-sans uppercase tracking-wider py-3 rounded-xl transition-trading text-xs shadow-lg shadow-brandOrange/15 cursor-pointer font-bold"
            >
              Acknowledge Alert
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
