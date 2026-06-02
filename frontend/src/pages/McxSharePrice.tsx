import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  BarChart4, 
  History,
  Activity,
  RefreshCw,
  Bell
} from 'lucide-react';

interface ChartNode {
  time: string;
  price: number;
}

export const McxSharePrice: React.FC = () => {
  const { 
    ticks, 
    status, 
    subscribe, 
    triggeredAlert, 
    setTriggeredAlert 
  } = useWebSocket();
  
  // Use dynamically discovered token, or fallback to the standard one
  const mcxToken = status?.mcxToken || '31181';
  const selectedSubKey = `NSE:${mcxToken}`;

  const currentTick = ticks[selectedSubKey];
  const [restQuote, setRestQuote] = useState<any>(null);
  const [chartData, setChartData] = useState<ChartNode[]>([]);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [flashClass, setFlashClass] = useState<string>('');

  // Unified display model merging REST quote and live WS ticks
  const displayData = currentTick ? {
    lastTradedPrice: currentTick.lastTradedPrice,
    change: currentTick.change || 0,
    changePercent: currentTick.changePercent || 0,
    openPrice: currentTick.openPrice,
    highPrice: currentTick.highPrice,
    lowPrice: currentTick.lowPrice,
    closePrice: currentTick.closePrice,
    volume: currentTick.volume,
    timestamp: currentTick.timestamp
  } : restQuote ? {
    lastTradedPrice: restQuote.ltp,
    change: restQuote.ltp - restQuote.close,
    changePercent: restQuote.close ? ((restQuote.ltp - restQuote.close) / restQuote.close) * 100 : 0,
    openPrice: restQuote.open,
    highPrice: restQuote.high,
    lowPrice: restQuote.low,
    closePrice: restQuote.close,
    volume: restQuote.volume,
    timestamp: new Date().toISOString(),
    isStatic: true
  } : null;

  // Auto-subscribe to the MCX stock token on mount or token discovery, with a 5-second REST polling fallback
  useEffect(() => {
    if (!mcxToken) {
      return () => {};
    }

    subscribe('NSE', mcxToken, 2); // Mode 2: Quote (OHLC)
    
    const backfillQuote = async () => {
      if (status?.smartApiStatus !== 'Connected') return;
      try {
        const res = await fetch('/api/market-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exchange: 'NSE', token: mcxToken })
        });
        const data = await res.json();
        if (data && data.status && data.data && data.data.fetched && data.data.fetched[0]) {
          setRestQuote(data.data.fetched[0]);
        }
      } catch (e) {
        console.error('Failed to backfill REST quote', e);
      }
    };

    // Run once immediately
    backfillQuote();

    // Setup 5-second polling interval for continuous background refresh
    const intervalId = setInterval(backfillQuote, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [mcxToken, status?.smartApiStatus]);

  // Monitor price changes to trigger flash animations and append chart data
  useEffect(() => {
    // If we have live tick, use it. If we have restQuote but no ticks, initialize chart with ltp
    const activePrice = currentTick ? currentTick.lastTradedPrice : (restQuote ? restQuote.ltp : null);
    if (!activePrice) return;

    let cleanTimer: any = null;
    if (prevPrice !== null && prevPrice !== activePrice) {
      // Trigger flash animation
      setFlashClass(activePrice > prevPrice ? 'flash-up' : 'flash-down');
      
      cleanTimer = setTimeout(() => {
        setFlashClass('');
      }, 600);

      // Append new chart node
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setChartData((prev) => {
        const next = [...prev, { time: timeStr, price: activePrice }];
        return next.slice(-40); // Maintain last 40 ticks
      });

      setPrevPrice(activePrice);
    } else if (prevPrice === null) {
      setPrevPrice(activePrice);
      
      // Initialize with basic spark nodes
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setChartData([{ time: timeStr, price: activePrice }]);
    }

    return () => {
      if (cleanTimer) clearTimeout(cleanTimer);
    };
  }, [currentTick, restQuote, prevPrice]);

  const isPositive = (displayData?.change || 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Header diagnostics and selector bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-textBright uppercase tracking-wider flex items-center gap-2">
            <Layers size={16} className="text-brandBlue" />
            <span>MCX Share Price Tracker</span>
          </h3>
        </div>

        {/* Live Indicator Badges */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cardBg border border-borderGray">
            <span className="text-[10px] text-textMuted uppercase font-semibold">Token ID:</span>
            <span className="text-brandBlue font-bold">{mcxToken}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cardBg border border-borderGray">
            <span className={`w-2 h-2 rounded-full animate-pulse-fast ${
              displayData?.isStatic 
                ? 'bg-textMuted' 
                : currentTick?.isSimulated 
                  ? 'bg-brandOrange indicator-glow-orange' 
                  : 'bg-brandGreen indicator-glow-green'
            }`} />
            <span className={
              displayData?.isStatic 
                ? 'text-textMuted' 
                : currentTick?.isSimulated 
                  ? 'text-brandOrange' 
                  : 'text-brandGreen'
            }>
              {displayData?.isStatic 
                ? 'REST QUOTE (AFTER HOURS)' 
                : currentTick?.isSimulated 
                  ? 'DYNAMIC SIMULATOR' 
                  : 'LIVE STOCK FEED'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Detail Cards */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-2xl space-y-5 relative overflow-hidden">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-textBright font-mono">MCX</span>
                <span className="text-[9px] bg-borderGray px-2 py-0.5 rounded text-textMuted font-mono font-bold uppercase">NSE</span>
              </div>
              <h3 className="text-lg font-bold text-textBright mt-1">Multi Commodity Exchange of India Ltd</h3>
            </div>

            {/* Price Box */}
            <div className={`p-4 rounded-xl border border-borderGray/30 bg-black/30 space-y-1 ${flashClass}`}>
              <span className="text-[10px] text-textMuted uppercase font-semibold">Current Share Price</span>
              <div className="text-2xl font-bold font-mono tracking-wide text-textBright">
                {displayData?.lastTradedPrice 
                  ? `₹${displayData.lastTradedPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` 
                  : 'Fetching live price...'}
              </div>
              <div className={`flex items-center gap-1.5 text-sm font-bold font-mono ${isPositive ? 'text-brandGreen' : 'text-brandRed'}`}>
                {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                <span>{displayData?.change ? `${isPositive ? '+' : ''}${displayData.change.toFixed(2)}` : '0.00'}</span>
                <span>({displayData?.changePercent ? `${isPositive ? '+' : ''}${displayData.changePercent.toFixed(2)}%` : '0.00%'})</span>
              </div>
            </div>

            {/* Quote Grid */}
            <div className="grid grid-cols-2 gap-3.5 text-xs border-t border-borderGray/15 pt-5">
              <div className="space-y-1">
                <span className="text-textMuted font-semibold uppercase text-[9px] flex items-center gap-1">
                  <Activity size={10} />
                  <span>Open</span>
                </span>
                <p className="text-textBright font-bold font-mono">{displayData?.openPrice ? `₹${displayData.openPrice.toLocaleString('en-IN')}` : '—'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-textMuted font-semibold uppercase text-[9px] flex items-center gap-1">
                  <BarChart4 size={10} className="text-brandGreen" />
                  <span>High</span>
                </span>
                <p className="text-brandGreen font-bold font-mono">{displayData?.highPrice ? `₹${displayData.highPrice.toLocaleString('en-IN')}` : '—'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-textMuted font-semibold uppercase text-[9px] flex items-center gap-1">
                  <BarChart4 size={10} className="text-brandRed" />
                  <span>Low</span>
                </span>
                <p className="text-brandRed font-bold font-mono">{displayData?.lowPrice ? `₹${displayData.lowPrice.toLocaleString('en-IN')}` : '—'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-textMuted font-semibold uppercase text-[9px] flex items-center gap-1">
                  <History size={10} />
                  <span>Prev. Close</span>
                </span>
                <p className="text-textMuted font-bold font-mono">{displayData?.closePrice ? `₹${displayData.closePrice.toLocaleString('en-IN')}` : '—'}</p>
              </div>
            </div>

            {/* Volume Stats */}
            <div className="pt-4 border-t border-borderGray/15 flex justify-between items-center text-xs font-mono">
              <span className="text-textMuted">NSE Total Volume:</span>
              <span className="text-textBright font-semibold">{displayData?.volume?.toLocaleString() || '0'} Shares</span>
            </div>
            
            {/* Timestamp */}
            <div className="text-[10px] text-textMuted font-mono flex items-center gap-1.5 pt-1">
              <RefreshCw size={10} className={currentTick ? 'animate-spin text-brandBlue' : ''} />
              <span>Last updated: {displayData?.timestamp ? new Date(displayData.timestamp).toLocaleTimeString() : 'Never'}</span>
            </div>
          </div>


        </div>

        {/* Right Side: Recharts area chart */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl flex flex-col h-[400px]">
          <div className="flex items-center justify-between pb-4 border-b border-borderGray/40">
            <h4 className="font-semibold text-sm uppercase tracking-wide text-textBright">Real-Time Price Flow</h4>
            <span className="text-[10px] bg-borderGray px-2 py-0.5 rounded text-textMuted font-mono">
              {chartData.length} Spark Nodes
            </span>
          </div>

          <div className="flex-1 mt-6">
            {chartData.length <= 1 ? (
              <div className="h-full flex items-center justify-center text-textMuted text-xs gap-2">
                <RefreshCw className="animate-spin text-brandBlue" size={14} />
                <span>Awaiting live ticker signals...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorStockPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isPositive ? '#00C076' : '#FF3B30'} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={isPositive ? '#00C076' : '#FF3B30'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="time" 
                    stroke="#8B949E" 
                    fontSize={9} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#8B949E" 
                    fontSize={9} 
                    tickLine={false} 
                    axisLine={false}
                    domain={['auto', 'auto']}
                    tickFormatter={(v) => `₹${v}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#161B22', 
                      borderColor: '#2A313C', 
                      borderRadius: '8px', 
                      fontSize: '11px',
                      color: '#C9D1D9',
                      fontFamily: 'monospace'
                    }}
                    labelStyle={{ color: '#8B949E' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="price" 
                    stroke={isPositive ? '#00C076' : '#FF3B30'} 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorStockPrice)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
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
