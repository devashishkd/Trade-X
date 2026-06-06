import { Holding } from '../models/Holding.model';
import { fromDecimal128, createLogger } from '@trade-x/shared';
import { getLastTradedPrices } from './marketData.client';

const logger = createLogger('portfolio-service');

// ── Serialization ──────────────────────────────────────────────────────────────

interface HoldingView {
  symbol:           string;
  availableQty:     number;
  lockedQty:        number;
  totalQty:         number;
  avgCostBasis:     string;
  currentPrice:     string | null;
  currentValue:     string | null;
  investedValue:    string;
  unrealizedPnL:    string | null;
  unrealizedPnLPct: string | null;
}

/**
 * Get all holdings for a user, enriched with:
 * - current market price (from market-data-service)
 * - unrealized P&L = (currentPrice − avgCostBasis) × totalQty
 * - unrealized P&L %
 *
 * If market-data-service is unavailable, currentPrice and P&L will be null.
 */
export const getHoldings = async (userId: string): Promise<HoldingView[]> => {
  const holdings = await Holding.find({ userId }).lean();
  if (holdings.length === 0) return [];

  // Batch fetch prices for all held symbols
  const symbols      = holdings.map(h => h.symbol);
  const priceMap     = await getLastTradedPrices(symbols);

  return holdings.map(h => {
    const avgCost      = fromDecimal128(h.avgCostBasis);
    const totalQty     = h.availableQty + h.lockedQty;
    const investedValue = avgCost * totalQty;

    const currentPrice = priceMap.get(h.symbol) ?? null;
    const currentValue = currentPrice !== null ? currentPrice * totalQty : null;
    const unrealizedPnL = currentValue !== null ? currentValue - investedValue : null;
    const unrealizedPnLPct = unrealizedPnL !== null && investedValue > 0
      ? (unrealizedPnL / investedValue) * 100
      : null;

    return {
      symbol:           h.symbol,
      availableQty:     h.availableQty,
      lockedQty:        h.lockedQty,
      totalQty,
      avgCostBasis:     avgCost.toFixed(2),
      currentPrice:     currentPrice !== null ? currentPrice.toFixed(2) : null,
      currentValue:     currentValue !== null ? currentValue.toFixed(2) : null,
      investedValue:    investedValue.toFixed(2),
      unrealizedPnL:    unrealizedPnL !== null ? unrealizedPnL.toFixed(2) : null,
      unrealizedPnLPct: unrealizedPnLPct !== null ? unrealizedPnLPct.toFixed(2) : null,
    };
  });
};

/**
 * Aggregate portfolio summary across all holdings.
 */
export const getPortfolioSummary = async (userId: string) => {
  const holdings = await getHoldings(userId);

  const totalInvested   = holdings.reduce((s, h) => s + parseFloat(h.investedValue), 0);
  const totalCurrentValue = holdings.reduce((s, h) => s + (h.currentValue ? parseFloat(h.currentValue) : parseFloat(h.investedValue)), 0);
  const totalUnrealizedPnL = totalCurrentValue - totalInvested;

  return {
    holdingsCount:    holdings.length,
    totalInvested:    totalInvested.toFixed(2),
    totalCurrentValue: totalCurrentValue.toFixed(2),
    totalUnrealizedPnL: totalUnrealizedPnL.toFixed(2),
    totalUnrealizedPnLPct: totalInvested > 0
      ? ((totalUnrealizedPnL / totalInvested) * 100).toFixed(2)
      : '0.00',
    holdings,
  };
};
