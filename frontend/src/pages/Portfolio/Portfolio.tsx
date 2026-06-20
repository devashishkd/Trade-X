import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../services/apiClient';
import { subscribeToSymbol, unsubscribeFromSymbol } from '../../services/socket';
import type { TickerUpdate } from '../../services/socket';
import { PieChart } from 'lucide-react';

interface Holding {
  symbol:           string;
  totalQty:         number;
  avgCostBasis:     string;
  currentPrice:     number;
  currentValue:     number;
  unrealizedPnL:    number;
  unrealizedPnLPct: number;
}

interface Summary {
  holdingsCount:       number;
  totalInvested:       number;
  totalCurrentValue:   number;
  totalUnrealizedPnL:  number;
  totalUnrealizedPnLPct: number;
  holdings:            Holding[];
}

const fmt = (v: number) =>
  v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PALETTE = ['#6366f1','#10b981','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899'];

export const Portfolio: React.FC = () => {
  const [data,    setData]    = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [prices,  setPrices]  = useState<Record<string, number>>({});

  const parseNum = (v: any): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return parseFloat(v) || 0;
    if (v?.$numberDecimal)     return parseFloat(v.$numberDecimal) || 0;
    return 0;
  };

  useEffect(() => {
    apiClient.get('/portfolio/summary').then((res) => {
      if (res.data.success) {
        const d = res.data.data;
        const holdings: Holding[] = (d.holdings || []).map((h: any) => ({
          symbol:           h.symbol,
          totalQty:         h.totalQty,
          avgCostBasis:     h.avgCostBasis,
          currentPrice:     parseNum(h.currentPrice),
          currentValue:     parseNum(h.currentValue),
          unrealizedPnL:    parseNum(h.unrealizedPnL),
          unrealizedPnLPct: parseNum(h.unrealizedPnLPct),
        }));
        setData({
          holdingsCount:         d.holdingsCount,
          totalInvested:         parseNum(d.totalInvested),
          totalCurrentValue:     parseNum(d.totalCurrentValue),
          totalUnrealizedPnL:    parseNum(d.totalUnrealizedPnL),
          totalUnrealizedPnLPct: parseNum(d.totalUnrealizedPnLPct),
          holdings,
        });
        // Seed initial prices
        const init: Record<string, number> = {};
        holdings.forEach((h) => { init[h.symbol] = h.currentPrice; });
        setPrices(init);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // ── Live price updates ──────────────────────────────────────────────────────
  const handleTicker = useCallback((tick: TickerUpdate) => {
    setPrices((prev) => ({ ...prev, [tick.symbol]: tick.lastTradedPrice }));
  }, []);

  useEffect(() => {
    if (!data) return;
    data.holdings.forEach((h) => subscribeToSymbol(h.symbol, { onTicker: handleTicker }));
    return () => { data.holdings.forEach((h) => unsubscribeFromSymbol(h.symbol)); };
  }, [data?.holdingsCount, handleTicker]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className="page-loading"><div className="chart-loading-spinner" /><span>Loading portfolio…</span></div>;
  }

  // ── Derive live values ───────────────────────────────────────────────────────
  const holdings = (data?.holdings || []).map((h) => {
    const livePrice  = prices[h.symbol] ?? h.currentPrice;
    const liveValue  = livePrice * h.totalQty;
    const cost       = parseFloat(h.avgCostBasis) * h.totalQty;
    const livePnL    = liveValue - cost;
    const livePnLPct = cost > 0 ? (livePnL / cost) * 100 : 0;
    return { ...h, currentPrice: livePrice, currentValue: liveValue, unrealizedPnL: livePnL, unrealizedPnLPct: livePnLPct };
  }).sort((a, b) => b.currentValue - a.currentValue);

  const liveTotalValue    = holdings.reduce((s, h) => s + h.currentValue, 0);
  const liveTotalInvested = data?.totalInvested || 0;
  const liveTotalPnL      = liveTotalValue - liveTotalInvested;
  const liveTotalPnLPct   = liveTotalInvested > 0 ? (liveTotalPnL / liveTotalInvested) * 100 : 0;
  const pnlIsUp           = liveTotalPnL >= 0;

  return (
    <div className="data-page">
      <div className="data-page-header">
        <div>
          <h1 className="data-page-title flex items-center gap-2">
            <PieChart className="w-5 h-5 text-indigo-400" /> My Portfolio
          </h1>
          <p className="data-page-sub">{data?.holdingsCount || 0} holdings · Live P&L</p>
        </div>
      </div>

      {/* ── Summary Cards ──────────────────────────────────────────────── */}
      <div className="portfolio-summary-grid">
        {/* Total value */}
        <div className="portfolio-card portfolio-card--main">
          <div className="portfolio-card-label">Current Value</div>
          <div className="portfolio-card-value">₹{fmt(liveTotalValue)}</div>

          {/* Donut-style allocation bar */}
          {holdings.length > 0 && (
            <div className="portfolio-alloc">
              <div className="portfolio-alloc-bar">
                {holdings.map((h, i) => {
                  const w = liveTotalValue > 0 ? (h.currentValue / liveTotalValue) * 100 : 0;
                  return (
                    <div
                      key={h.symbol}
                      style={{ width: `${w}%`, background: PALETTE[i % PALETTE.length] }}
                      title={`${h.symbol}: ${w.toFixed(1)}%`}
                      className="portfolio-alloc-segment"
                    />
                  );
                })}
              </div>
              <div className="portfolio-alloc-legend">
                {holdings.slice(0, 5).map((h, i) => (
                  <span key={h.symbol} className="portfolio-alloc-legend-item">
                    <span className="portfolio-alloc-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                    {h.symbol}
                  </span>
                ))}
                {holdings.length > 5 && <span className="portfolio-alloc-more">+{holdings.length - 5}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Invested */}
        <div className="portfolio-card">
          <div className="portfolio-card-label">Invested</div>
          <div className="portfolio-card-value portfolio-card-value--secondary">₹{fmt(liveTotalInvested)}</div>
        </div>

        {/* Unrealized P&L */}
        <div className="portfolio-card">
          <div className="portfolio-card-label">Unrealized P&L</div>
          <div className={`portfolio-card-value ${pnlIsUp ? 'price-up' : 'price-down'}`}>
            {pnlIsUp ? '+' : ''}₹{fmt(liveTotalPnL)}
          </div>
          <div className={`portfolio-pnl-pct ${pnlIsUp ? 'price-up' : 'price-down'}`}>
            {pnlIsUp ? '▲' : '▼'} {liveTotalPnLPct.toFixed(2)}% overall
          </div>
        </div>
      </div>

      {/* ── Holdings Table ─────────────────────────────────────────────── */}
      <div className="data-table-card">
        <div className="data-table-title">Holdings ({data?.holdingsCount || 0})</div>
        {holdings.length === 0 ? (
          <div className="data-empty-state">
            Portfolio is empty.{' '}
            <Link to="/market" className="text-indigo-400 hover:underline">Explore markets</Link>.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="data-th">Asset</th>
                <th className="data-th data-th--right">Qty</th>
                <th className="data-th data-th--right">Avg Cost (₹)</th>
                <th className="data-th data-th--right">LTP (₹)</th>
                <th className="data-th data-th--right">Value (₹)</th>
                <th className="data-th data-th--right">P&L (₹)</th>
                <th className="data-th data-th--center">Action</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const hUp = h.unrealizedPnL >= 0;
                return (
                  <tr key={h.symbol} className="data-row">
                    <td className="data-td">
                      <span className="market-symbol-badge">{h.symbol}</span>
                    </td>
                    <td className="data-td data-td--right data-td--mono">{h.totalQty.toLocaleString('en-IN')}</td>
                    <td className="data-td data-td--right data-td--mono text-gray-400">
                      ₹{fmt(parseFloat(h.avgCostBasis))}
                    </td>
                    <td className="data-td data-td--right data-td--mono">₹{fmt(h.currentPrice)}</td>
                    <td className="data-td data-td--right data-td--mono">₹{fmt(h.currentValue)}</td>
                    <td className="data-td data-td--right">
                      <div className={hUp ? 'price-up' : 'price-down'}>
                        {hUp ? '+' : ''}₹{fmt(h.unrealizedPnL)}
                      </div>
                      <div className={`text-xs ${hUp ? 'price-up' : 'price-down'} opacity-80`}>
                        {h.unrealizedPnLPct.toFixed(2)}%
                      </div>
                    </td>
                    <td className="data-td data-td--center">
                      <Link to={`/trade/${h.symbol}`} className="market-trade-btn">Trade</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
