import mongoose from 'mongoose';
import { MarketSnapshot } from '../models/MarketSnapshot.model';
import { RecentTrade }    from '../models/RecentTrade.model';
import { toDecimal128, fromDecimal128, createLogger } from '@trade-x/shared';
import * as engineClient from './matchingEngine.client';

const logger = createLogger('market-data-service');

// ── Trade Executed Event ───────────────────────────────────────────────────────

export interface TradeExecutedPayload {
  tradeId:    string;
  symbol:     string;
  price:      number;
  quantity:   number;
  makerSide:  'BUY' | 'SELL';
  executedAt: string;
}

/**
 * Update market snapshot on TRADE_EXECUTED.
 * Updates: LTP, high, low, volume, tradeCount, change, changePct.
 * Also appends the trade to the recent trades feed.
 *
 * Idempotent via unique index on tradeId in RecentTrade.
 */
export const onTradeExecuted = async (payload: TradeExecutedPayload): Promise<void> => {
  const [snapshotResult, recentTradeResult] = await Promise.allSettled([
    updateSnapshot(payload),
    recordRecentTrade(payload),
  ]);

  if (snapshotResult.status === 'rejected') {
    logger.error('Failed to update market snapshot', { symbol: payload.symbol, reason: snapshotResult.reason });
  }
  if (recentTradeResult.status === 'rejected') {
    // Duplicate key = already recorded — idempotent
    const err = recentTradeResult.reason as { code?: number };
    if (err.code !== 11000) {
      logger.error('Failed to record recent trade', { tradeId: payload.tradeId, reason: recentTradeResult.reason });
    }
  }
};

async function updateSnapshot(payload: TradeExecutedPayload): Promise<void> {
  const snapshot = await MarketSnapshot.findOne({ symbol: payload.symbol });
  if (!snapshot) {
    logger.warn('No snapshot found for symbol — skipping update', { symbol: payload.symbol });
    return;
  }

  const openPrice = fromDecimal128(snapshot.openPrice);
  const curHigh   = fromDecimal128(snapshot.highPrice);
  const curLow    = fromDecimal128(snapshot.lowPrice);
  const { price, quantity } = payload;

  const newHigh = Math.max(curHigh, price);
  const newLow  = Math.min(curLow,  price);
  const change    = parseFloat((price - openPrice).toFixed(4));
  const changePct = openPrice > 0
    ? parseFloat(((change / openPrice) * 100).toFixed(4))
    : 0;

  await MarketSnapshot.findOneAndUpdate(
    { symbol: payload.symbol },
    {
      $set: {
        lastTradedPrice: toDecimal128(price),
        highPrice:       toDecimal128(newHigh),
        lowPrice:        toDecimal128(newLow),
        closePrice:      toDecimal128(price),
        change:          toDecimal128(change),
        changePct:       toDecimal128(changePct),
      },
      $inc: { volume: quantity, tradeCount: 1 },
    },
  );
}

async function recordRecentTrade(payload: TradeExecutedPayload): Promise<void> {
  await RecentTrade.create({
    tradeId:    payload.tradeId,
    symbol:     payload.symbol,
    price:      toDecimal128(payload.price),
    quantity:   payload.quantity,
    makerSide:  payload.makerSide,
    executedAt: new Date(payload.executedAt),
  });
}

// ── Queries ────────────────────────────────────────────────────────────────────

export const getAllSymbols = async () => {
  return MarketSnapshot.find({}).sort({ symbol: 1 }).lean();
};

export const getSymbol = async (symbol: string) => {
  return MarketSnapshot.findOne({ symbol: symbol.toUpperCase() }).lean();
};

/**
 * Get quote: merges DB snapshot (LTP, OHLCV) with live engine data (best bid/ask).
 */
export const getFullQuote = async (symbol: string) => {
  const [snapshot, liveQuote] = await Promise.all([
    MarketSnapshot.findOne({ symbol: symbol.toUpperCase() }).lean(),
    engineClient.getQuote(symbol),
  ]);

  if (!snapshot) return null;

  return {
    symbol:          snapshot.symbol,
    name:            snapshot.name,
    lastTradedPrice: String(snapshot.lastTradedPrice),
    openPrice:       String(snapshot.openPrice),
    highPrice:       String(snapshot.highPrice),
    lowPrice:        String(snapshot.lowPrice),
    change:          String(snapshot.change),
    changePct:       String(snapshot.changePct),
    volume:          snapshot.volume,
    tradeCount:      snapshot.tradeCount,
    // Live from matching engine in-memory book
    bestBid:  liveQuote?.bestBid  ?? null,
    bestAsk:  liveQuote?.bestAsk  ?? null,
    spread:   liveQuote?.spread   ?? null,
  };
};

/**
 * Fetch live order book depth from matching engine.
 */
export const getDepth = async (symbol: string, levels = 20) => {
  const depth = await engineClient.getDepth(symbol, levels);
  return { symbol: symbol.toUpperCase(), ...depth };
};

/**
 * Get recent trades for a symbol (most recent first).
 */
export const getRecentTrades = async (symbol: string, limit = 50): Promise<any[]> => {
  const trades = await RecentTrade.find({ symbol: symbol.toUpperCase() })
    .sort({ executedAt: -1 })
    .limit(limit)
    .lean();
    
  return trades.map(t => ({
    ...t,
    price: String(t.price)
  }));
};

/**
 * Internal: fetch just the LTP for a symbol (used by portfolio service).
 */
export const getLTP = async (symbol: string): Promise<number | null> => {
  const snap = await MarketSnapshot.findOne(
    { symbol: symbol.toUpperCase() },
    { lastTradedPrice: 1 },
  ).lean();
  if (!snap) return null;
  return fromDecimal128(snap.lastTradedPrice as mongoose.Types.Decimal128);
};

/**
 * Internal: batch fetch LTPs for multiple symbols.
 */
export const getBatchLTPs = async (
  symbols: string[],
): Promise<Record<string, number>> => {
  const snaps = await MarketSnapshot.find(
    { symbol: { $in: symbols.map(s => s.toUpperCase()) } },
    { symbol: 1, lastTradedPrice: 1 },
  ).lean();

  const result: Record<string, number> = {};
  for (const s of snaps) {
    result[s.symbol] = fromDecimal128(s.lastTradedPrice as mongoose.Types.Decimal128);
  }
  return result;
};
