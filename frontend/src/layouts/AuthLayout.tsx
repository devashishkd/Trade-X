import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Activity, TrendingUp, ShieldCheck, Zap } from 'lucide-react';

const FEATURES = [
  { icon: TrendingUp,   text: 'Real-time NSE Market Data' },
  { icon: Zap,          text: 'Sub-millisecond Order Execution' },
  { icon: ShieldCheck,  text: 'Secure & Encrypted Trading' },
];

export const AuthLayout: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="auth-layout">
      {/* ── Left: Branding Panel ─────────────────────────────────────── */}
      <div className="auth-brand-panel">
        {/* Ambient glow blobs */}
        <div className="auth-glow auth-glow--1" />
        <div className="auth-glow auth-glow--2" />

        <div className="auth-brand-content">
          {/* Logo */}
          <div className="auth-logo">
            <Activity className="w-7 h-7 text-white" />
            <span className="auth-logo-name">Trade-X</span>
          </div>

          <div className="auth-hero-text">
            <h1 className="auth-hero-heading">
              Professional<br />
              <span className="auth-hero-accent">Trading Terminal</span>
            </h1>
            <p className="auth-hero-sub">
              Simulate real NSE market conditions with institutional-grade infrastructure.
            </p>
          </div>

          {/* Feature list */}
          <ul className="auth-features">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="auth-feature-item">
                <div className="auth-feature-icon">
                  <Icon className="w-4 h-4 text-indigo-400" />
                </div>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          {/* Decorative ticker strip */}
          <div className="auth-ticker-strip">
            {['RELIANCE +2.4%', 'TCS -0.8%', 'INFY +1.2%', 'HDFC +0.6%', 'WIPRO -1.1%'].map((t) => (
              <span key={t} className={`auth-ticker-item ${t.includes('+') ? 'text-emerald-400' : 'text-red-400'}`}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Form Panel ─────────────────────────────────────────── */}
      <div className="auth-form-panel">
        <div className="auth-form-container">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
