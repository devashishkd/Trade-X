import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/UI/Card';
import { apiClient } from '../../services/apiClient';
import { useAuthStore } from '../../store/useAuthStore';
import { TrendingUp, TrendingDown, DollarSign, Wallet, ArrowRight, BarChart2 } from 'lucide-react';

interface MarketSymbol {
  symbol: string;
  name: string;
  lastTradedPrice: string | { $numberDecimal: string };
  change: string | { $numberDecimal: string };
  changePct: string | { $numberDecimal: string };
  volume: number;
}

export const Dashboard: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const [wallet, setWallet] = useState<{ availableBalance: string; lockedBalance: string } | null>(null);
  const [hotPairs, setHotPairs] = useState<MarketSymbol[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [walletRes, marketRes] = await Promise.all([
          apiClient.get('/wallet/balance'),
          apiClient.get('/market/symbols')
        ]);
        
        if (walletRes.data.success) setWallet(walletRes.data.data);
        if (marketRes.data.success) {
          // Sort by highest volume for 'Hot Pairs'
          const sorted = [...marketRes.data.data].sort((a, b) => b.volume - a.volume).slice(0, 5);
          setHotPairs(sorted);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const getDecimalValue = (val: string | { $numberDecimal: string } | undefined | null) => {
    if (!val) return '0';
    if (typeof val === 'string') return val;
    return val.$numberDecimal || '0';
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-pulse text-indigo-400">Loading Overview...</div></div>;
  }

  const available = parseFloat(wallet?.availableBalance || '0');
  const locked = parseFloat(wallet?.lockedBalance || '0');
  const totalBalance = available + locked;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome back, {user?.username}</h1>
          <p className="text-gray-400 text-sm mt-1">Here's what's happening in the markets today.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/wallet" className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Deposit
          </Link>
          <Link to="/market" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2">
            <BarChart2 className="w-4 h-4" /> View Markets
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border-indigo-500/30">
          <div className="text-indigo-200 text-sm font-medium mb-1 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-indigo-400" /> Estimated Balance
          </div>
          <div className="text-4xl font-bold text-white mb-4">${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          
          <div className="flex items-center justify-between border-t border-indigo-500/20 pt-4 mt-2">
            <div>
              <div className="text-xs text-indigo-300/70 mb-1">Available Cash</div>
              <div className="text-sm font-medium text-white">${available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-indigo-300/70 mb-1">Locked in Orders</div>
              <div className="text-sm font-medium text-white">${locked.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>
        </Card>

        <Card title="Quick Portfolio Link" className="flex flex-col justify-center items-center text-center p-8 bg-black/20">
            <div className="w-16 h-16 bg-indigo-600/20 rounded-full flex items-center justify-center mb-4">
              <BarChart2 className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">View Your Investments</h3>
            <p className="text-sm text-gray-400 mb-6 max-w-sm">
              Head over to your dedicated Portfolio page to track your holdings, average costs, and unrealized P&L in detail.
            </p>
            <Link to="/portfolio" className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors">
              Go to Portfolio <ArrowRight className="w-4 h-4" />
            </Link>
        </Card>
      </div>

      <Card title="Hot Pairs (Top by Volume)" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">Symbol</th>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium text-right">Price</th>
                <th className="px-6 py-4 font-medium text-right">24h Change</th>
                <th className="px-6 py-4 font-medium text-right">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {hotPairs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No market data available.
                  </td>
                </tr>
              ) : (
                hotPairs.map((s) => {
                  const price = parseFloat(getDecimalValue(s.lastTradedPrice));
                  const change = parseFloat(getDecimalValue(s.change));
                  const changePct = parseFloat(getDecimalValue(s.changePct));
                  const isPositive = change >= 0;

                  return (
                    <tr key={s.symbol} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <Link to={`/trade/${s.symbol}`} className="font-bold text-indigo-400 hover:underline">{s.symbol}</Link>
                      </td>
                      <td className="px-6 py-4 text-gray-300">{s.name}</td>
                      <td className="px-6 py-4 text-right font-mono text-white">${price.toFixed(2)}</td>
                      <td className={`px-6 py-4 text-right font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        <div className="flex items-center justify-end gap-1">
                          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {isPositive ? '+' : ''}{change.toFixed(2)} ({changePct.toFixed(2)}%)
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-gray-400">{s.volume.toLocaleString()}</td>
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
