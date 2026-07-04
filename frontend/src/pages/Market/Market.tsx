import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/apiClient';
import { SparklineChart } from '../../components/Trading/SparklineChart';
import { subscribeToSymbol, unsubscribeFromSymbol } from '../../services/socket';
import type { TickerUpdate } from '../../services/socket';
import { TrendingUp, TrendingDown, Search, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';

interface MarketSymbol {
  symbol:         string;
  name:           string;
  lastTradedPrice: number;
  change:          number;
  changePct:       number;
  volume:          number;
  sparkline?:      { time: number; value: number }[];
}

type SortKey = 'symbol' | 'lastTradedPrice' | 'changePct' | 'volume';
type SortDir = 'asc' | 'desc';

const fmt = (v: number) =>
  v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const Market: React.FC = () => {
  const navigate = useNavigate();
  const [symbols,  setSymbols]  = useState<MarketSymbol[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [query,    setQuery]    = useState('');
  const [sortKey,  setSortKey]  = useState<SortKey>('volume');
  const [sortDir,  setSortDir]  = useState<SortDir>('desc');
  const [flashing, setFlashing] = useState<Record<string, 'up' | 'down'>>({});

  // ── Parse raw API value ─────────────────────────────────────────────────────
  const parseVal = (v: any): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return parseFloat(v) || 0;
    if (v?.$numberDecimal) return parseFloat(v.$numberDecimal) || 0;
    return 0;
  };

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    apiClient.get('/market/symbols').then((res) => {
      if (res.data.success) {
        const rows: MarketSymbol[] = res.data.data.map((s: any) => ({
          symbol:         s.symbol,
          name:           s.name || s.symbol,
          lastTradedPrice: parseVal(s.lastTradedPrice),
          change:          parseVal(s.change),
          changePct:       parseVal(s.changePct),
          volume:          s.volume || 0,
        }));
        setSymbols(rows);

        // Fetch sparklines for each symbol in the background
        rows.forEach((row) => {
          apiClient.get(`/market/${row.symbol}/history?timeframe=1D&range=1M`)
            .then((r) => {
              if (r.data.success && r.data.data.length > 0) {
                setSymbols((prev) =>
                  prev.map((s) =>
                    s.symbol === row.symbol
                      ? { ...s, sparkline: r.data.data.map((d: any) => ({ time: d.time, value: d.close })) }
                      : s
                  )
                );
              }
            }).catch(() => {});
        });
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // ── Live WS price updates ───────────────────────────────────────────────────
  // tickerHandlerRef always holds the latest handler but has a stable identity,
  // so the subscription effect never needs to re-fire just because prices changed.
  const tickerHandlerRef = useRef<(data: TickerUpdate) => void>(() => {});

  tickerHandlerRef.current = (data: TickerUpdate) => {
    setSymbols((prev) =>
      prev.map((s) => {
        if (s.symbol !== data.symbol) return s;
        const isUp = data.lastTradedPrice >= s.lastTradedPrice;
        setFlashing((f) => ({ ...f, [data.symbol]: isUp ? 'up' : 'down' }));
        setTimeout(() => setFlashing((f) => { const n = { ...f }; delete n[data.symbol]; return n; }), 600);
        return {
          ...s,
          lastTradedPrice: data.lastTradedPrice,
          change:          data.change,
          changePct:       data.changePct,
          volume:          data.volume,
        };
      })
    );
  };

  // A single stable wrapper created once — same reference held by socket.ts forever.
  const stableHandlerRef = useRef<(data: TickerUpdate) => void>((data) => tickerHandlerRef.current(data));

  // Drive subscriptions off a stable string key (sorted symbol names).
  // This only changes when the SET of symbols changes, not on every price tick.
  const symbolNamesKey = useMemo(
    () => symbols.map((s) => s.symbol).sort().join(','),
    [symbols.map((s) => s.symbol).join(',')]  // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (!symbolNamesKey) return;
    const symbolList = symbolNamesKey.split(',');
    symbolList.forEach((sym) => subscribeToSymbol(sym, { onTicker: stableHandlerRef.current }));
    return () => { symbolList.forEach((sym) => unsubscribeFromSymbol(sym)); };
  }, [symbolNamesKey]); // only re-subscribes when the set of symbols actually changes

  // ── Sort + Filter ───────────────────────────────────────────────────────────
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const displayed = useMemo(() => {
    const q = query.toLowerCase();
    const filtered = symbols.filter(
      (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [symbols, query, sortKey, sortDir]);

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
      : <ArrowUpDown className="w-3 h-3 opacity-30" />;

  if (loading) {
    return <div className="page-loading"><div className="chart-loading-spinner" /><span>Loading market data…</span></div>;
  }

  return (
    <div className="data-page">
      <div className="data-page-header">
        <div>
          <h1 className="data-page-title">Market Overview</h1>
          <p className="data-page-sub">{symbols.length} symbols · Live NSE data</p>
        </div>
        {/* Search */}
        <div className="market-search-box">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbol or name…"
            className="market-search-input"
            id="market-search"
          />
        </div>
      </div>

      <div className="data-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th className="data-th" onClick={() => toggleSort('symbol')}>
                <span>Symbol</span><SortIcon k="symbol" />
              </th>
              <th className="data-th">Name</th>
              <th className="data-th data-th--right" onClick={() => toggleSort('lastTradedPrice')}>
                <span>Price (₹)</span><SortIcon k="lastTradedPrice" />
              </th>
              <th className="data-th data-th--right" onClick={() => toggleSort('changePct')}>
                <span>Change</span><SortIcon k="changePct" />
              </th>
              <th className="data-th data-th--right" onClick={() => toggleSort('volume')}>
                <span>Volume</span><SortIcon k="volume" />
              </th>
              <th className="data-th data-th--center">7D Chart</th>
              <th className="data-th data-th--center">Action</th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={7} className="data-td-empty">No symbols match "{query}"</td>
              </tr>
            ) : (
              displayed.map((s) => {
                const isUp = s.changePct >= 0;
                const flash = flashing[s.symbol];
                return (
                  <tr
                    key={s.symbol}
                    className={`data-row ${flash === 'up' ? 'data-row--flash-up' : flash === 'down' ? 'data-row--flash-down' : ''}`}
                    onClick={() => navigate(`/trade/${s.symbol}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="data-td">
                      <span className="market-symbol-badge">{s.symbol}</span>
                    </td>
                    <td className="data-td market-name-cell">{s.name}</td>
                    <td className="data-td data-td--right data-td--mono">₹{fmt(s.lastTradedPrice)}</td>
                    <td className="data-td data-td--right">
                      <div className={`market-change-pill ${isUp ? 'market-change-pill--up' : 'market-change-pill--down'}`}>
                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isUp ? '+' : ''}{s.changePct.toFixed(2)}%
                      </div>
                    </td>
                    <td className="data-td data-td--right data-td--mono text-gray-400">
                      {s.volume.toLocaleString('en-IN')}
                    </td>
                    <td className="data-td data-td--center">
                      <div className="market-sparkline">
                        {s.sparkline && s.sparkline.length > 0 && (
                          <SparklineChart data={s.sparkline} color={isUp ? '#26a69a' : '#ef5350'} isPositive={isUp} />
                        )}
                      </div>
                    </td>
                    <td className="data-td data-td--center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/trade/${s.symbol}`)}
                        className="market-trade-btn"
                        id={`trade-${s.symbol}`}
                      >
                        Trade
                      </button>
                    </td>
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
