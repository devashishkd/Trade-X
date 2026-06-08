import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/UI/Card';
import { apiClient } from '../../services/apiClient';

interface TradeRecord {
  _id: string;
  tradeId: string;
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: string | { $numberDecimal: string };
  quantity: number;
  fee: string | { $numberDecimal: string };
  total: string | { $numberDecimal: string };
  executedAt: string;
}

export const Trades: React.FC = () => {
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const res = await apiClient.get('/portfolio/trades?limit=100');
        if (res.data.success) {
          setTrades(res.data.data.trades || res.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch trades', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTrades();
  }, []);

  const getDecimalValue = (val: string | { $numberDecimal: string } | undefined | null) => {
    if (!val) return '0';
    if (typeof val === 'string') return val;
    return val.$numberDecimal || '0';
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-pulse text-indigo-400">Loading Trade History...</div></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Trade History</h1>

      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">Time</th>
                <th className="px-6 py-4 font-medium">Symbol</th>
                <th className="px-6 py-4 font-medium">Side</th>
                <th className="px-6 py-4 font-medium text-right">Price</th>
                <th className="px-6 py-4 font-medium text-right">Quantity</th>
                <th className="px-6 py-4 font-medium text-right">Fee</th>
                <th className="px-6 py-4 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    You haven't made any trades yet. <Link to="/market" className="text-indigo-400 hover:underline">Go to Market</Link>
                  </td>
                </tr>
              ) : (
                trades.map((t) => {
                  const price = parseFloat(getDecimalValue(t.price));
                  const fee = parseFloat(getDecimalValue(t.fee));
                  const total = parseFloat(getDecimalValue(t.total));
                  const isBuy = t.side === 'BUY';

                  return (
                    <tr key={t._id || t.tradeId} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                        {new Date(t.executedAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-bold text-white">
                        <Link to={`/trade/${t.symbol}`} className="hover:text-indigo-400 transition-colors">{t.symbol}</Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${isBuy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {t.side}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-gray-300">${price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-mono text-gray-300">{t.quantity}</td>
                      <td className="px-6 py-4 text-right font-mono text-gray-500">${fee.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-mono text-white">${total.toFixed(2)}</td>
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
