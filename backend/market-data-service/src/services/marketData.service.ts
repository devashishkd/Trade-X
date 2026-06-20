import mongoose from 'mongoose';
import { MarketSnapshot } from '../models/MarketSnapshot.model';
import { RecentTrade }    from '../models/RecentTrade.model';
import { HistoricalPrice } from '../models/HistoricalPrice.model';
import { toDecimal128, fromDecimal128, createLogger } from '@trade-x/shared';
import * as engineClient from './matchingEngine.client';
import { emitTickerUpdate, emitCandleUpdate, emitTrade, TickerUpdate, CandleBar } from '../socket/marketSocket';

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
  const [snapshotResult, recentTradeResult, candleResult] = await Promise.allSettled([
    updateSnapshot(payload),
    recordRecentTrade(payload),
    upsertLiveCandle(payload),
  ]);

  if (snapshotResult.status === 'rejected') {
    logger.error('Failed to update market snapshot', { symbol: payload.symbol, reason: snapshotResult.reason });
  } else if (snapshotResult.value) {
    emitTickerUpdate(payload.symbol, snapshotResult.value);
  }

  if (recentTradeResult.status === 'rejected') {
    const err = recentTradeResult.reason as { code?: number };
    if (err.code !== 11000) {
      logger.error('Failed to record recent trade', { tradeId: payload.tradeId, reason: recentTradeResult.reason });
    }
  } else {
    emitTrade(payload.symbol, {
      tradeId:    payload.tradeId,
      price:      payload.price,
      quantity:   payload.quantity,
      makerSide:  payload.makerSide,
      executedAt: payload.executedAt,
    });
  }

  if (candleResult.status === 'rejected') {
    logger.error('Failed to upsert live candles', { symbol: payload.symbol, reason: candleResult.reason });
  }
};

