import React, { useState } from 'react';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import apiClient from '../../api/client';

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
      setError('Enter a valid price for limit order');
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

  return (
    <Card className="h-full">
      <div className="flex gap-2 p-1 bg-black/20 rounded-md mb-6">
        <button
          onClick={() => setSide('BUY')}
          className={`flex-1 py-1.5 text-sm font-medium rounded-sm transition-colors ${side === 'BUY' ? 'bg-emerald-600/20 text-emerald-400' : 'text-gray-400 hover:text-gray-200'}`}
        >
          Buy
        </button>
        <button
          onClick={() => setSide('SELL')}
          className={`flex-1 py-1.5 text-sm font-medium rounded-sm transition-colors ${side === 'SELL' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-gray-200'}`}
        >
          Sell
        </button>
      </div>

      <div className="flex gap-4 mb-6 text-sm border-b border-white/10 pb-2">
        <button
          onClick={() => setType('LIMIT')}
          className={`pb-2 -mb-[9px] border-b-2 transition-colors ${type === 'LIMIT' ? 'border-indigo-500 text-white font-medium' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
        >
          Limit
        </button>
        <button
          onClick={() => setType('MARKET')}
          className={`pb-2 -mb-[9px] border-b-2 transition-colors ${type === 'MARKET' ? 'border-indigo-500 text-white font-medium' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
        >
          Market
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        {type === 'LIMIT' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Price</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-md py-2 px-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="0.00"
              />
              <span className="absolute right-3 top-2 text-gray-500 text-sm">USD</span>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-400 mb-1">Quantity</label>
          <div className="relative">
            <input
              type="number"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-md py-2 px-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="0"
            />
            <span className="absolute right-3 top-2 text-gray-500 text-sm">{symbol}</span>
          </div>
        </div>

        <div className="mt-auto pt-4">
          <Button 
            type="submit" 
            variant={side === 'BUY' ? 'buy' : 'sell'} 
            size="full"
            isLoading={isLoading}
          >
            {side} {symbol}
          </Button>
        </div>
      </form>
    </Card>
  );
};
