import mongoose from 'mongoose';
import { Holding } from '../models/Holding.model';
import { Trade } from '../models/Trade.model';
import { toDecimal128, fromDecimal128, AppError, createLogger } from '@trade-x/shared';

const logger = createLogger('portfolio-service');

const MAX_RETRIES = 3;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TradeExecutedPayload {
  tradeId:    string;
  symbol:     string;
  buyOrderId: string;
  sellOrderId:string;
  buyerId:    string;
  sellerId:   string;
  quantity:   number;
  price:      number;
  executedAt: string;
}

// ── Holding Mutations ──────────────────────────────────────────────────────────

/**
 * Update holding after a BUY trade fill.
 * Recalculates weighted average cost basis (WAP).
 *
 * WAP = (existingQty × existingAvg + newQty × newPrice) / (existingQty + newQty)
 */
export const updateOnBuy = async (
  userId:   string,
  symbol:   string,
  quantity: number,
  price:    number,
): Promise<void> => {
  const existing = await Holding.findOne({ userId, symbol });

  if (!existing) {
    // First buy for this symbol
    await Holding.create({
      userId,
      symbol,
      availableQty: quantity,
      lockedQty:    0,
      avgCostBasis: toDecimal128(price),
    });
    logger.info('New holding created', { userId, symbol, quantity, price });
    return;
  }

  // Weighted average price calculation
  const existingQty = existing.availableQty + existing.lockedQty;
  const existingAvg = fromDecimal128(existing.avgCostBasis);
  const newAvg      = ((existingQty * existingAvg) + (quantity * price)) / (existingQty + quantity);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const updated = await Holding.findOneAndUpdate(
      { userId, symbol, version: existing.version },
      {
        $inc: {
          availableQty: quantity,
          version:      1,
        },
        $set: { avgCostBasis: toDecimal128(newAvg) },
      },
    );
    if (updated) {
      logger.info('Holding updated on BUY', { userId, symbol, quantity, newAvg });
      return;
    }
    // Concurrent modification — re-read and retry
    const refreshed = await Holding.findOne({ userId, symbol });
    if (!refreshed) break;
  }

  logger.error('Failed to update holding on BUY after retries', { userId, symbol });
};

/**
 * Update holding after a SELL trade fill.
 * Reduces lockedQty (shares were locked at order placement).
 * Calculates realized P&L.
 */
export const updateOnSell = async (
  userId:   string,
  symbol:   string,
  quantity: number,
  price:    number,
): Promise<void> => {
  const holding = await Holding.findOne({ userId, symbol });
  if (!holding) {
    logger.error('Sell fill received for non-existent holding', { userId, symbol });
    return;
  }

  const avgCost    = fromDecimal128(holding.avgCostBasis);
  const realizedPnL = (price - avgCost) * quantity;

  // Shares were locked at order placement; now the trade is done — reduce both
  await Holding.findOneAndUpdate(
    { userId, symbol },
    {
      $inc: {
        lockedQty:    -quantity, // Release locked
        availableQty: -quantity, // Reduce total (sell reduces ownership)
      },
    },
  );

  // Note: realized P&L is not stored on Holding here; it can be derived
  // from Trade history (sellPrice - avgCostBasis) × quantity

  logger.info('Holding updated on SELL', { userId, symbol, quantity, price, realizedPnL });
};

// ── Share Locking (for SELL order placement) ───────────────────────────────────

/**
 * Lock shares for a SELL order — moves availableQty → lockedQty.
 * Called by Order Service before submitting to matching engine.
 */
export const lockShares = async (
  userId:   string,
  symbol:   string,
  quantity: number,
  orderId:  string,
): Promise<void> => {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const holding = await Holding.findOne({ userId, symbol });
    if (!holding) {
      throw new AppError('INSUFFICIENT_SHARES', 422, `No holding found for ${symbol}`);
    }

    if (holding.availableQty < quantity) {
      throw new AppError(
        'INSUFFICIENT_SHARES',
        422,
        `Insufficient shares. Available: ${holding.availableQty}, Required: ${quantity}`,
      );
    }

    const updated = await Holding.findOneAndUpdate(
      { userId, symbol, version: holding.version },
      {
        $inc: {
          availableQty: -quantity,
          lockedQty:     quantity,
          version:       1,
        },
      },
    );

    if (updated) {
      logger.info('Shares locked', { userId, symbol, quantity, orderId });
      return;
    }
    // Concurrent modification — retry
  }

  throw new AppError('CONFLICT', 409, 'Could not lock shares after multiple retries');
};

