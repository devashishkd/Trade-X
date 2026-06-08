import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/UI/Card';
import { apiClient } from '../../services/apiClient';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MarketSymbol {
  symbol: string;
  name: string;
  lastTradedPrice: string | { $numberDecimal: string };
  change: string | { $numberDecimal: string };
  changePct: string | { $numberDecimal: string };
  volume: number;
}

export const Market: React.FC = () => {
  const [symbols, setSymbols] = useState<MarketSymbol[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        const res = await apiClient.get('/market/symbols');
        if (res.data.success) {
          setSymbols(res.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch market symbols', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSymbols();
  }, []);

  const getDecimalValue = (val: string | { $numberDecimal: string } | undefined | null) => {
    if (!val) return '0';
    if (typeof val === 'string') return val;
    return val.$numberDecimal || '0';
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-pulse text-indigo-400">Loading Market Data...</div></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Market Overview</h1>

      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">Symbol</th>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium text-right">Price</th>
                <th className="px-6 py-4 font-medium text-right">24h Change</th>
                <th className="px-6 py-4 font-medium text-right">Volume</th>
                <th className="px-6 py-4 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {symbols.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No market data available.
                  </td>
                </tr>
              ) : (
                symbols.map((s) => {
                  const price = parseFloat(getDecimalValue(s.lastTradedPrice));
                  const change = parseFloat(getDecimalValue(s.change));
                  const changePct = parseFloat(getDecimalValue(s.changePct));
                  const isPositive = change >= 0;

                  return (
                    <tr key={s.symbol} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-bold text-white">{s.symbol}</td>
                      <td className="px-6 py-4 text-gray-300">{s.name}</td>
                      <td className="px-6 py-4 text-right font-mono text-white">${price.toFixed(2)}</td>
                      <td className={`px-6 py-4 text-right font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        <div className="flex items-center justify-end gap-1">
                          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {isPositive ? '+' : ''}{change.toFixed(2)} ({changePct.toFixed(2)}%)
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-gray-400">{s.volume.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center">
                        <Link 
                          to={`/trade/${s.symbol}`} 
                          className="px-3 py-1.5 text-xs font-medium bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40 rounded transition-colors"
                        >
                          Trade
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
