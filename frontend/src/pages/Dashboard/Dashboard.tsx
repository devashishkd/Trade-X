import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/UI/Card';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface PortfolioSummary {
  holdingsCount: number;
  totalInvested: string;
  totalCurrentValue: string;
  totalUnrealizedPnL: string;
  totalUnrealizedPnLPct: string;
  holdings: Array<{
    symbol: string;
    totalQty: number;
    avgCostBasis: string;
    currentPrice: string | null;
    currentValue: string | null;
    unrealizedPnL: string | null;
    unrealizedPnLPct: string | null;
  }>;
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<{ availableBalance: string; lockedBalance: string } | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [walletRes, portfolioRes] = await Promise.all([
          apiClient.get('/wallet/balance'),
          apiClient.get('/portfolio/summary')
        ]);
        
        if (walletRes.data.success) setWallet(walletRes.data.data);
        if (portfolioRes.data.success) setPortfolio(portfolioRes.data.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-pulse text-indigo-400">Loading Dashboard...</div></div>;
  }

  const totalValue = parseFloat(wallet?.availableBalance || '0') + 
                     parseFloat(wallet?.lockedBalance || '0') + 
                     parseFloat(portfolio?.totalCurrentValue || '0');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Welcome, {user?.username}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border-indigo-500/30">
          <div className="text-gray-400 text-sm font-medium mb-1 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-indigo-400" /> Total Net Value
          </div>
          <div className="text-3xl font-bold text-white">${totalValue.toFixed(2)}</div>
        </Card>

        <Card>
          <div className="text-gray-400 text-sm font-medium mb-1">Available Cash</div>
          <div className="text-2xl font-bold text-white mb-2">${parseFloat(wallet?.availableBalance || '0').toFixed(2)}</div>
          <div className="text-xs text-gray-500">Locked: ${parseFloat(wallet?.lockedBalance || '0').toFixed(2)}</div>
        </Card>

        <Card>
          <div className="text-gray-400 text-sm font-medium mb-1">Unrealized P&L</div>
          <div className={`text-2xl font-bold flex items-center gap-2 ${parseFloat(portfolio?.totalUnrealizedPnL || '0') >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {parseFloat(portfolio?.totalUnrealizedPnL || '0') >= 0 ? '+' : ''}${parseFloat(portfolio?.totalUnrealizedPnL || '0').toFixed(2)}
            <span className="text-sm font-medium bg-black/20 px-2 py-0.5 rounded">
              {portfolio?.totalUnrealizedPnLPct}%
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-2">Total Invested: ${portfolio?.totalInvested}</div>
        </Card>
      </div>

      <Card title="Your Portfolio Holdings" noPadding>
        {portfolio?.holdings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            You don't have any holdings yet. <Link to="/trade/AAPL" className="text-indigo-400 hover:underline">Start trading</Link>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 border-b border-white/10 text-gray-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Asset</th>
                  <th className="px-6 py-3 font-medium text-right">Quantity</th>
                  <th className="px-6 py-3 font-medium text-right">Avg Cost</th>
                  <th className="px-6 py-3 font-medium text-right">Current Price</th>
                  <th className="px-6 py-3 font-medium text-right">P&L</th>
                  <th className="px-6 py-3 font-medium text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {portfolio?.holdings.map((h) => {
                  const pnl = parseFloat(h.unrealizedPnL || '0');
                  const isPositive = pnl >= 0;
                  return (
                    <tr key={h.symbol} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-bold text-white">{h.symbol}</td>
                      <td className="px-6 py-4 text-right font-mono text-gray-300">{h.totalQty}</td>
                      <td className="px-6 py-4 text-right font-mono text-gray-300">${h.avgCostBasis}</td>
                      <td className="px-6 py-4 text-right font-mono text-white">${h.currentPrice || '—'}</td>
                      <td className={`px-6 py-4 text-right font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        <div className="flex items-center justify-end gap-1">
                          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {isPositive ? '+' : ''}${pnl.toFixed(2)}
                        </div>
                        <div className="text-xs opacity-80">{h.unrealizedPnLPct}%</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Link 
                          to={`/trade/${h.symbol}`} 
                          className="px-3 py-1.5 text-xs font-medium bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40 rounded transition-colors"
                        >
                          Trade
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
