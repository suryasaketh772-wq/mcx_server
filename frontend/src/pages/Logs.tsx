import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket, LogData } from '../hooks/useWebSocket';
import { Trash2, Search, ArrowDown, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export const Logs: React.FC = () => {
  const { logs, clearSystemLogs } = useWebSocket();
  const [filter, setFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom on log additions
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, filter]);

  const getLogColorClass = (type: string) => {
    switch (type) {
      case 'api_req': return 'text-sky-400';
      case 'api_res': return 'text-emerald-400';
      case 'ws_event': return 'text-purple-400';
      case 'auth_event': return 'text-blue-400';
      case 'error': return 'text-rose-500 font-semibold';
      default: return 'text-textNormal';
    }
  };

  const getLogTypeBadge = (type: string) => {
    switch (type) {
      case 'api_req': return '[API_REQ]';
      case 'api_res': return '[API_RES]';
      case 'ws_event': return '[WS_EVT]';
      case 'auth_event': return '[AUTH]   ';
      case 'error': return '[ERROR]  ';
      default: return '[SYS]    ';
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'ALL' || log.type === filter;
    const matchesSearch = searchQuery === '' || 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const toggleExpandLog = (id: number) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  return (
    <div className="space-y-4 flex flex-col h-[calc(100vh-140px)]">
      {/* Filters Toolbar */}
      <div className="glass-panel p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
        {/* Type Toggles */}
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          {['ALL', 'api_req', 'api_res', 'ws_event', 'auth_event', 'error'].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 rounded-lg border transition-trading capitalize
                ${filter === type 
                  ? 'bg-brandBlue/15 text-brandBlue border-brandBlue/35' 
                  : 'bg-darkBg/50 text-textMuted border-borderGray hover:text-textBright'}
              `}
            >
              {type === 'ALL' ? 'Show All' : type.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-3">
          <div className="relative text-xs">
            <input
              type="text"
              placeholder="Search in log streams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-darkBg border border-borderGray rounded-lg pl-8 pr-4 py-1.5 w-56 text-textBright focus:outline-none focus:border-brandBlue font-sans"
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-textMuted" size={14} />
          </div>

          {/* Autoscroll */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 transition-trading
              ${autoScroll 
                ? 'bg-brandGreen/10 border-brandGreen/20 text-brandGreen' 
                : 'bg-darkBg border-borderGray text-textMuted hover:text-textBright'}
            `}
            title="Autoscroll to bottom"
          >
            <ArrowDown size={14} />
            <span>Autoscroll</span>
          </button>

          {/* Clear Logs */}
          <button
            onClick={clearSystemLogs}
            className="p-2 bg-brandRed/10 border border-brandRed/20 hover:bg-brandRed/15 text-brandRed rounded-lg text-xs flex items-center gap-1.5 transition-trading"
            title="Clear all logs"
          >
            <Trash2 size={14} />
            <span>Clear Terminal</span>
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className="flex-1 glass-panel rounded-2xl p-6 font-mono text-xs overflow-y-auto bg-black/80 flex flex-col space-y-2 border border-borderGray shadow-2xl relative">
        {/* Terminal Header */}
        <div className="absolute right-6 top-4 flex items-center gap-2 text-[10px] text-textMuted font-sans select-none pointer-events-none bg-black/40 px-2.5 py-1 rounded-md border border-borderGray/40">
          <ShieldCheck size={12} className="text-brandGreen" />
          <span>Secured Sandbox Stream</span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-textMuted font-sans gap-2">
            <p>No transactions or socket packets registered in buffer yet.</p>
            <p className="text-[10px] text-textMuted/60">Generate network API events, subscription streams, or log in to populate ticks.</p>
          </div>
        ) : (
          filteredLogs.map((log: LogData) => {
            const isExpanded = expandedLogId === log.id;
            return (
              <div 
                key={log.id} 
                className="py-1 border-b border-borderGray/15 last:border-0 hover:bg-white/[0.02] rounded px-2 transition-all cursor-pointer"
                onClick={() => toggleExpandLog(log.id)}
              >
                <div className="flex items-start gap-4">
                  {/* Timestamp */}
                  <span className="text-textMuted select-none text-[11px] shrink-0 font-sans">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  
                  {/* Badge Type */}
                  <span className={`font-semibold shrink-0 select-none ${getLogColorClass(log.type)}`}>
                    {getLogTypeBadge(log.type)}
                  </span>
                  
                  {/* Message */}
                  <span className="text-textBright break-all flex-1 select-text">
                    {log.message}
                  </span>

                  {/* Expansion indicator */}
                  {log.details && (
                    <span className="text-[10px] text-brandBlue uppercase font-semibold shrink-0 flex items-center gap-1 select-none">
                      {isExpanded ? <EyeOff size={12} /> : <Eye size={12} />}
                      <span>{isExpanded ? 'Hide Payload' : 'Inspect'}</span>
                    </span>
                  )}
                </div>

                {/* Inspect Details Drawer */}
                {log.details && isExpanded && (
                  <div className="mt-3 pl-8 pr-4 py-3 bg-darkBg border border-borderGray/50 rounded-lg text-[11px] text-sky-300 overflow-x-auto select-text whitespace-pre leading-relaxed shadow-inner">
                    {log.details}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
