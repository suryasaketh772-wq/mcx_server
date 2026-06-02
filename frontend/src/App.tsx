import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WebSocketProvider } from './hooks/useWebSocket';
import { Layout } from './components/Layout';

// Pages
import { Dashboard } from './pages/Dashboard';
import { McxSharePrice } from './pages/McxSharePrice';
import { StockSearch } from './pages/StockSearch';
import { Alerts } from './pages/Alerts';
import { ApiTest } from './pages/ApiTest';
import { WebsocketTest } from './pages/WebsocketTest';
import { Settings } from './pages/Settings';
import { Logs } from './pages/Logs';

export const App: React.FC = () => {
  return (
    <WebSocketProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/mcx-share-price" element={<McxSharePrice />} />
            <Route path="/stock-search" element={<StockSearch />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/api-test" element={<ApiTest />} />
            <Route path="/websocket-test" element={<WebsocketTest />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/logs" element={<Logs />} />
          </Routes>
        </Layout>
      </Router>
    </WebSocketProvider>
  );
};

export default App;
