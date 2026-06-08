import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { OrderBook } from '../../components/Trading/OrderBook';
import { OrderEntry } from '../../components/Trading/OrderEntry';
import { TradingChart } from '../../components/Trading/TradingChart';
import { Card } from '../../components/UI/Card';
import { apiClient } from '../../services/apiClient';
import { TrendingUp, TrendingDown, Clock, Activity } from 'lucide-react';

interface MarketData {
  lastTradedPrice: string;
  change: string;
  changePct: string;
  highPrice: string;
  lowPrice: string;
  volume: number;
}

interface TradeFeedItem {
  tradeId: string;
  price: string;
  quantity: number;
  makerSide: 'BUY' | 'SELL';
  executedAt: string;
}

export const TradePage: React.FC = () => {
  const { symbol = 'AAPL' } = useParams<{ symbol: string }>();
  const navigate = useNavigate();

  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [orderBook, setOrderBook] = useState<{ bids: [number, number][], asks: [number, number][] }>({ bids: [], asks: [] });
  const [recentTrades, setRecentTrades] = useState<TradeFeedItem[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState('5Y');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarketData = useCallback(async () => {
    try {
      const [quoteRes, depthRes, tradesRes] = await Promise.all([
        apiClient.get(`/market/${symbol}/quote`),
        apiClient.get(`/market/${symbol}/depth?levels=15`),
        apiClient.get(`/market/${symbol}/trades?limit=20`)
      ]);

      if (quoteRes.data.success) setMarketData(quoteRes.data.data);
      if (depthRes.data.success) setOrderBook(depthRes.data.data);
      if (tradesRes.data.success) setRecentTrades(tradesRes.data.data);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch market data', error);
      setError(`Unable to load market data for ${symbol}.`);
      setMarketData(null);
      setRecentTrades([]);
      setOrderBook({ bids: [], asks: [] });
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  // Short polling for phase 1
  useEffect(() => {
    // Clear state when symbol changes
    setMarketData(null);
    setRecentTrades([]);
    setOrderBook({ bids: [], asks: [] });
    setError(null);
    setIsLoading(true);

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 2000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  const fetchChartHistory = useCallback(async () => {
    try {
      const res = await apiClient.get(`/market/${symbol}/history?timeframe=${timeframe}`);
      if (res.data.success) {
        setChartData(res.data.data);
      }
    } catch (e) {
      console.error('Failed to fetch historical data', e);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    fetchChartHistory();
  }, [fetchChartHistory]);

  const handleOrderPlaced = () => {
    // Immediately fetch to show updated book
    fetchMarketData();
  };

  const isPositive = parseFloat(marketData?.change || '0') >= 0;

  if (isLoading && !marketData) {
    return <div className="flex items-center justify-center h-full"><div className="animate-pulse text-indigo-400">Loading Market Data...</div></div>;
  }

  if (error && !marketData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-red-400">{error}</div>
        <button
          onClick={() => {
            setIsLoading(true);
            setError(null);
            fetchMarketData();
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-4 max-w-[1600px] mx-auto">
      {/* Ticker Header */}
      <Card className="flex-none p-4" noPadding>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="relative flex items-center">
              <select
                value={symbol}
                onChange={(e) => navigate(`/trade/${e.target.value}`)}
                className="text-3xl font-bold text-white bg-transparent outline-none cursor-pointer hover:bg-white/5 rounded pl-2 pr-8 py-1 -ml-2 appearance-none z-10"
              >
                <option value="AAPL" className="bg-gray-900 text-base">AAPL</option>
                <option value="TSLA" className="bg-gray-900 text-base">TSLA</option>
                <option value="MSFT" className="bg-gray-900 text-base">MSFT</option>
                <option value="AMZN" className="bg-gray-900 text-base">AMZN</option>
                <option value="GOOG" className="bg-gray-900 text-base">GOOG</option>
              </select>
              <div className="absolute right-2 text-indigo-400 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </div>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className={`text-2xl font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              ${parseFloat(marketData?.lastTradedPrice || '0').toFixed(2)}
            </div>
            <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {isPositive ? '+' : ''}{parseFloat(marketData?.change || '0').toFixed(2)} ({parseFloat(marketData?.changePct || '0').toFixed(2)}%)
            </div>
          </div>

          <div className="flex gap-8 text-sm text-gray-400">
            <div>
              <div className="text-xs mb-1">24h High</div>
              <div className="font-mono text-white">${parseFloat(marketData?.highPrice || '0').toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs mb-1">24h Low</div>
              <div className="font-mono text-white">${parseFloat(marketData?.lowPrice || '0').toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs mb-1">24h Volume</div>
              <div className="font-mono text-white">{marketData?.volume.toLocaleString() || '0'}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Trading Area */}
      <div className="flex-1 flex flex-row gap-4 min-h-0">

        {/* Left Column: Chart & Recent Trades */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto pr-2 pb-4">
          <Card 
            className="flex-1 flex flex-col min-h-[300px]" 
            contentClassName="flex flex-col min-h-0"
            title={
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" /> Price Chart
                </div>
                <div className="flex bg-white/5 rounded p-1 gap-1">
                  {['1D', '1W', '1M', '1Y', '5Y'].map(tf => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-3 py-1 text-xs font-semibold rounded transition ${
                        timeframe === tf 
                          ? 'bg-indigo-600 text-white' 
                          : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
            }>
            <div className="flex-1 rounded-md overflow-hidden bg-black/20 relative min-h-0">
              <TradingChart
                symbol={symbol}
                data={chartData}
              />
            </div>
          </Card>

          <Card className="flex-1 min-h-[250px] overflow-hidden" title={<div className="flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-400" /> Recent Trades</div>} noPadding>
            <div className="flex text-xs font-semibold text-gray-500 px-4 py-2 border-b border-white/10">
              <div className="flex-1">Price(USD)</div>
              <div className="flex-1 text-right">Size</div>
              <div className="flex-1 text-right">Time</div>
            </div>
            <div className="overflow-y-auto h-[calc(100%-37px)]">
              {recentTrades.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">No recent trades</div>
              ) : (
                recentTrades.map((t) => (
                  <div key={t.tradeId} className="flex px-4 py-1.5 hover:bg-white/5 font-mono text-sm">
                    <div className={`flex-1 ${t.makerSide === 'SELL' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {parseFloat(t.price).toFixed(2)}
                    </div>
                    <div className="flex-1 text-right text-gray-300">{t.quantity}</div>
                    <div className="flex-1 text-right text-gray-500">
                      {new Date(t.executedAt).toLocaleTimeString([], { hour12: false })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Order Book & Order Entry */}
        <div className="w-full md:w-[320px] xl:w-[350px] flex flex-col gap-4 shrink-0 overflow-y-auto pb-4 pr-2">
          <div className="flex-1 min-h-[400px]">
            <OrderBook bids={orderBook.bids} asks={orderBook.asks} />
          </div>
          <div className="shrink-0">
            <OrderEntry symbol={symbol} onOrderPlaced={handleOrderPlaced} />
          </div>
        </div>
      </div>
    </div>
  );
};
