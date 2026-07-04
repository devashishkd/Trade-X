import React from 'react';

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
    <div className="flex flex-col h-full bg-[#151822]">
      <div className="flex text-[10px] font-semibold text-[#848e9c] uppercase tracking-wider px-3 py-2 border-b border-[#1f2430]">
        <div className="flex-1">Price(USD)</div>
        <div className="flex-1 text-right">Size</div>
        <div className="flex-1 text-right">Total</div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden text-[11px] font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {/* Asks (Sell Orders) */}
        <div className="flex-1 flex flex-col justify-end">
          {sortedAsks.map(([price, qty], i) => {
            const depthPercentage = (qty / maxVolume) * 100;
            return (
              <div key={`ask-${price}-${i}`} className="relative flex px-3 py-[2px] hover:bg-[#1c202d] cursor-pointer group">
                <div 
                  className="absolute right-0 top-0 bottom-0 z-0 transition-all duration-300"
                  style={{ width: `${depthPercentage}%`, background: 'var(--trade-sell-bg)' }}
                />
                <div className="flex-1 z-10" style={{ color: 'var(--trade-sell)' }}>{formatPrice(price)}</div>
                <div className="flex-1 text-right text-[#d1d4dc] z-10">{formatQty(qty)}</div>
                <div className="flex-1 text-right text-[#4b5563] z-10 group-hover:text-[#848e9c]">
                  {formatPrice(price * qty)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Spread Indicator */}
        <div className="flex items-center justify-center py-1.5 border-y border-[#1f2430] my-0.5 bg-[#0b0e14]">
          {sortedAsks.length > 0 && sortedBids.length > 0 ? (
            <span className="text-[#848e9c] text-[11px] font-semibold flex items-center gap-2">
              <span style={{ color: 'var(--trade-buy)' }}>{formatPrice(sortedBids[0][0])}</span>
              <span className="text-[#4b5563]">↑</span>
              <span>{formatPrice(sortedAsks[sortedAsks.length - 1][0] - sortedBids[0][0])}</span>
            </span>
          ) : (
            <span className="text-[#4b5563] text-[11px]">—</span>
          )}
        </div>

        {/* Bids (Buy Orders) */}
        <div className="flex-1 flex flex-col justify-start">
          {sortedBids.map(([price, qty], i) => {
            const depthPercentage = (qty / maxVolume) * 100;
            return (
              <div key={`bid-${price}-${i}`} className="relative flex px-3 py-[2px] hover:bg-[#1c202d] cursor-pointer group">
                <div 
                  className="absolute right-0 top-0 bottom-0 z-0 transition-all duration-300"
                  style={{ width: `${depthPercentage}%`, background: 'var(--trade-buy-bg)' }}
                />
                <div className="flex-1 z-10" style={{ color: 'var(--trade-buy)' }}>{formatPrice(price)}</div>
                <div className="flex-1 text-right text-[#d1d4dc] z-10">{formatQty(qty)}</div>
                <div className="flex-1 text-right text-[#4b5563] z-10 group-hover:text-[#848e9c]">
                  {formatPrice(price * qty)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
