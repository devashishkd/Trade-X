import { Order, OrderType } from '../models/types';
import { OrderBook } from '../engine/OrderBook';
import { IOrderHandler, MatchResult } from './IOrderHandler';
import { EngineConfig } from '../config/engine.config';

// ── Limit Order Handler ───────────────────────────────────────────────────────

/**
 * Handles LIMIT orders with strict price-time priority.
 *
 * BUY LIMIT:  fills against resting SELL orders at or below limit price.
 * SELL LIMIT: fills against resting BUY  orders at or above limit price.
 * If not fully filled, the remainder rests in the book.
 */
export class LimitOrderHandler implements IOrderHandler {
  canHandle(type: OrderType): boolean {
    return type === 'LIMIT';
  }

  handle(order: Order, book: OrderBook): MatchResult {
    if (order.price == null || order.price <= 0) {
      return {
        trades:          [],
        remainingOrder:  null,
        status:          'REJECTED',
        rejectionReason: 'LIMIT order requires a valid price > 0',
      };
    }

    const trades = [];

    if (order.side === 'BUY') {
      // Sweep asks from lowest to highest, while price is acceptable
      while (order.remainingQty > 0) {
        const bestAsk = book.getBestAsk();
        if (!bestAsk || order.price < bestAsk.price) break; // No more matching asks

        const trade = book.executeMatch(order, bestAsk);
        trades.push(trade);
        // order.remainingQty mutated in-place by executeMatch
      }
    } else {
      // SELL: sweep bids from highest to lowest
      while (order.remainingQty > 0) {
        const bestBid = book.getBestBid();
        if (!bestBid || order.price > bestBid.price) break; // No more matching bids

        const trade = book.executeMatchSell(order, bestBid);
        trades.push(trade);
      }
    }

    // If there is remaining quantity, rest in the book
    if (order.remainingQty > 0) {
      book.addOrder(order);
      return {
        trades,
        remainingOrder: order,
        status: trades.length > 0 ? 'PARTIAL' : 'OPEN',
      };
    }

    return { trades, remainingOrder: null, status: 'FILLED' };
  }
}

// ── Market Order Handler ──────────────────────────────────────────────────────

/**
 * Handles MARKET orders with slippage protection.
 *
 * Internally converted to an aggressive LIMIT order capped at:
 *   BUY:  bestAsk × (1 + slippagePct)
 *   SELL: bestBid × (1 - slippagePct)
 *
 * This prevents runaway fills in thin markets.
 * Remaining unfilled quantity returns PARTIAL (not rejected).
 */
export class MarketOrderHandler implements IOrderHandler {
  canHandle(type: OrderType): boolean {
    return type === 'MARKET';
  }

  handle(order: Order, book: OrderBook): MatchResult {
    const protectedPrice = this.computeProtectedPrice(order, book);

    if (protectedPrice === null) {
      return {
        trades:          [],
        remainingOrder:  null,
        status:          'REJECTED',
        rejectionReason: 'No liquidity available for MARKET order',
      };
    }

    const trades = [];

    if (order.side === 'BUY') {
      while (order.remainingQty > 0) {
        const bestAsk = book.getBestAsk();
        // Stop if no more asks, or ask exceeds slippage cap
        if (!bestAsk || bestAsk.price > protectedPrice) break;

        const trade = book.executeMatch(order, bestAsk);
        trades.push(trade);
      }
    } else {
      while (order.remainingQty > 0) {
        const bestBid = book.getBestBid();
        // Stop if no more bids, or bid drops below slippage floor
        if (!bestBid || bestBid.price < protectedPrice) break;

        const trade = book.executeMatchSell(order, bestBid);
        trades.push(trade);
      }
    }

    // Market orders never rest in the book; unfilled qty returns PARTIAL
    const status = order.remainingQty === 0 ? 'FILLED' : 'PARTIAL';

    return {
      trades,
      remainingOrder: order.remainingQty > 0 ? order : null,
      status,
    };
  }

  /**
   * Compute the worst acceptable price for slippage protection.
   * Returns null if there is no liquidity on the relevant side.
   */
  private computeProtectedPrice(order: Order, book: OrderBook): number | null {
    const pct = EngineConfig.getSlippageProtection(order.symbol);

    if (order.side === 'BUY') {
      const bestAsk = book.getBestAsk();
      if (!bestAsk) return null;
      return parseFloat((bestAsk.price * (1 + pct)).toFixed(4));
    } else {
      const bestBid = book.getBestBid();
      if (!bestBid) return null;
      return parseFloat((bestBid.price * (1 - pct)).toFixed(4));
    }
  }
}
