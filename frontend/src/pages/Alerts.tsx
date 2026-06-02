import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { 
  Bell, 
  BellRing, 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  History, 
  RefreshCw
} from 'lucide-react';

interface StockOption {
  exchange: string;
  token: string;
  symbol: string;
  name: string;
}

export const Alerts: React.FC = () => {
  const { 
    status, 
    ticks, 
    alerts, 
    triggeredAlert, 
    setTriggeredAlert, 
    addAlert, 
    deleteAlert
  } = useWebSocket();

  const mcxToken = status?.mcxToken || '31181';

  // Curated list of popular stocks present in our website
  const defaultStocks: StockOption[] = [
    { exchange: 'NSE', token: mcxToken, symbol: 'MCX', name: 'Multi Commodity Exchange of India Ltd' },
    { exchange: 'MCX', token: '251394', symbol: 'GOLD26JUNFUT', name: 'MCX GOLD FUTURE' },
    { exchange: 'MCX', token: '251395', symbol: 'CRUDEOIL16JUNFUT', name: 'MCX CRUDE OIL FUTURE' },
    { exchange: 'NSE', token: '3045', symbol: 'SBIN-EQ', name: 'STATE BANK OF INDIA' },
    { exchange: 'NSE', token: '3456', symbol: 'RELIANCE-EQ', name: 'RELIANCE INDUSTRIES LTD' },
    { exchange: 'NSE', token: '11536', symbol: 'TCS-EQ', name: 'TATA CONSULTANCY SERVICES' },
    { exchange: 'NSE', token: '1333', symbol: 'HDFCBANK-EQ', name: 'HDFC BANK LTD' },
    { exchange: 'NSE', token: '14366', symbol: 'INFY-EQ', name: 'INFOSYS LTD' },
    { exchange: 'BSE', token: '500112', symbol: 'SBIN', name: 'STATE BANK OF INDIA (BSE)' },
    { exchange: 'BSE', token: '500325', symbol: 'RELIANCE', name: 'RELIANCE INDUSTRIES LTD (BSE)' }
  ];

  const [stocks, setStocks] = useState<StockOption[]>(defaultStocks);
  const [selectedStockKey, setSelectedStockKey] = useState<string>(`NSE:${mcxToken}`);
  const [alertCriteria, setAlertCriteria] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [alertValue, setAlertValue] = useState<string>('');
  const [currentPriceLoading, setCurrentPriceLoading] = useState<boolean>(false);

  // Sync additional watched stocks from active WebSocket subscriptions
  useEffect(() => {
    if (status?.activeSubscriptions) {
      const merged = [...defaultStocks];
      status.activeSubscriptions.forEach((subKey) => {
        const [exchange, token] = subKey.split(':');
        const exists = merged.some(s => s.exchange === exchange && s.token === token);
        if (!exists) {
          // Attempt to find details in active ticks or display basic info
          const tick = ticks[subKey];
          merged.push({
            exchange,
            token,
            symbol: tick?.tradingSymbol || `${exchange}:${token}`,
            name: `${exchange} Watchlisted Stock`
          });
        }
      });
      setStocks(merged);
    }
  }, [status?.activeSubscriptions, mcxToken]);

  // Selected Stock Helper
  const getSelectedStock = (): StockOption => {
    const [exchange, token] = selectedStockKey.split(':');
    return stocks.find(s => s.exchange === exchange && s.token === token) || stocks[0];
  };

  // Fetch current price for selected stock and auto-populate input
  const fetchAndPopulatePrice = async (stockKey: string) => {
    const [exchange, token] = stockKey.split(':');
    const liveTick = ticks[stockKey];
    
    if (liveTick?.lastTradedPrice) {
      setAlertValue(liveTick.lastTradedPrice.toFixed(2));
      return;
    }

    // Fallback to REST Quote fetch
    setCurrentPriceLoading(true);
    try {
      const res = await fetch('/api/market-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange, token })
      });
      const data = await res.json();
      if (data?.status && data?.data?.fetched?.[0]) {
        const ltp = data.data.fetched[0].ltp;
        setAlertValue(ltp.toFixed(2));
      }
    } catch (e) {
      console.error('Failed to backfill REST quote for alert input', e);
    } finally {
      setCurrentPriceLoading(false);
    }
  };

  // Trigger auto-population on stock key change
  useEffect(() => {
    fetchAndPopulatePrice(selectedStockKey);
  }, [selectedStockKey]);

  // Get active price for selected stock for display
  const getSelectedStockPrice = (): number | null => {
    const liveTick = ticks[selectedStockKey];
    if (liveTick?.lastTradedPrice) return liveTick.lastTradedPrice;
    return null;
  };

  const handleCreateAlert = async () => {
    const parsedVal = parseFloat(alertValue);
    if (isNaN(parsedVal) || parsedVal <= 0) return;
    
    const stock = getSelectedStock();
    await addAlert(stock.exchange, stock.token, stock.symbol, alertCriteria, parsedVal);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="glass-panel p-8 rounded-3xl relative overflow-hidden flex flex-wrap items-center justify-between gap-6 border border-borderGray/50 shadow-2xl">
        <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 w-[400px] h-[400px] bg-brandBlue/5 rounded-full blur-[100px] -z-10" />
        
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brandBlue/10 border border-brandBlue/20 text-brandBlue text-xs font-mono font-semibold">
            <BellRing size={12} className="animate-pulse" />
            <span>Smart Monitor Suite</span>
          </div>
          <h2 className="text-2xl font-bold text-textBright tracking-tight">Price Alerts Command Center</h2>
          <p className="text-xs text-textMuted leading-relaxed">
            Create threshold alert boundaries for stocks present in our sandbox environment. Alerts are evaluated at tick-level against live WebSocket streams or fallback REST feeds, playing synthesized arpeggios on target breach.
          </p>
        </div>
      </div>

      {/* Main Alerts Interface Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Create Alert Panel */}
        <div className="lg:col-span-1 glass-panel p-6 rounded-2xl border border-borderGray/40 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brandBlue/5 rounded-full blur-xl -z-10" />
          
          <h3 className="text-sm font-semibold text-textBright uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-borderGray/30">
            <Plus size={16} className="text-brandBlue animate-pulse" />
            <span>Create Price Alert</span>
          </h3>

          <div className="space-y-4 text-xs">
            {/* Step 1: Dropdown Stock Selector */}
            <div className="space-y-2">
              <label className="text-[10px] text-textMuted uppercase font-semibold">Select Instrument</label>
              <select
                value={selectedStockKey}
                onChange={(e) => setSelectedStockKey(e.target.value)}
                className="w-full bg-darkBg border border-borderGray rounded-xl px-3.5 py-3 text-textBright font-semibold focus:outline-none focus:border-brandBlue cursor-pointer text-xs"
              >
                {stocks.map((stock) => (
                  <option key={`${stock.exchange}:${stock.token}`} value={`${stock.exchange}:${stock.token}`}>
                    [{stock.exchange}] {stock.symbol} — {stock.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Live Indicator of Selected Stock */}
            <div className="p-3.5 rounded-xl border border-borderGray/25 bg-black/20 flex justify-between items-center font-mono">
              <span className="text-textMuted text-[10px]">Current Live Price:</span>
              <span className="text-textBright font-bold text-xs flex items-center gap-1.5">
                {currentPriceLoading ? (
                  <RefreshCw className="animate-spin text-brandBlue" size={12} />
                ) : getSelectedStockPrice() ? (
                  `₹${getSelectedStockPrice()?.toFixed(2)}`
                ) : (
                  'Fetching quote...'
                )}
              </span>
            </div>

            {/* Step 2: Alert Criteria Selector */}
            <div className="space-y-2">
              <label className="text-[10px] text-textMuted uppercase font-semibold">Alert Condition</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setAlertCriteria('ABOVE')}
                  className={`py-2.5 rounded-xl border font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    alertCriteria === 'ABOVE'
                      ? 'bg-brandGreen/10 border-brandGreen text-brandGreen'
                      : 'bg-darkBg border-borderGray hover:bg-cardHover text-textMuted'
                  }`}
                >
                  <TrendingUp size={14} />
                  <span>{"Goes Above (>=)"}</span>
                </button>
                <button
                  onClick={() => setAlertCriteria('BELOW')}
                  className={`py-2.5 rounded-xl border font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    alertCriteria === 'BELOW'
                      ? 'bg-brandRed/10 border-brandRed text-brandRed'
                      : 'bg-darkBg border-borderGray hover:bg-cardHover text-textMuted'
                  }`}
                >
                  <TrendingDown size={14} />
                  <span>{"Goes Below (<=)"}</span>
                </button>
              </div>
            </div>

            {/* Step 3: Price input with automatic population */}
            <div className="space-y-2">
              <label className="text-[10px] text-textMuted uppercase font-semibold">Target Trigger Price (₹)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.05"
                  placeholder="Enter target price..."
                  value={alertValue}
                  onChange={(e) => setAlertValue(e.target.value)}
                  className="w-full bg-darkBg border border-borderGray rounded-xl pl-4 pr-12 py-3 text-textBright font-mono font-bold text-sm focus:outline-none focus:border-brandBlue no-spinner"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-textMuted font-semibold text-xs">INR</span>
              </div>
              <p className="text-[9px] text-textMuted italic pt-0.5">
                * Input was automatically populated with the latest current quote. You can modify this boundary as needed.
              </p>
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreateAlert}
              className="w-full bg-brandBlue hover:bg-brandBlue/90 text-white font-bold py-3.5 rounded-xl transition-trading flex items-center justify-center gap-2 cursor-pointer mt-2 shadow-lg shadow-brandBlue/15 text-xs"
            >
              <Plus size={16} />
              <span>Set Real-Time Alert</span>
            </button>
          </div>
        </div>

        {/* Right Side: Alerts Monitor Grid */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section 1: Active Alerts */}
          <div className="glass-panel p-6 rounded-2xl border border-borderGray/40 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-borderGray/30">
              <h3 className="text-sm font-semibold text-textBright uppercase tracking-wider flex items-center gap-2">
                <Bell size={16} className="text-brandGreen animate-pulse-fast" />
                <span>Active Alerts Monitor</span>
              </h3>
              <span className="text-[10px] bg-brandGreen/10 border border-brandGreen/25 text-brandGreen px-2.5 py-0.5 rounded-full font-mono font-bold">
                {alerts.filter(a => a.active).length} Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1">
              {alerts.filter(a => a.active).length === 0 ? (
                <div className="col-span-full py-8 text-center text-textMuted text-xs italic">
                  No active price alerts set. Use the left panel to register stock thresholds!
                </div>
              ) : (
                alerts.filter(a => a.active).map(alert => {
                  const tickKey = `${alert.exchange}:${alert.token}`;
                  const liveTick = ticks[tickKey];
                  const currentLtp = liveTick?.lastTradedPrice;

                  return (
                    <div 
                      key={alert.id} 
                      className="p-4 rounded-xl border border-borderGray/30 bg-black/25 flex flex-col justify-between space-y-3 group hover:border-borderGray/75 transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-textBright font-mono">{alert.symbol}</span>
                            <span className="text-[8px] bg-borderGray px-1.5 py-0.5 rounded text-textMuted font-mono font-bold uppercase">{alert.exchange}</span>
                          </div>
                          <span className="text-[9px] text-textMuted font-mono">Token: {alert.token}</span>
                        </div>
                        
                        <button
                          onClick={() => deleteAlert(alert.id)}
                          className="text-textMuted hover:text-brandRed p-1.5 rounded-lg hover:bg-brandRed/10 transition-colors cursor-pointer"
                          title="Cancel active alert"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-borderGray/15 text-xs font-mono">
                        <div>
                          <span className="text-[9px] text-textMuted uppercase font-semibold block pb-0.5">Threshold</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            alert.criteria === 'ABOVE' ? 'bg-brandGreen/10 text-brandGreen' : 'bg-brandRed/10 text-brandRed'
                          }`}>
                            {alert.criteria} ₹{alert.value.toFixed(2)}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[9px] text-textMuted uppercase font-semibold block pb-0.5">Current LTP</span>
                          <span className="text-textBright font-bold">
                            {currentLtp ? `₹${currentLtp.toFixed(2)}` : 'Streaming...'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Section 2: Triggered History */}
          <div className="glass-panel p-6 rounded-2xl border border-borderGray/40 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-borderGray/30">
              <h3 className="text-sm font-semibold text-textBright uppercase tracking-wider flex items-center gap-2">
                <History size={16} className="text-brandOrange" />
                <span>Triggered Alerts Logs</span>
              </h3>
              <span className="text-[10px] bg-brandOrange/10 border border-brandOrange/25 text-brandOrange px-2.5 py-0.5 rounded-full font-mono font-bold">
                {alerts.filter(a => a.triggered).length} Breach Logs
              </span>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {alerts.filter(a => a.triggered).length === 0 ? (
                <p className="text-xs text-textMuted italic text-center py-6">No triggered history found. Price thresholds remain unbroken.</p>
              ) : (
                alerts.filter(a => a.triggered).map(alert => (
                  <div 
                    key={alert.id} 
                    className="flex justify-between items-center text-xs p-3.5 rounded-xl bg-darkBg/50 border border-borderGray/20 opacity-80 hover:opacity-100 transition-all font-mono"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-textBright">{alert.symbol}</span>
                        <span className="text-[8px] bg-borderGray/50 px-1.5 py-0.5 rounded text-textMuted uppercase font-bold">{alert.exchange}</span>
                        <span className={`text-[9px] font-bold ${
                          alert.criteria === 'ABOVE' ? 'text-brandGreen' : 'text-brandRed'
                        }`}>
                          {alert.criteria} {alert.value.toFixed(1)}
                        </span>
                      </div>
                      <span className="text-[9px] text-textMuted block">Triggered at: {new Date(alert.triggeredAt).toLocaleString()}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-[9px] text-textMuted uppercase font-semibold block">Breached LTP</span>
                        <span className="text-brandOrange font-bold">₹{alert.triggeredValue?.toFixed(2)}</span>
                      </div>
                      
                      <button
                        onClick={() => deleteAlert(alert.id)}
                        className="text-textMuted hover:text-brandRed p-1 rounded transition-colors cursor-pointer"
                        title="Remove log entry"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Real-time price alert popup overlay HUD */}
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
              <h3 className="text-xl font-black text-textBright mt-3 font-sans">Price Target Reached!</h3>
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
                <span className="text-lg font-black text-brandOrange">₹{triggeredAlert.triggeredValue?.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => setTriggeredAlert(null)}
              className="w-full bg-brandOrange hover:bg-brandOrange/85 text-black font-black font-sans uppercase tracking-wider py-3 rounded-xl transition-all text-xs shadow-lg shadow-brandOrange/15 cursor-pointer font-bold"
            >
              Acknowledge Alert
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
