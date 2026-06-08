import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/UI/Card';
import { apiClient } from '../../services/apiClient';

interface OrderRecord {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET';
  status: 'PENDING' | 'OPEN' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  price: string | { $numberDecimal: string } | null;
  quantity: number;
  filledQuantity: number;
  createdAt: string;
}

export const Orders: React.FC = () => {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const res = await apiClient.get('/orders?limit=100');
      if (res.data.success) {
        setOrders(res.data.data.orders || res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch orders', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCancelOrder = async (orderId: string) => {
    try {
      await apiClient.delete(`/orders/${orderId}`);
      // Refresh the orders list
      fetchOrders();
    } catch (error) {
      console.error('Failed to cancel order', error);
    }
  };

  const getDecimalValue = (val: string | { $numberDecimal: string } | undefined | null) => {
    if (!val) return null;
    if (typeof val === 'string') return val;
    return val.$numberDecimal || null;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-pulse text-indigo-400">Loading Orders...</div></div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
      case 'OPEN':
      case 'PARTIAL':
        return 'text-amber-400 bg-amber-400/10';
      case 'FILLED':
        return 'text-emerald-400 bg-emerald-400/10';
      case 'CANCELLED':
      case 'REJECTED':
        return 'text-gray-400 bg-gray-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Order History</h1>

      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">Time</th>
                <th className="px-6 py-4 font-medium">Symbol</th>
                <th className="px-6 py-4 font-medium">Side</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium text-right">Price</th>
                <th className="px-6 py-4 font-medium text-right">Amount</th>
                <th className="px-6 py-4 font-medium text-right">Filled</th>
                <th className="px-6 py-4 font-medium text-center">Status</th>
                <th className="px-6 py-4 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    You have no order history. <Link to="/market" className="text-indigo-400 hover:underline">Go to Market</Link>
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const priceStr = getDecimalValue(o.price);
                  const price = priceStr ? parseFloat(priceStr).toFixed(2) : 'Market';
                  const isBuy = o.side === 'BUY';
                  const canCancel = ['PENDING', 'OPEN', 'PARTIAL'].includes(o.status);

                  return (
                    <tr key={o.orderId} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                        {new Date(o.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-bold text-white">
                        <Link to={`/trade/${o.symbol}`} className="hover:text-indigo-400 transition-colors">{o.symbol}</Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${isBuy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {o.side}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-300">{o.type}</td>
                      <td className="px-6 py-4 text-right font-mono text-gray-300">{price !== 'Market' ? `$${price}` : price}</td>
                      <td className="px-6 py-4 text-right font-mono text-white">{o.quantity}</td>
                      <td className="px-6 py-4 text-right font-mono text-gray-400">
                        {o.filledQuantity} / {o.quantity}
                        <div className="w-full bg-white/10 h-1 mt-1 rounded-full overflow-hidden">
                          <div className="bg-indigo-500 h-full" style={{ width: `${(o.filledQuantity / o.quantity) * 100}%` }}></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(o.status)}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {canCancel ? (
                          <button 
                            onClick={() => handleCancelOrder(o.orderId)}
                            className="text-xs text-red-400 hover:text-red-300 bg-red-400/10 hover:bg-red-400/20 px-2 py-1 rounded transition-colors"
                          >
                            Cancel
                          </button>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
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
