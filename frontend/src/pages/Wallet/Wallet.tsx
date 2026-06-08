import React, { useEffect, useState } from 'react';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { apiClient } from '../../services/apiClient';
import { Wallet as WalletIcon, ArrowDownToLine, Activity } from 'lucide-react';

interface Transaction {
  id: string;
  type: string;
  amount: string;
  status: string;
  createdAt: string;
}

export const Wallet: React.FC = () => {
  const [balance, setBalance] = useState<{ availableBalance: string; lockedBalance: string }>({ availableBalance: '0', lockedBalance: '0' });
  const [depositAmount, setDepositAmount] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDepositing, setIsDepositing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Dummy transactions for visual effect
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const fetchWallet = async () => {
    try {
      const res = await apiClient.get('/wallet/balance');
      if (res.data.success) {
        setBalance(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch wallet', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const amount = Number(depositAmount);

    if (!amount || amount <= 0) {
      setMessage({ type: 'error', text: 'Enter a valid amount to deposit' });
      return;
    }

    setIsDepositing(true);
    try {
      const res = await apiClient.post('/wallet/deposit', { amount });
      if (res.data.success) {
        setMessage({ type: 'success', text: `Successfully deposited $${amount.toFixed(2)}` });
        setDepositAmount('');
        // Add fake transaction
        setTransactions(prev => [{
          id: Math.random().toString(36).substr(2, 9),
          type: 'DEPOSIT',
          amount: amount.toString(),
          status: 'COMPLETED',
          createdAt: new Date().toISOString()
        }, ...prev]);
        fetchWallet();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error?.message || 'Deposit failed' });
    } finally {
      setIsDepositing(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-pulse text-indigo-400">Loading Wallet...</div></div>;
  }

  const totalBalance = parseFloat(balance.availableBalance) + parseFloat(balance.lockedBalance);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-indigo-500/20 rounded-xl">
          <WalletIcon className="w-8 h-8 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Wallet Overview</h1>
          <p className="text-gray-400">Manage your fiat balances and transaction history</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border-indigo-500/30 md:col-span-1">
          <div className="text-gray-400 text-sm font-medium mb-1">Total USD Balance</div>
          <div className="text-4xl font-bold text-white mb-4">${totalBalance.toFixed(2)}</div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Available</span>
              <span className="text-emerald-400 font-medium">${parseFloat(balance.availableBalance).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">In Orders (Locked)</span>
              <span className="text-gray-300 font-medium">${parseFloat(balance.lockedBalance).toFixed(2)}</span>
            </div>
          </div>
        </Card>

        <Card className="md:col-span-2" title="Fund Your Account">
          <p className="text-sm text-gray-400 mb-6">
            For this test environment, you can instantly deposit fake USD to trade with. 
            No real money is involved.
          </p>
          
          <form onSubmit={handleDeposit} className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-2">Deposit Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                <input
                  type="number"
                  step="100"
                  min="1"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 pl-8 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-all"
                  placeholder="10000"
                />
              </div>
            </div>
            <Button type="submit" isLoading={isDepositing} className="px-8 flex items-center gap-2">
              <ArrowDownToLine className="w-4 h-4"/> Deposit Funds
            </Button>
          </form>

          {message && (
            <div className={`mt-4 px-4 py-3 rounded-md text-sm border ${
              message.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              {message.text}
            </div>
          )}
        </Card>
      </div>

      <Card title={<div className="flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-400"/> Recent Transactions</div>} noPadding>
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No recent transactions
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-gray-400">
              <tr>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium text-right">Amount</th>
                <th className="px-6 py-3 font-medium text-center">Status</th>
                <th className="px-6 py-3 font-medium text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.map(t => (
                <tr key={t.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium flex items-center gap-2">
                    <ArrowDownToLine className="w-4 h-4 text-emerald-400"/>
                    {t.type}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-emerald-400">+${parseFloat(t.amount).toFixed(2)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs">
                      {t.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-400">
                    {new Date(t.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
};
