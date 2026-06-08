import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/UI/Card';
import { apiClient } from '../../services/apiClient';
import { PieChart } from 'lucide-react';

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

export const Portfolio: React.FC = () => {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const res = await apiClient.get('/portfolio/summary');
        if (res.data.success) {
          setPortfolio(res.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch portfolio', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPortfolio();
  }, []);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-pulse text-indigo-400">Loading Portfolio Data...</div></div>;
  }

  const invested = parseFloat(portfolio?.totalInvested || '0');
  const currentValue = parseFloat(portfolio?.totalCurrentValue || '0');
  const pnl = parseFloat(portfolio?.totalUnrealizedPnL || '0');
  const pnlPct = parseFloat(portfolio?.totalUnrealizedPnLPct || '0');
  const isPositive = pnl >= 0;

  // Asset allocation visual logic
  const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500'];
  const sortedHoldings = [...(portfolio?.holdings || [])].sort((a, b) => parseFloat(b.currentValue || '0') - parseFloat(a.currentValue || '0'));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <PieChart className="w-6 h-6 text-indigo-400" /> My Portfolio
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="col-span-1 md:col-span-2 bg-gradient-to-br from-indigo-900/20 to-black/40 border-indigo-500/20">
          <div className="text-gray-400 text-sm font-medium mb-1">Total Current Value</div>
          <div className="text-4xl font-bold text-white mb-4">${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          
          {sortedHoldings.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="text-xs text-gray-500 mb-2">Asset Allocation</div>
              <div className="h-2 w-full bg-black/40 rounded-full flex overflow-hidden">
                {sortedHoldings.map((h, i) => {
                  const val = parseFloat(h.currentValue || '0');
                  const width = currentValue > 0 ? (val / currentValue) * 100 : 0;
                  return (
                    <div 
                      key={h.symbol} 
                      className={`${colors[i % colors.length]} h-full transition-all duration-500`}
                      style={{ width: `${width}%` }}
                      title={`${h.symbol}: ${width.toFixed(1)}%`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3 mt-3">
                {sortedHoldings.slice(0, 4).map((h, i) => (
                  <div key={h.symbol} className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className={`w-2 h-2 rounded-full ${colors[i % colors.length]}`}></span>
                    {h.symbol}
                  </div>
                ))}
                {sortedHoldings.length > 4 && <div className="text-xs text-gray-500">+{sortedHoldings.length - 4} more</div>}
              </div>
            </div>
          )}
        </Card>

        <Card className="bg-black/20">
          <div className="text-gray-400 text-sm font-medium mb-1">Total Invested</div>
          <div className="text-2xl font-bold text-white mb-2">${invested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </Card>

        <Card className="bg-black/20">
          <div className="text-gray-400 text-sm font-medium mb-1">Unrealized P&L</div>
          <div className={`text-2xl font-bold flex items-center gap-2 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-sm mt-1 font-medium ${isPositive ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
            {isPositive ? '▲' : '▼'} {pnlPct.toFixed(2)}% All-time
          </div>
        </Card>
      </div>

      <Card title={`Holdings (${portfolio?.holdingsCount || 0})`} noPadding>
        {portfolio?.holdings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Your portfolio is empty. <Link to="/market" className="text-indigo-400 hover:underline">Explore the markets</Link>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 border-b border-white/10 text-gray-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Asset</th>
                  <th className="px-6 py-4 font-medium text-right">Quantity</th>
                  <th className="px-6 py-4 font-medium text-right">Avg Cost</th>
                  <th className="px-6 py-4 font-medium text-right">Current Price</th>
                  <th className="px-6 py-4 font-medium text-right">Total Value</th>
                  <th className="px-6 py-4 font-medium text-right">Unrealized P&L</th>
                  <th className="px-6 py-4 font-medium text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedHoldings.map((h) => {
                  const hpnl = parseFloat(h.unrealizedPnL || '0');
                  const hpnlPct = parseFloat(h.unrealizedPnLPct || '0');
                  const hIsPositive = hpnl >= 0;
                  
                  return (
                    <tr key={h.symbol} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-bold text-white">{h.symbol}</td>
                      <td className="px-6 py-4 text-right font-mono text-gray-300">{h.totalQty.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-mono text-gray-400">${parseFloat(h.avgCostBasis).toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-mono text-white">${parseFloat(h.currentPrice || '0').toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-mono text-white">${parseFloat(h.currentValue || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className={`px-6 py-4 text-right font-mono ${hIsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        <div className="flex items-center justify-end gap-1">
                          {hIsPositive ? '+' : ''}${hpnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs opacity-80">{hpnlPct.toFixed(2)}%</div>
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
