import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { OrderBook }    from '../../components/Trading/OrderBook';
import { OrderEntry }   from '../../components/Trading/OrderEntry';
import { TradingChart } from '../../components/Trading/TradingChart';
import { apiClient }    from '../../services/apiClient';
import { subscribeToSymbol, unsubscribeFromSymbol } from '../../services/socket';
import type { TickerUpdate, TradeEvent } from '../../services/socket';
import { TrendingUp, TrendingDown, Clock, Wifi, WifiOff, Search, X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface MarketData {
  lastTradedPrice: string;
  change:    string;
  changePct: string;
  highPrice: string;
  lowPrice:  string;
  openPrice?: string;
  volume:    number;
  name?:     string;
}

interface TradeFeedItem {
  tradeId:    string;
  price:      string;
  quantity:   number;
  makerSide:  'BUY' | 'SELL';
  executedAt: string;
}

interface SymbolOption { symbol: string; name: string; }

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (v: string | number, decimals = 2) =>
  parseFloat(String(v || 0)).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const istTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });

// ── Symbol Search Dropdown ─────────────────────────────────────────────────────
const SymbolSearch: React.FC<{
  current: string;
  symbols: SymbolOption[];
  onSelect: (sym: string) => void;
}> = ({ current, symbols, onSelect }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = symbols.filter(
    (s) =>
      s.symbol.toLowerCase().includes(query.toLowerCase()) ||
      s.name.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  return (
    <div className="symbol-search-wrapper">
      <button
        onClick={() => setOpen(!open)}
        className="symbol-search-trigger"
        id="symbol-selector"
      >
        <span className="symbol-search-current">{current}</span>
        <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div className="symbol-search-backdrop" onClick={() => setOpen(false)} />
          <div className="symbol-search-dropdown">
            <div className="symbol-search-input-row">
              <Search className="w-3.5 h-3.5 text-gray-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search symbol or name…"
                className="symbol-search-input"
              />
              {query && (
                <button onClick={() => setQuery('')} className="symbol-search-clear">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="symbol-search-list">
              {filtered.length === 0 ? (
                <div className="symbol-search-empty">No symbols found</div>
              ) : (
                filtered.map((s) => (
                  <button
                    key={s.symbol}
                    onClick={() => { onSelect(s.symbol); setOpen(false); setQuery(''); }}
                    className={`symbol-search-option ${s.symbol === current ? 'symbol-search-option--active' : ''}`}
                  >
                    <span className="symbol-search-option-sym">{s.symbol}</span>
                    <span className="symbol-search-option-name">{s.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ── Main TradePage ─────────────────────────────────────────────────────────────
export const TradePage: React.FC = () => {
  const { symbol = 'RELIANCE' } = useParams<{ symbol: string }>();
  const navigate = useNavigate();

  const [marketData,   setMarketData]   = useState<MarketData | null>(null);
  const [orderBook,    setOrderBook]    = useState<{ bids: [number,number][]; asks: [number,number][] }>({ bids: [], asks: [] });
  const [recentTrades, setRecentTrades] = useState<TradeFeedItem[]>([]);
  const [allSymbols,   setAllSymbols]   = useState<SymbolOption[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [isLive,       setIsLive]       = useState(false);

  // ── Fetch all symbols for the search dropdown ──────────────────────────────
  useEffect(() => {
    apiClient.get('/market/symbols').then((res) => {
      if (res.data.success) {
        setAllSymbols(
          res.data.data.map((s: any) => ({ symbol: s.symbol, name: s.name || s.symbol }))
        );
      }
    }).catch(() => {});
  }, []);

  // ── Initial data load ──────────────────────────────────────────────────────
  const fetchInitial = useCallback(async () => {
    try {
      const [quoteRes, depthRes, tradesRes] = await Promise.all([
        apiClient.get(`/market/${symbol}/quote`),
        apiClient.get(`/market/${symbol}/depth?levels=15`),
        apiClient.get(`/market/${symbol}/trades?limit=20`),
      ]);
      if (quoteRes.data.success)  setMarketData(quoteRes.data.data);
      if (depthRes.data.success)  setOrderBook(depthRes.data.data);
      if (tradesRes.data.success) setRecentTrades(tradesRes.data.data);
      setError(null);
    } catch {
      setError(`Unable to load market data for ${symbol}.`);
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  const fetchOrderBook = useCallback(async () => {
    try {
      const res = await apiClient.get(`/market/${symbol}/depth?levels=15`);
      if (res.data.success) setOrderBook(res.data.data);
    } catch { /* silent */ }
  }, [symbol]);

  useEffect(() => {
    setMarketData(null);
    setRecentTrades([]);
    setOrderBook({ bids: [], asks: [] });
    setError(null);
    setIsLoading(true);
    fetchInitial();
    const obInterval = setInterval(fetchOrderBook, 2000);
    return () => clearInterval(obInterval);
  }, [fetchInitial, fetchOrderBook, symbol]);

  // ── WebSocket subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const onTicker = (data: TickerUpdate) => {
      setIsLive(true);
      setMarketData((prev) => ({
        ...(prev ?? {}),
        lastTradedPrice: String(data.lastTradedPrice),
        change:    String(data.change),
        changePct: String(data.changePct),
        highPrice: String(data.highPrice),
        lowPrice:  String(data.lowPrice),
        volume:    data.volume,
      } as MarketData));
    };

    const onTrade = (data: TradeEvent) => {
      setRecentTrades((prev) => [
        { tradeId: data.tradeId, price: String(data.price), quantity: data.quantity, makerSide: data.makerSide, executedAt: data.executedAt },
        ...prev,
      ].slice(0, 20));
    };

    subscribeToSymbol(symbol, { onTicker, onTrade });
    return () => { setIsLive(false); unsubscribeFromSymbol(symbol); };
  }, [symbol]);

  const handleOrderPlaced = () => fetchOrderBook();

  const ltp       = parseFloat(marketData?.lastTradedPrice || '0');
  const change    = parseFloat(marketData?.change    || '0');
  const changePct = parseFloat(marketData?.changePct || '0');
  const isPositive = change >= 0;

  if (isLoading && !marketData) {
    return (
      <div className="trade-loading">
        <div className="chart-loading-spinner" />
        <span>Loading {symbol}…</span>
      </div>
    );
  }

  if (error && !marketData) {
    return (
      <div className="trade-error">
        <p>{error}</p>
        <button onClick={() => { setIsLoading(true); setError(null); fetchInitial(); }} className="trade-retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="trade-page">
      {/* ── Ticker Strip ─────────────────────────────────────────────── */}
      <div className="trade-ticker-strip">
        <div className="trade-ticker-left">
          {/* Dynamic symbol search */}
          <SymbolSearch
            current={symbol}
            symbols={allSymbols}
            onSelect={(sym) => navigate(`/trade/${sym}`)}
          />

          {marketData?.name && (
            <span className="trade-symbol-name">{marketData.name}</span>
          )}

          <div className="trade-ticker-divider" />

          {/* LTP */}
          <div className={`trade-ltp ${isPositive ? 'price-up' : 'price-down'}`}>
            ₹{fmt(ltp)}
          </div>

          {/* Change */}
          <div className={`trade-change ${isPositive ? 'price-up' : 'price-down'}`}>
            {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {isPositive ? '+' : ''}₹{fmt(change)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
          </div>

          {/* Live dot */}
          <div className={`trade-live-badge ${isLive ? 'trade-live-badge--live' : ''}`}>
            {isLive ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isLive ? 'LIVE' : 'CONNECTING'}
          </div>
        </div>

        {/* OHLV stats */}
        <div className="trade-ticker-stats">
          {[
            { label: 'Open',   value: `₹${fmt(marketData?.openPrice || '0')}` },
            { label: 'High',   value: `₹${fmt(marketData?.highPrice || '0')}` },
            { label: 'Low',    value: `₹${fmt(marketData?.lowPrice  || '0')}` },
            { label: 'Volume', value: (marketData?.volume || 0).toLocaleString('en-IN') },
          ].map(({ label, value }) => (
            <div key={label} className="trade-stat">
              <div className="trade-stat-label">{label}</div>
              <div className="trade-stat-value">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Area ─────────────────────────────────────────────────── */}
      <div className="trade-body">
        {/* Left: Chart + Recent trades */}
        <div className="trade-left-col">
          {/* Chart — TradingChartWrapper fills 100% of this container */}
          <div className="trade-chart-container">
            <TradingChart
              symbol={symbol}
              ltp={ltp}
              change={change}
              changePct={changePct}
            />
          </div>

          {/* Recent Trades feed */}
          <div className="trade-feed-card">
            <div className="trade-feed-header">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Recent Trades</span>
            </div>
            <div className="trade-feed-cols">
              <span>Price (₹)</span>
              <span>Qty</span>
              <span>Time (IST)</span>
            </div>
            <div className="trade-feed-list">
              {recentTrades.length === 0 ? (
                <div className="trade-feed-empty">No trades yet</div>
              ) : (
                recentTrades.map((t) => (
                  <div key={t.tradeId} className="trade-feed-row">
                    <span className={t.makerSide === 'SELL' ? 'price-up' : 'price-down'}>
                      {fmt(t.price)}
                    </span>
                    <span className="trade-feed-qty">{t.quantity.toLocaleString('en-IN')}</span>
                    <span className="trade-feed-time">{istTime(t.executedAt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Order Book + Order Entry */}
        <div className="trade-right-col">
          <OrderBook bids={orderBook.bids} asks={orderBook.asks} />
          <OrderEntry symbol={symbol} onOrderPlaced={handleOrderPlaced} />
        </div>
      </div>
    </div>
  );
};
