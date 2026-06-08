import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from './layouts/AuthLayout';
import { MainLayout } from './layouts/MainLayout';

// Auth Pages
import { Login } from './pages/Auth/Login';
import { Register } from './pages/Auth/Register';

// Dashboard & Data Pages
import { Dashboard } from './pages/Dashboard/Dashboard';
import { Market } from './pages/Market/Market';
import { Portfolio } from './pages/Portfolio/Portfolio';
import { Orders } from './pages/Orders/Orders';
import { Trades } from './pages/Trades/Trades';
import { Wallet } from './pages/Wallet/Wallet';

// Trading Terminal
import { TradePage } from './pages/Trading/TradePage';

function App() {
  return (
    <Routes>
      {/* Public/Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>
      
      {/* Protected Routes */}
      <Route element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="market" element={<Market />} />
        <Route path="trade/:symbol" element={<TradePage />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="orders" element={<Orders />} />
        <Route path="trades" element={<Trades />} />
        <Route path="wallet" element={<Wallet />} />
      </Route>
      
      {/* Catch All */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
