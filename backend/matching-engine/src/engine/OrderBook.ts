import { v4 as uuidv4 } from 'uuid';
import { Order, Trade, OrderSide } from '../models/types';

/**
 * In-memory price-time priority order book for a single symbol.
 *
 * BUY side  (bids): sorted DESCENDING by price — best bid first
 * SELL side (asks): sorted ASCENDING  by price — best ask first
 *
 * Complexity:
 *   Insert / Add  : O(log P)  — binary-search insert into sorted price array
 *   Cancel        : O(1)      — orderIndex HashMap lookup
 *   Best bid/ask  : O(1)      — first element of sorted price arrays
 *   Match iteration: O(M)     — M = number of orders matched
 *
 * P = distinct price levels (typically ≪ n open orders)
 */
export class OrderBook {
  public readonly symbol: string;

  // price → FIFO queue of resting orders
  private bids: Map<number, Order[]> = new Map();
  private asks: Map<number, Order[]> = new Map();

  // Sorted price arrays for O(1) best-price access
  private sortedBidPrices: number[] = []; // descending — highest bid first
  private sortedAskPrices: number[] = []; // ascending  — lowest  ask first

  // O(1) cancel: orderId → { side, price }
  private orderIndex: Map<string, { side: OrderSide; price: number }> = new Map();

  constructor(symbol: string) {
    this.symbol = symbol;
  }

  // ── Book Mutation ────────────────────────────────────────────────────────

  /** Add a resting order to the book. */
  addOrder(order: Order): void {
    const book         = order.side === 'BUY' ? this.bids : this.asks;
    const sortedPrices = order.side === 'BUY' ? this.sortedBidPrices : this.sortedAskPrices;
    const direction    = order.side === 'BUY' ? 'desc' : 'asc';

    if (!book.has(order.price)) {
      book.set(order.price, []);
      this.insertSorted(sortedPrices, order.price, direction);
    }

    book.get(order.price)!.push(order);
    this.orderIndex.set(order.orderId, { side: order.side, price: order.price });
  }

  /** Cancel an order by orderId. Returns the cancelled Order or null. */
  cancelOrder(orderId: string): Order | null {
    const entry = this.orderIndex.get(orderId);
    if (!entry) return null;

    const book         = entry.side === 'BUY' ? this.bids : this.asks;
    const sortedPrices = entry.side === 'BUY' ? this.sortedBidPrices : this.sortedAskPrices;
    const priceLevel   = book.get(entry.price) ?? [];

    const idx = priceLevel.findIndex(o => o.orderId === orderId);
    if (idx === -1) return null;

    const [cancelled] = priceLevel.splice(idx, 1);
    this.orderIndex.delete(orderId);

    if (priceLevel.length === 0) {
      book.delete(entry.price);
      const priceIdx = sortedPrices.indexOf(entry.price);
      if (priceIdx > -1) sortedPrices.splice(priceIdx, 1);
    }

    return cancelled;
  }

  // ── Best Price Access (O(1)) ─────────────────────────────────────────────

  getBestBid(): Order | null {
    if (this.sortedBidPrices.length === 0) return null;
    const bestPrice = this.sortedBidPrices[0];
    return (this.bids.get(bestPrice) ?? [])[0] ?? null;
  }

  getBestAsk(): Order | null {
    if (this.sortedAskPrices.length === 0) return null;
    const bestPrice = this.sortedAskPrices[0];
    return (this.asks.get(bestPrice) ?? [])[0] ?? null;
  }

  // ── Trade Execution ──────────────────────────────────────────────────────

