import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../services/apiClient';
import { History } from 'lucide-react';

interface TradeRecord {
  _id:        string;
  tradeId:    string;
  symbol:     string;
  side:       'BUY' | 'SELL';
  price:      any;
  quantity:   number;
  fee:        any;
  total:      any;
  executedAt: string;
}

type SideFilter = 'ALL' | 'BUY' | 'SELL';

const parseNum = (v: any) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  if (v?.$numberDecimal)     return parseFloat(v.$numberDecimal) || 0;
  return 0;
};

const fmt = (v: number) =>
  v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const istTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

export const Trades: React.FC = () => {
  const [trades,    setTrades]    = useState<TradeRecord[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [sideTab,   setSideTab]   = useState<SideFilter>('ALL');
  const [symFilter, setSymFilter] = useState('ALL');

  useEffect(() => {
    apiClient.get('/portfolio/trades?limit=500').then((res) => {
      if (res.data.success) setTrades(res.data.data.trades || res.data.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Unique symbols for filter dropdown
  const symbols = useMemo(() => {
    const set = new Set(trades.map((t) => t.symbol));
    return ['ALL', ...Array.from(set).sort()];
  }, [trades]);

  const filtered = useMemo(() =>
    trades.filter((t) => {
      const sideOk = sideTab === 'ALL' || t.side === sideTab;
      const symOk  = symFilter === 'ALL' || t.symbol === symFilter;
      return sideOk && symOk;
    }),
  [trades, sideTab, symFilter]);

  // ── Summary stats ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalBuyVal  = trades.filter((t) => t.side === 'BUY') .reduce((s, t) => s + parseNum(t.total), 0);
    const totalSellVal = trades.filter((t) => t.side === 'SELL').reduce((s, t) => s + parseNum(t.total), 0);
    const totalFees    = trades.reduce((s, t) => s + parseNum(t.fee), 0);
    return { count: trades.length, totalBuyVal, totalSellVal, totalFees };
  }, [trades]);

  if (loading) {
    return <div className="page-loading"><div className="chart-loading-spinner" /><span>Loading trade history…</span></div>;
  }

  return (
    <div className="data-page">
      <div className="data-page-header">
        <div>
          <h1 className="data-page-title flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" /> Trade History
          </h1>
          <p className="data-page-sub">{trades.length} trades executed</p>
        </div>
      </div>

      {/* ── Stats Bar ─────────────────────────────────────────────────── */}
      <div className="trades-stats-bar">
        {[
          { label: 'Total Trades',   value: stats.count.toLocaleString('en-IN'), color: '' },
          { label: 'Total Bought',   value: `₹${fmt(stats.totalBuyVal)}`,  color: 'price-up' },
          { label: 'Total Sold',     value: `₹${fmt(stats.totalSellVal)}`, color: 'price-down' },
          { label: 'Fees Paid',      value: `₹${fmt(stats.totalFees)}`,    color: 'text-gray-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="trades-stat-item">
            <div className="trades-stat-label">{label}</div>
            <div className={`trades-stat-value ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ───────────────────────────────────────────────────── */}
      <div className="trades-filters">
        {/* Side tabs */}
        <div className="filter-tabs">
          {(['ALL', 'BUY', 'SELL'] as SideFilter[]).map((s) => (
            <button
              key={s}
              id={`trades-tab-${s.toLowerCase()}`}
              onClick={() => setSideTab(s)}
              className={`filter-tab ${sideTab === s ? 'filter-tab--active' : ''} ${s === 'BUY' && sideTab === 'BUY' ? 'filter-tab--buy' : ''} ${s === 'SELL' && sideTab === 'SELL' ? 'filter-tab--sell' : ''}`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Symbol dropdown */}
        <select
          value={symFilter}
          onChange={(e) => setSymFilter(e.target.value)}
          className="trades-sym-select"
          id="trades-symbol-filter"
        >
          {symbols.map((sym) => (
            <option key={sym} value={sym}>{sym === 'ALL' ? 'All Symbols' : sym}</option>
          ))}
        </select>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div className="data-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th className="data-th">Time (IST)</th>
              <th className="data-th">Symbol</th>
              <th className="data-th">Side</th>
              <th className="data-th data-th--right">Price (₹)</th>
              <th className="data-th data-th--right">Qty</th>
              <th className="data-th data-th--right">Fee (₹)</th>
              <th className="data-th data-th--right">Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="data-td-empty">
                  No trades found.{' '}
                  <Link to="/market" className="text-indigo-400 hover:underline">Go to Market</Link>
                </td>
              </tr>
            ) : (
              filtered.map((t) => {
                const isBuy = t.side === 'BUY';
                return (
                  <tr key={t._id || t.tradeId} className="data-row">
                    <td className="data-td text-gray-400 text-xs whitespace-nowrap">{istTime(t.executedAt)}</td>
                    <td className="data-td">
                      <Link to={`/trade/${t.symbol}`}>
                        <span className="market-symbol-badge">{t.symbol}</span>
                      </Link>
                    </td>
                    <td className="data-td">
                      <span className={`side-badge ${isBuy ? 'side-badge--buy' : 'side-badge--sell'}`}>{t.side}</span>
                    </td>
                    <td className="data-td data-td--right data-td--mono">₹{fmt(parseNum(t.price))}</td>
                    <td className="data-td data-td--right data-td--mono">{t.quantity.toLocaleString('en-IN')}</td>
                    <td className="data-td data-td--right data-td--mono text-gray-500">₹{fmt(parseNum(t.fee))}</td>
                    <td className="data-td data-td--right data-td--mono">₹{fmt(parseNum(t.total))}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