/**
 * Unlock shares when a SELL order is cancelled.
 * Moves lockedQty → availableQty.
 */
export const unlockShares = async (
  userId:   string,
  symbol:   string,
  quantity: number,
  orderId:  string,
): Promise<void> => {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const holding = await Holding.findOne({ userId, symbol });
    if (!holding) {
      logger.warn('unlockShares: holding not found', { userId, symbol, orderId });
      return;
    }

    const unlockQty = Math.min(quantity, holding.lockedQty);

    const updated = await Holding.findOneAndUpdate(
      { userId, symbol, version: holding.version },
      {
        $inc: {
          availableQty:  unlockQty,
          lockedQty:    -unlockQty,
          version:       1,
        },
      },
    );

    if (updated) {
      logger.info('Shares unlocked', { userId, symbol, quantity: unlockQty, orderId });
      return;
    }
  }

  throw new AppError('CONFLICT', 409, 'Could not unlock shares after multiple retries');
};

// ── Trade Event Handler (idempotent) ──────────────────────────────────────────

/**
 * Process a TRADE_EXECUTED event from the matching engine.
 * Idempotent: duplicate events (same tradeId + userId) are silently ignored.
 * Updates holdings and records trade history for both buyer and seller.
 */
export const onTradeExecuted = async (payload: TradeExecutedPayload): Promise<void> => {
  const executedAt = new Date(payload.executedAt);

  // Process buyer side
  await processTradeSide({
    userId:   payload.buyerId,
    symbol:   payload.symbol,
    side:     'BUY',
    quantity: payload.quantity,
    price:    payload.price,
    tradeId:  payload.tradeId,
    orderId:  payload.buyOrderId,
    executedAt,
  });

  // Process seller side
  await processTradeSide({
    userId:   payload.sellerId,
    symbol:   payload.symbol,
    side:     'SELL',
    quantity: payload.quantity,
    price:    payload.price,
    tradeId:  payload.tradeId,
    orderId:  payload.sellOrderId,
    executedAt,
  });
};

interface TradeSide {
  userId:     string;
  symbol:     string;
  side:       'BUY' | 'SELL';
  quantity:   number;
  price:      number;
  tradeId:    string;
  orderId:    string;
  executedAt: Date;
}

async function processTradeSide(side: TradeSide): Promise<void> {
  // Idempotency check — unique index on (tradeId, userId) prevents duplicates
  try {
    await Trade.create({
      tradeId:    side.tradeId,
      userId:     side.userId,
      symbol:     side.symbol,
      side:       side.side,
      quantity:   side.quantity,
      price:      toDecimal128(side.price),
      orderId:    side.orderId,
      executedAt: side.executedAt,
    });
  } catch (err) {
    // Duplicate key = already processed — idempotency achieved
    if ((err as mongoose.MongooseError & { code?: number }).code === 11000) {
      logger.info('Trade already processed — skipping', { tradeId: side.tradeId, userId: side.userId });
      return;
    }
    throw err;
  }

  // Update holding
  if (side.side === 'BUY') {
    await updateOnBuy(side.userId, side.symbol, side.quantity, side.price);
  } else {
    await updateOnSell(side.userId, side.symbol, side.quantity, side.price);
  }
}

// ── Queries ────────────────────────────────────────────────────────────────────

export const getHoldings = async (userId: string) => {
  return Holding.find({ userId }).lean();
};

export const getTrades = async (
  userId: string,
  filters: { symbol?: string; page: number; limit: number },
) => {
  const query: Record<string, unknown> = { userId };
  if (filters.symbol) query.symbol = filters.symbol.toUpperCase();

  const [trades, total] = await Promise.all([
    Trade.find(query)
      .sort({ executedAt: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .lean(),
    Trade.countDocuments(query),
  ]);

  return {
    trades,
    pagination: {
      page:    filters.page,
      limit:   filters.limit,
      total,
      hasNext: filters.page * filters.limit < total,
      hasPrev: filters.page > 1,
    },
  };
};