async function updateSnapshot(payload: TradeExecutedPayload): Promise<TickerUpdate | null> {
  const snapshot = await MarketSnapshot.findOne({ symbol: payload.symbol });
  if (!snapshot) {
    logger.warn('No snapshot found for symbol — skipping update', { symbol: payload.symbol });
    return null;
  }

  const openPrice = fromDecimal128(snapshot.openPrice);
  const curHigh   = fromDecimal128(snapshot.highPrice);
  const curLow    = fromDecimal128(snapshot.lowPrice);
  const { price, quantity } = payload;

  const newHigh   = Math.max(curHigh, price);
  const newLow    = Math.min(curLow,  price);
  const change    = parseFloat((price - openPrice).toFixed(4));
  const changePct = openPrice > 0
    ? parseFloat(((change / openPrice) * 100).toFixed(4))
    : 0;

  const updated = await MarketSnapshot.findOneAndUpdate(
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
    { new: true },
  );

  if (!updated) return null;
  return {
    symbol:          updated.symbol,
    lastTradedPrice: price,
    highPrice:       newHigh,
    lowPrice:        newLow,
    openPrice:       openPrice,
    change,
    changePct,
    volume:          fromDecimal128(updated.volume as any) + quantity,
    tradeCount:      (updated.tradeCount ?? 0),
  };
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

/**
 * Upsert 4H, 1D, and 1W OHLC candles for every executed trade.
 * Returns the resulting candles so they can be emitted via Socket.IO.
 */
async function upsertLiveCandle(payload: TradeExecutedPayload): Promise<void> {
  const { symbol, price, quantity, executedAt } = payload;
  const tradeTime = new Date(executedAt);

  // Helper to determine candle boundaries.
  // For 4H: uses IST-aligned NSE session slots to match seeded data timestamps:
  //   Session 1: 9:15 AM IST  = 03:45 UTC  (covers 9:15–13:14 IST trades)
  //   Session 2: 1:15 PM IST  = 07:45 UTC  (covers 13:15–15:30 IST trades)
  // For 1D / 1W: standard UTC midnight / Sunday midnight boundaries.
  const getBoundary = (tf: '4H' | '1D' | '1W', d: Date): Date => {
    const boundary = new Date(d);
    boundary.setUTCSeconds(0, 0);

    if (tf === '1D') {
      boundary.setUTCHours(0, 0, 0, 0);
      return boundary;
    }

    if (tf === '1W') {
      boundary.setUTCHours(0, 0, 0, 0);
      // Roll back to most recent Sunday (UTC)
      boundary.setUTCDate(boundary.getUTCDate() - boundary.getUTCDay());
      return boundary;
    }

    if (tf === '4H') {
      // Convert to IST (UTC+5:30) to determine which NSE session the trade belongs to
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const tradeTimeIST = new Date(d.getTime() + IST_OFFSET_MS);
      const totalMinutesIST = tradeTimeIST.getUTCHours() * 60 + tradeTimeIST.getUTCMinutes();

      // 9:15 IST = 555 min, 13:15 IST = 795 min
      if (totalMinutesIST < 795) {
        // Session 1 bucket: 9:15 IST = 03:45 UTC
        boundary.setUTCHours(3, 45, 0, 0);
      } else {
        // Session 2 bucket: 13:15 IST = 07:45 UTC
        boundary.setUTCHours(7, 45, 0, 0);
      }
      return boundary;
    }

    return boundary;
  };

  const updateTf = async (tf: '4H' | '1D' | '1W') => {
    const boundary = getBoundary(tf, tradeTime);
    
    try {
      const existing = await HistoricalPrice.findOne({
        symbol: symbol.toUpperCase(), timeframe: tf, timestamp: boundary
      }).lean();

      if (!existing) {
        await HistoricalPrice.create({
          symbol: symbol.toUpperCase(), timeframe: tf, timestamp: boundary,
          open: toDecimal128(price), high: toDecimal128(price),
          low: toDecimal128(price), close: toDecimal128(price), volume: quantity
        });
        emitCandleUpdate(symbol, tf, { time: Math.floor(boundary.getTime() / 1000), open: price, high: price, low: price, close: price, volume: quantity });
      } else {
        const curHigh = fromDecimal128(existing.high as mongoose.Types.Decimal128);
        const curLow  = fromDecimal128(existing.low  as mongoose.Types.Decimal128);
        const curOpen = fromDecimal128(existing.open as mongoose.Types.Decimal128);
        const newHigh = Math.max(curHigh, price);
        const newLow  = Math.min(curLow,  price);
        const newVol  = (existing.volume ?? 0) + quantity;

        await HistoricalPrice.updateOne(
          { symbol: symbol.toUpperCase(), timeframe: tf, timestamp: boundary },
          {
            $set: { high: toDecimal128(newHigh), low: toDecimal128(newLow), close: toDecimal128(price) },
            $inc: { volume: quantity }
          }
        );
        emitCandleUpdate(symbol, tf, { time: Math.floor(boundary.getTime() / 1000), open: curOpen, high: newHigh, low: newLow, close: price, volume: newVol });
      }
    } catch (err: any) {
      if (err.code !== 11000) logger.error(`Failed to upsert ${tf} candle`, err);
    }
  };

  await Promise.all([updateTf('4H'), updateTf('1D'), updateTf('1W')]);
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
 * Get historical chart data for a symbol.
 *
 * Supported Timeframes: 4H, 1D, 1W
 * Supported Ranges: 1M, 6M, 1Y, 2Y, 5Y, MAX
 */
export const getHistory = async (symbol: string, timeframe: string, range: string = '1Y'): Promise<any[]> => {
  const now = new Date();
  const sym = symbol.toUpperCase();

  // ── Calculate fromDate based on range ──────────────────────────────
  let fromDate = new Date();
  switch (range.toUpperCase()) {
    case '1M': fromDate.setMonth(now.getMonth() - 1);       break;
    case '6M': fromDate.setMonth(now.getMonth() - 6);       break;
    case '1Y': fromDate.setFullYear(now.getFullYear() - 1); break;
    case '2Y': fromDate.setFullYear(now.getFullYear() - 2); break;
    case '5Y': fromDate.setFullYear(now.getFullYear() - 5); break;
    case 'MAX': fromDate = new Date(0);                     break;
    default:   fromDate.setFullYear(now.getFullYear() - 1);
  }

  // Ensure timeframe is valid, default to 1D if not
  const validTimeframes = ['4H', '1D', '1W'];
  const queryTimeframe = validTimeframes.includes(timeframe.toUpperCase()) ? timeframe.toUpperCase() : '1D';

  const history = await HistoricalPrice.find({
    symbol: sym, timeframe: queryTimeframe, timestamp: { $gte: fromDate },
  }).sort({ timestamp: 1 }).lean();

  return history.map(h => ({
    time:   Math.floor(new Date(h.timestamp).getTime() / 1000),
    open:   parseFloat(String(h.open)),
    high:   parseFloat(String(h.high)),
    low:    parseFloat(String(h.low)),
    close:  parseFloat(String(h.close)),
    volume: h.volume,
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
