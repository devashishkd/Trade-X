import React, { useEffect, useState } from 'react';
import { apiClient } from '../../services/apiClient';
import { Wallet as WalletIcon, ArrowDownToLine, CheckCircle } from 'lucide-react';

interface Transaction {
  id:        string;
  type:      string;
  amount:    number;
  status:    string;
  createdAt: string;
}

const fmt = (v: number) =>
  v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const istTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

const PRESETS = [10_000, 50_000, 1_00_000, 5_00_000];

export const Wallet: React.FC = () => {
  const [balance,   setBalance]   = useState({ availableBalance: '0', lockedBalance: '0' });
  const [amount,    setAmount]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [depositing, setDepositing] = useState(false);
  const [msg,       setMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [txns,      setTxns]      = useState<Transaction[]>([]);

  const fetchWallet = async () => {
    try {
      const res = await apiClient.get('/wallet/balance');
      if (res.data.success) setBalance(res.data.data);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchWallet(); }, []);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const val = Number(amount);
    if (!val || val <= 0) {
      setMsg({ type: 'error', text: 'Enter a valid amount to deposit' });
      return;
    }
    setDepositing(true);
    try {
      const res = await apiClient.post('/wallet/deposit', { amount: val });
      if (res.data.success) {
        setMsg({ type: 'success', text: `₹${fmt(val)} deposited successfully` });
        setAmount('');
        setTxns((prev) => [
          { id: Date.now().toString(), type: 'DEPOSIT', amount: val, status: 'COMPLETED', createdAt: new Date().toISOString() },
          ...prev,
        ]);
        fetchWallet();
        // Clear success message after 3s
        setTimeout(() => setMsg(null), 3000);
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.error?.message || 'Deposit failed' });
    } finally {
      setDepositing(false);
    }
  };

  const available   = parseFloat(balance.availableBalance) || 0;
  const locked      = parseFloat(balance.lockedBalance)    || 0;
  const total       = available + locked;

  if (loading) {
    return <div className="page-loading"><div className="chart-loading-spinner" /><span>Loading wallet…</span></div>;
  }

  return (
    <div className="data-page">
      <div className="data-page-header">
        <div>
          <h1 className="data-page-title flex items-center gap-2">
            <WalletIcon className="w-5 h-5 text-indigo-400" /> Wallet
          </h1>
          <p className="data-page-sub">Manage your simulated funds</p>
        </div>
      </div>

      <div className="wallet-grid">
        {/* ── Balance Card ───────────────────────────────────────────── */}
        <div className="wallet-balance-card">
          <div className="wallet-balance-label">Total Balance</div>
          <div className="wallet-balance-amount">₹{fmt(total)}</div>

          <div className="wallet-balance-breakdown">
            <div className="wallet-balance-row">
              <span className="wallet-balance-row-label">Available</span>
              <span className="wallet-balance-row-val price-up">₹{fmt(available)}</span>
            </div>
            <div className="wallet-balance-row">
              <span className="wallet-balance-row-label">In Orders (Locked)</span>
              <span className="wallet-balance-row-val text-gray-300">₹{fmt(locked)}</span>
            </div>
          </div>

          {/* Allocation bar */}
          {total > 0 && (
            <div className="wallet-alloc-bar">
              <div
                className="wallet-alloc-available"
                style={{ width: `${(available / total) * 100}%` }}
                title={`Available: ${((available / total) * 100).toFixed(1)}%`}
              />
            </div>
          )}
          <div className="wallet-alloc-legend">
            <span className="wallet-alloc-legend-item"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1.5" />Available</span>
            <span className="wallet-alloc-legend-item"><span className="w-2 h-2 rounded-full bg-indigo-700 inline-block mr-1.5" />Locked</span>
          </div>
        </div>

        {/* ── Deposit Card ───────────────────────────────────────────── */}
        <div className="wallet-deposit-card">
          <div className="wallet-deposit-title">
            <ArrowDownToLine className="w-4 h-4 text-indigo-400" />
            Fund Your Account
          </div>
          <p className="wallet-deposit-desc">
            Instantly add simulated INR funds to trade. No real money involved.
          </p>

          {/* Quick presets */}
          <div className="wallet-presets">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(String(p))}
                className={`wallet-preset-btn ${amount === String(p) ? 'wallet-preset-btn--active' : ''}`}
                id={`deposit-preset-${p}`}
              >
                ₹{p >= 1_00_000 ? `${(p / 1_00_000).toFixed(0)}L` : p >= 1_000 ? `${(p / 1_000).toFixed(0)}K` : p}
              </button>
            ))}
          </div>

          <form onSubmit={handleDeposit} className="wallet-deposit-form">
            <div className="wallet-amount-field">
              <span className="wallet-amount-prefix">₹</span>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="wallet-amount-input"
                id="deposit-amount"
              />
            </div>

            <button
              type="submit"
              id="deposit-submit"
              disabled={depositing}
              className="wallet-deposit-btn"
            >
              {depositing ? <span className="auth-btn-spinner" /> : <><ArrowDownToLine className="w-4 h-4" /> Deposit Funds</>}
            </button>
          </form>

          {msg && (
            <div className={`wallet-msg ${msg.type === 'success' ? 'wallet-msg--success' : 'wallet-msg--error'}`}>
              {msg.type === 'success' && <CheckCircle className="w-4 h-4" />}
              {msg.text}
            </div>
          )}
        </div>
      </div>

      {/* ── Transactions ───────────────────────────────────────────────── */}
      {txns.length > 0 && (
        <div className="data-table-card">
          <div className="data-table-title">Recent Transactions (this session)</div>
          <table className="data-table">
            <thead>
              <tr>
                <th className="data-th">Type</th>
                <th className="data-th data-th--right">Amount (₹)</th>
                <th className="data-th data-th--center">Status</th>
                <th className="data-th data-th--right">Time (IST)</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id} className="data-row">
                  <td className="data-td flex items-center gap-2">
                    <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />{t.type}
                  </td>
                  <td className="data-td data-td--right data-td--mono price-up">+₹{fmt(t.amount)}</td>
                  <td className="data-td data-td--center">
                    <span className="status-badge status-badge--green">{t.status}</span>
                  </td>
                  <td className="data-td data-td--right text-gray-400 text-xs">{istTime(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
