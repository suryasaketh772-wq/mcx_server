import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { 
  LayoutDashboard, 
  Settings, 
  Activity, 
  Terminal, 
  Search, 
  TrendingUp, 
  Network,
  User,
  Bell,
  Menu,
  X
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { status, connectionState } = useWebSocket();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Sidebar navigation links
  const links = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/mcx-share-price', label: 'MCX Share Price', icon: TrendingUp },
    { to: '/stock-search', label: 'Stock Search', icon: Search },
    { to: '/alerts', label: 'Price Alerts', icon: Bell },
    { to: '/api-test', label: 'API Testing', icon: Activity },
    { to: '/websocket-test', label: 'WebSocket Test', icon: Network },
    { to: '/settings', label: 'SmartAPI Config', icon: Settings },
    { to: '/logs', label: 'System Logs', icon: Terminal }
  ];

  const getPulseGlow = (val: string) => {
    if (val === 'Connected' || val === 'Active' || val === 'Logged In') return 'indicator-glow-green';
    if (val === 'Simulated') return 'indicator-glow-orange';
    return 'indicator-glow-red';
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full justify-between">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-borderGray">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brandBlue flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-brandBlue/35">
              A
            </div>
            <div>
              <h1 className="text-textBright font-semibold tracking-wide text-sm font-sans">SmartAPI Tester</h1>
              <p className="text-[10px] text-textMuted uppercase font-semibold">Angel One Sandbox</p>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-textMuted hover:bg-cardHover hover:text-textBright transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setIsSidebarOpen(false)} // Close drawer on navigation
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-trading
                  ${isActive 
                    ? 'bg-brandBlue/10 text-brandBlue border-l-4 border-brandBlue' 
                    : 'text-textMuted hover:bg-cardHover hover:text-textBright'}
                `}
              >
                <Icon size={18} />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Profile Card / Masked Client Code */}
      <div className="p-4 border-t border-borderGray bg-darkBg/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-borderGray flex items-center justify-center text-textMuted">
            <User size={18} />
          </div>
          <div className="overflow-hidden">
            <p className="text-xs text-textBright font-medium truncate">
              {status?.profile?.clientcode || status?.profile?.name || 'Session Inactive'}
            </p>
            <p className="text-[10px] text-textMuted font-mono uppercase truncate">
              {status?.profile?.clientcode ? 'Angel One Profile' : 'Not Authenticated'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-darkBg text-textNormal overflow-hidden">
      {/* 1. Desktop Static Sidebar (Hidden below lg screens) */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-cardBg border-r border-borderGray shrink-0 transition-trading">
        {renderSidebarContent()}
      </aside>

      {/* 2. Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 3. Mobile Slide-out Drawer Sidebar Container */}
      <aside className={`lg:hidden fixed top-0 bottom-0 left-0 w-64 bg-cardBg border-r border-borderGray flex flex-col z-50 transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {renderSidebarContent()}
      </aside>

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Indicators */}
        <header className="h-16 bg-cardBg border-b border-borderGray px-4 sm:px-8 flex items-center justify-between z-10">
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Hamburger Menu Toggle for Mobile */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-textMuted hover:bg-cardHover hover:text-textBright transition-colors cursor-pointer mr-1"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-xs sm:text-sm font-semibold text-textBright font-sans uppercase tracking-wider truncate max-w-[120px] sm:max-w-none">
              {window.location.pathname === '/' 
                ? 'Dashboard' 
                : links.find(l => l.to === window.location.pathname)?.label || 'SmartAPI Suite'}
            </h2>
          </div>

          {/* Glowing Status Pills */}
          <div className="flex items-center gap-1.5 sm:gap-3 text-[10px] sm:text-xs font-mono">
            {/* Backend Proxy WebSocket */}
            <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full bg-darkBg border border-borderGray/60">
              <span className="text-[10px] text-textMuted uppercase font-semibold hidden md:inline">Web Proxy:</span>
              <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-pulse-fast ${connectionState === 'connected' ? 'bg-brandGreen indicator-glow-green' : 'bg-brandRed indicator-glow-red'}`} />
              <span className={connectionState === 'connected' ? 'text-brandGreen' : 'text-brandRed'}>
                {connectionState === 'connected' ? 'Active' : 'Offline'}
              </span>
            </div>

            {/* SmartAPI Connection */}
            <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full bg-darkBg border border-borderGray/60">
              <span className="text-[10px] text-textMuted uppercase font-semibold hidden md:inline">SmartAPI:</span>
              <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-pulse-fast ${getPulseGlow(status?.smartApiStatus || 'Disconnected')}`} />
              <span className={status?.smartApiStatus === 'Connected' ? 'text-brandGreen' : 'text-brandRed'}>
                {status?.smartApiStatus === 'Connected' ? 'Active' : 'Offline'}
              </span>
            </div>

            {/* WebSocket Stream State */}
            <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full bg-darkBg border border-borderGray/60">
              <span className="text-[10px] text-textMuted uppercase font-semibold hidden md:inline">Live Stream:</span>
              <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-pulse-fast ${getPulseGlow(status?.wsStatus || 'Disconnected')}`} />
              <span className={status?.wsStatus === 'Connected' ? 'text-brandGreen' : (status?.wsStatus === 'Simulated' ? 'text-brandOrange' : 'text-brandRed')}>
                {status?.wsStatus === 'Connected' ? 'Live' : (status?.wsStatus === 'Simulated' ? 'Sim' : 'Off')}
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic Page Container (Responsive Padding) */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-darkBg relative">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
