import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { apiClient } from '../services/apiClient';
import {
  LayoutDashboard, TrendingUp, Briefcase, ListOrdered,
  History, Wallet, LogOut, ChevronRight, Activity,
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Market',    href: '/market',    icon: TrendingUp },
  { name: 'Portfolio', href: '/portfolio', icon: Briefcase },
  { name: 'Orders',    href: '/orders',    icon: ListOrdered },
  { name: 'Trades',    href: '/trades',    icon: History },
  { name: 'Wallet',    href: '/wallet',    icon: Wallet },
];

/** Format INR with en-IN locale */
const formatINR = (val: number) =>
  val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** IST clock — updates every second */
function useISTClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export const MainLayout: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout          = useAuthStore((s) => s.logout);
  const user            = useAuthStore((s) => s.user);
  const location        = useLocation();
  const istTime         = useISTClock();

  const [balance, setBalance] = useState<{ available: number; total: number } | null>(null);

  // Fetch wallet balance once on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient.get('/wallet/balance').then((res) => {
      if (res.data.success) {
        const d = res.data.data;
        const avail = parseFloat(d.availableBalance || '0');
        const locked = parseFloat(d.lockedBalance || '0');
        setBalance({ available: avail, total: avail + locked });
      }
    }).catch(() => {});
  }, [isAuthenticated]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Derive user initial for avatar
  const initial = (user?.username || user?.email || 'U')[0].toUpperCase();
  const isTradePage = location.pathname.startsWith('/trade/');

  return (
    <div className="main-layout">
      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="sidebar-brand-name">Trade-X</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ name, href, icon: Icon }) => {
            const isActive = location.pathname.startsWith(href);
            return (
              <Link
                key={name}
                to={href}
                id={`nav-${name.toLowerCase()}`}
                className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{name}</span>
                {isActive && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initial}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-username">{user?.username || 'Trader'}</div>
              <div className="sidebar-email">{user?.email || ''}</div>
            </div>
          </div>
          <button onClick={logout} className="sidebar-logout" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <div className="main-content">
        {/* Top header */}
        <header className="main-header">
          <div className="header-left">
            <div className="header-market-status">
              <span className="market-dot" />
              <span>NSE <span className="text-emerald-400 font-semibold">Open</span></span>
            </div>
            <div className="header-time">{istTime} IST</div>
          </div>

          <div className="header-right">
            {balance && (
              <div className="header-balance">
                <div className="header-balance-label">Portfolio</div>
                <div className="header-balance-value">₹{formatINR(balance.total)}</div>
              </div>
            )}
            <div className="header-avatar" title={user?.username}>
              {initial}
            </div>
          </div>
        </header>

        {/* Page content — no padding on TradePage (it manages its own) */}
        <main className={`main-page ${isTradePage ? 'main-page--trade' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
