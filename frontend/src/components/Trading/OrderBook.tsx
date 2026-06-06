import React from 'react';
import { Card } from '../UI/Card';


interface OrderBookProps {
  bids: [number, number][]; // [price, quantity]
  asks: [number, number][];
}

export const OrderBook: React.FC<OrderBookProps> = ({ bids, asks }) => {
  // Sort asks descending so the lowest ask is at the bottom of the top half
  const sortedAsks = [...asks].sort((a, b) => b[0] - a[0]).slice(-15);
  // Sort bids descending so the highest bid is at the top of the bottom half
  const sortedBids = [...bids].sort((a, b) => b[0] - a[0]).slice(0, 15);

  const maxVolume = Math.max(
    ...sortedAsks.map(a => a[1]),
    ...sortedBids.map(b => b[1]),
    1 // prevent division by zero
  );

  const formatPrice = (p: number) => p.toFixed(2);
  const formatQty = (q: number) => q.toString();

  return (
    <Card className="h-full" noPadding>
      <div className="flex text-xs font-semibold text-gray-500 px-4 py-2 border-b border-white/10">
        <div className="flex-1">Price(USD)</div>
        <div className="flex-1 text-right">Size</div>
        <div className="flex-1 text-right">Total</div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden font-mono text-sm">
        {/* Asks (Sell Orders) */}
        <div className="flex-1 flex flex-col justify-end">
          {sortedAsks.map(([price, qty], i) => {
            const depthPercentage = (qty / maxVolume) * 100;
            return (
              <div key={`ask-${price}-${i}`} className="relative flex px-4 py-1 hover:bg-white/5 cursor-pointer group">
                <div 
                  className="absolute right-0 top-0 bottom-0 bg-red-500/10 z-0 transition-all duration-300"
                  style={{ width: `${depthPercentage}%` }}
                />
                <div className="flex-1 text-red-400 z-10">{formatPrice(price)}</div>
                <div className="flex-1 text-right text-gray-300 z-10">{formatQty(qty)}</div>
                <div className="flex-1 text-right text-gray-400 z-10 group-hover:text-gray-200">
                  {formatPrice(price * qty)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Spread Indicator */}
        <div className="flex items-center justify-center py-2 border-y border-white/5 bg-black/20 my-1">
          {sortedAsks.length > 0 && sortedBids.length > 0 ? (
            <span className="text-gray-400 text-xs">
              Spread: {formatPrice(sortedAsks[sortedAsks.length - 1][0] - sortedBids[0][0])}
            </span>
          ) : (
            <span className="text-gray-500 text-xs">—</span>
          )}
        </div>

        {/* Bids (Buy Orders) */}
        <div className="flex-1 flex flex-col justify-start">
          {sortedBids.map(([price, qty], i) => {
            const depthPercentage = (qty / maxVolume) * 100;
            return (
              <div key={`bid-${price}-${i}`} className="relative flex px-4 py-1 hover:bg-white/5 cursor-pointer group">
                <div 
                  className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 z-0 transition-all duration-300"
                  style={{ width: `${depthPercentage}%` }}
                />
                <div className="flex-1 text-emerald-400 z-10">{formatPrice(price)}</div>
                <div className="flex-1 text-right text-gray-300 z-10">{formatQty(qty)}</div>
                <div className="flex-1 text-right text-gray-400 z-10 group-hover:text-gray-200">
                  {formatPrice(price * qty)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