  /**
   * Execute a match between two orders, consuming quantity from the resting
   * sell (ask) side and mutating both orders' remainingQty in-place.
   *
   * The RESTING (maker) order always sets the execution price.
   * FIFO within a price level: we always take the front of the queue.
   */
  executeMatch(buyOrder: Order, sellOrder: Order): Trade {
    const qty   = Math.min(buyOrder.remainingQty, sellOrder.remainingQty);
    const price = sellOrder.price; // Maker price — resting order wins

    // Mutate in-place (handlers track remainingQty from Order refs)
    buyOrder.remainingQty  -= qty;
    sellOrder.remainingQty -= qty;

    // If the resting sell order is fully filled, remove it from the book
    if (sellOrder.remainingQty === 0) {
      const level = this.asks.get(sellOrder.price) ?? [];
      level.shift(); // FIFO: remove from front
      this.orderIndex.delete(sellOrder.orderId);
      if (level.length === 0) {
        this.asks.delete(sellOrder.price);
        this.sortedAskPrices.shift();
      }
    }

    return {
      tradeId:            uuidv4(),
      symbol:             this.symbol,
      buyOrderId:         buyOrder.orderId,
      sellOrderId:        sellOrder.orderId,
      buyerId:            buyOrder.userId,
      sellerId:           sellOrder.userId,
      quantity:           qty,
      price,
      makerSide:          'SELL',
      executedAt:         new Date(),
      buyerRemainingQty:  buyOrder.remainingQty,
      sellerRemainingQty: sellOrder.remainingQty,
      buyerStatus:        buyOrder.remainingQty  === 0 ? 'FILLED' : 'PARTIAL',
      sellerStatus:       sellOrder.remainingQty === 0 ? 'FILLED' : 'PARTIAL',
    };
  }

  /**
   * Execute a match for a SELL-incoming order against a resting BID.
   * Mirror of executeMatch() — resting BUY order sets price.
   */
  executeMatchSell(sellOrder: Order, buyOrder: Order): Trade {
    const qty   = Math.min(sellOrder.remainingQty, buyOrder.remainingQty);
    const price = buyOrder.price; // Maker price — resting bid

    sellOrder.remainingQty -= qty;
    buyOrder.remainingQty  -= qty;

    // If the resting buy order is fully filled, remove it from the book
    if (buyOrder.remainingQty === 0) {
      const level = this.bids.get(buyOrder.price) ?? [];
      level.shift();
      this.orderIndex.delete(buyOrder.orderId);
      if (level.length === 0) {
        this.bids.delete(buyOrder.price);
        this.sortedBidPrices.shift();
      }
    }

    return {
      tradeId:            uuidv4(),
      symbol:             this.symbol,
      buyOrderId:         buyOrder.orderId,
      sellOrderId:        sellOrder.orderId,
      buyerId:            buyOrder.userId,
      sellerId:           sellOrder.userId,
      quantity:           qty,
      price,
      makerSide:          'BUY',
      executedAt:         new Date(),
      buyerRemainingQty:  buyOrder.remainingQty,
      sellerRemainingQty: sellOrder.remainingQty,
      buyerStatus:        buyOrder.remainingQty  === 0 ? 'FILLED' : 'PARTIAL',
      sellerStatus:       sellOrder.remainingQty === 0 ? 'FILLED' : 'PARTIAL',
    };
  }

  // ── Market Data Queries ──────────────────────────────────────────────────

  /** Returns aggregated bid/ask depth up to `levels` price levels. */
  getDepth(levels = 10): { bids: [number, number][]; asks: [number, number][] } {
    const bids = this.sortedBidPrices.slice(0, levels).map(price => {
      const qty = (this.bids.get(price) ?? []).reduce((s, o) => s + o.remainingQty, 0);
      return [price, qty] as [number, number];
    });

    const asks = this.sortedAskPrices.slice(0, levels).map(price => {
      const qty = (this.asks.get(price) ?? []).reduce((s, o) => s + o.remainingQty, 0);
      return [price, qty] as [number, number];
    });

    return { bids, asks };
  }

  /** Best bid, best ask, and spread snapshot. */
  getQuote() {
    const bestBidPrice = this.sortedBidPrices[0] ?? null;
    const bestAskPrice = this.sortedAskPrices[0] ?? null;
    return {
      symbol:   this.symbol,
      bestBid:  bestBidPrice,
      bestAsk:  bestAskPrice,
      spread:   bestBidPrice !== null && bestAskPrice !== null
        ? parseFloat((bestAskPrice - bestBidPrice).toFixed(4))
        : null,
      midpoint: bestBidPrice !== null && bestAskPrice !== null
        ? parseFloat(((bestBidPrice + bestAskPrice) / 2).toFixed(4))
        : null,
    };
  }

  /** Number of orders currently in the book. */
  get orderCount(): number {
    return this.orderIndex.size;
  }

  // ── Internal Helpers ─────────────────────────────────────────────────────

  /**
   * Binary-search insert into a sorted array — O(log P).
   * Maintains ascending or descending order.
   */
  private insertSorted(arr: number[], val: number, order: 'asc' | 'desc'): void {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (order === 'desc' ? arr[mid] > val : arr[mid] < val) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    arr.splice(lo, 0, val);
  }
}
