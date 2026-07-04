import React, { useState } from 'react';
import { apiClient } from '../../services/apiClient';

interface OrderEntryProps {
  symbol: string;
  onOrderPlaced?: () => void;
}

export const OrderEntry: React.FC<OrderEntryProps> = ({ symbol, onOrderPlaced }) => {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [type, setType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
      setError('Enter a valid quantity');
      return;
    }

    if (type === 'LIMIT' && (!price || isNaN(Number(price)) || Number(price) <= 0)) {
      setError('Enter a valid price');
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post('/orders', {
        symbol,
        side,
        type,
        quantity: Number(quantity),
        price: type === 'LIMIT' ? Number(price) : undefined,
      });
      
      setQuantity('');
      if (type === 'LIMIT') setPrice('');
      if (onOrderPlaced) onOrderPlaced();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to place order');
    } finally {
      setIsLoading(false);
    }
  };

  const isBuy = side === 'BUY';

  return (
    <div className="flex flex-col h-full bg-[#151822] p-4">
      {/* ── Tabs: Limit / Market ───────────────────────────────────── */}
      <div className="flex gap-4 mb-4 border-b border-[#1f2430]">
        <button
          onClick={() => setType('LIMIT')}
          className={`pb-2 text-[13px] font-semibold border-b-2 transition-colors ${type === 'LIMIT' ? 'border-[#2962ff] text-white' : 'border-transparent text-[#848e9c] hover:text-[#d1d4dc]'}`}
        >
          Limit
        </button>
        <button
          onClick={() => setType('MARKET')}
          className={`pb-2 text-[13px] font-semibold border-b-2 transition-colors ${type === 'MARKET' ? 'border-[#2962ff] text-white' : 'border-transparent text-[#848e9c] hover:text-[#d1d4dc]'}`}
        >
          Market
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1">
        {error && (
          <div className="mb-4 bg-[#f6465d]/10 border border-[#f6465d]/20 text-[#f6465d] text-xs px-3 py-2 rounded">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {/* Price Input (only for Limit) */}
          {type === 'LIMIT' && (
            <div className="relative flex items-center bg-[#0b0e14] border border-[#1f2430] rounded focus-within:border-[#2962ff] transition-colors">
              <span className="pl-3 text-xs font-medium text-[#4b5563]">Price</span>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-transparent border-none outline-none py-2 px-2 text-right text-sm text-white font-medium"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              />
              <span className="pr-3 text-xs font-medium text-[#848e9c]">USD</span>
            </div>
          )}

          {/* Quantity Input */}
          <div className="relative flex items-center bg-[#0b0e14] border border-[#1f2430] rounded focus-within:border-[#2962ff] transition-colors">
            <span className="pl-3 text-xs font-medium text-[#4b5563]">Amount</span>
            <input
              type="number"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-transparent border-none outline-none py-2 px-2 text-right text-sm text-white font-medium"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            />
            <span className="pr-3 text-xs font-medium text-[#848e9c]">{symbol}</span>
          </div>

          {/* Quick Percentages */}
          <div className="flex items-center justify-between gap-1 mt-1">
            {[25, 50, 75, 100].map(pct => (
              <button 
                key={pct}
                type="button"
                className="flex-1 py-1 text-[10px] font-semibold text-[#848e9c] bg-[#1c202d] rounded hover:bg-[#2B2B43] hover:text-white transition-colors"
                onClick={() => { /* In a real app, calculate % of wallet balance */ }}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* ── Buy / Sell Actions ───────────────────────────────────── */}
        <div className="mt-auto pt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setSide('BUY')}
            className={`flex-1 py-3 text-[13px] font-bold rounded transition-all ${isBuy ? 'bg-[#0ecb81] text-white shadow-[0_0_12px_rgba(14,203,129,0.4)]' : 'bg-[#1c202d] text-[#848e9c] hover:bg-[#2B2B43]'}`}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => setSide('SELL')}
            className={`flex-1 py-3 text-[13px] font-bold rounded transition-all ${!isBuy ? 'bg-[#f6465d] text-white shadow-[0_0_12px_rgba(246,70,93,0.4)]' : 'bg-[#1c202d] text-[#848e9c] hover:bg-[#2B2B43]'}`}
          >
            Sell
          </button>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full mt-3 py-3 text-[14px] font-bold rounded text-white transition-all 
            ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}
            ${isBuy ? 'bg-[#0ecb81] hover:bg-[#0b9e65]' : 'bg-[#f6465d] hover:bg-[#c9384b]'}`}
        >
          {isLoading ? 'Processing...' : `${isBuy ? 'Buy' : 'Sell'} ${symbol}`}
        </button>
      </form>
    </div>
  );
};
