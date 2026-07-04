import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/apiClient';
import { TrendingUp, TrendingDown, Wallet, ArrowRight, Activity } from 'lucide-react';
import { SparklineChart } from '../../components/Trading/SparklineChart';

interface MarketSymbol {
  symbol: string;
  name: string;
  lastTradedPrice: string | { $numberDecimal: string };
  change: string | { $numberDecimal: string };
  changePct: string | { $numberDecimal: string };
  volume: number;
}

const getDecimalValue = (val: string | { $numberDecimal: string } | undefined | null) => {
  if (!val) return '0';
  if (typeof val === 'string') return val;
  return val.$numberDecimal || '0';
};

// --- Sub-components ---

const MarketOverviewCard: React.FC<{ symbol: MarketSymbol }> = ({ symbol }) => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await apiClient.get(`/market/${symbol.symbol}/history?timeframe=1W`);
        if (res.data.success && res.data.data) {
          setHistory(res.data.data.map((d: any) => ({ time: d.time, value: d.close })));
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchHistory();
  }, [symbol.symbol]);

  const price = parseFloat(getDecimalValue(symbol.lastTradedPrice));
  const changePct = parseFloat(getDecimalValue(symbol.changePct));
  const isPositive = changePct >= 0;

  return (
    <div 
      onClick={() => navigate(`/trade/${symbol.symbol}`)}
      className="bg-black/30 backdrop-blur-md border border-white/5 rounded-2xl p-5 cursor-pointer hover:bg-white/5 hover:border-cyan-500/30 hover:-translate-y-1 transition-all group relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">{symbol.symbol}</h3>
          <p className="text-xs text-gray-500">{symbol.name}</p>
        </div>
        <div className={`px-2 py-1 rounded flex items-center gap-1 text-xs font-semibold ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isPositive ? '+' : ''}{changePct.toFixed(2)}%
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div className="text-2xl font-mono text-white font-bold tracking-tight">
          ${price.toFixed(2)}
        </div>
        <div className="w-24 h-12">
          {history.length > 0 && (
            <SparklineChart data={history} color={isPositive ? '#06b6d4' : '#ef4444'} isPositive={isPositive} />
          )}
        </div>
      </div>
    </div>
  );
};

const TrendingListItem: React.FC<{ symbol: MarketSymbol, type: 'gainer' | 'loser' | 'volume' }> = ({ symbol, type }) => {
  const navigate = useNavigate();
  const price = parseFloat(getDecimalValue(symbol.lastTradedPrice));
  const changePct = parseFloat(getDecimalValue(symbol.changePct));
  const isPositive = changePct >= 0;

  return (
    <div 
      onClick={() => navigate(`/trade/${symbol.symbol}`)}
      className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center font-bold text-xs text-gray-300 group-hover:text-cyan-400 group-hover:bg-cyan-500/10 transition-all">
          {symbol.symbol.substring(0, 1)}
        </div>
        <div>
          <div className="font-bold text-white text-sm group-hover:text-cyan-400 transition-colors">{symbol.symbol}</div>
          <div className="text-xs text-gray-500">{symbol.name}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm text-white">${price.toFixed(2)}</div>
        {type === 'volume' ? (
          <div className="text-xs text-gray-400 font-mono">Vol: {symbol.volume.toLocaleString()}</div>
        ) : (
          <div className={`text-xs font-mono flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{changePct.toFixed(2)}%
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main Dashboard ---

export const Dashboard: React.FC = () => {

  const [wallet, setWallet] = useState<{ availableBalance: string; lockedBalance: string } | null>(null);
  const [symbols, setSymbols] = useState<MarketSymbol[]>([]);
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
          setSymbols(marketRes.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-pulse text-cyan-400">Loading Dashboard...</div></div>;
  }

  const available = parseFloat(wallet?.availableBalance || '0');
  const locked = parseFloat(wallet?.lockedBalance || '0');
  const totalBalance = available + locked;

  // Sorting logics
  const topOverview = [...symbols].sort((a, b) => b.volume - a.volume).slice(0, 4);
  
  const topGainers = [...symbols]
    .sort((a, b) => parseFloat(getDecimalValue(b.changePct)) - parseFloat(getDecimalValue(a.changePct)))
    .slice(0, 5);
    
  const topLosers = [...symbols]
    .sort((a, b) => parseFloat(getDecimalValue(a.changePct)) - parseFloat(getDecimalValue(b.changePct)))
    .slice(0, 5);
    
  const topVolume = [...symbols]
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5);

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      
      {/* --- HERO SECTION --- */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#020617] via-[#0f172a] to-[#020617] border border-cyan-900/30 shadow-[0_0_40px_rgba(6,182,212,0.1)] p-8 md:p-12">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div>
            <div className="text-cyan-400 text-sm font-semibold tracking-wider uppercase mb-2 flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Estimated Balance
            </div>
            <div className="text-5xl md:text-6xl font-bold text-white mb-2 drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-4 text-sm mt-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Available:</span>
                <span className="text-white font-mono">${available.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="w-1 h-1 bg-gray-700 rounded-full" />
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Locked:</span>
                <span className="text-white font-mono">${locked.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Link to="/wallet" className="px-6 py-3 bg-white hover:bg-gray-100 text-black rounded-xl text-sm font-bold transition-all hover:scale-105 flex items-center justify-center gap-2">
              Deposit
            </Link>
            <Link to="/portfolio" className="px-6 py-3 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 rounded-xl text-sm font-bold transition-all hover:scale-105 flex items-center justify-center gap-2">
              View Portfolio <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* --- MARKET OVERVIEW --- */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" /> Market Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {topOverview.map(symbol => (
            <MarketOverviewCard key={symbol.symbol} symbol={symbol} />
          ))}
        </div>
      </div>

      {/* --- TRENDING LISTS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Gainers */}
        <div className="bg-black/20 backdrop-blur-sm border border-white/5 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            🚀 Top Gainers
          </h3>
          <div className="flex flex-col gap-1">
            {topGainers.map(s => <TrendingListItem key={s.symbol} symbol={s} type="gainer" />)}
          </div>
        </div>

        {/* Top Losers */}
        <div className="bg-black/20 backdrop-blur-sm border border-white/5 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            🩸 Top Losers
          </h3>
          <div className="flex flex-col gap-1">
            {topLosers.map(s => <TrendingListItem key={s.symbol} symbol={s} type="loser" />)}
          </div>
        </div>

        {/* Highest Volume */}
        <div className="bg-black/20 backdrop-blur-sm border border-white/5 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            📊 Highest Volume
          </h3>
          <div className="flex flex-col gap-1">
            {topVolume.map(s => <TrendingListItem key={s.symbol} symbol={s} type="volume" />)}
          </div>
        </div>

      </div>

    </div>
  );
};
