import { IEventBus } from '../models/types';
import { Order } from '../models/types';
import { Trade } from '../models/types';
import { OrderBook } from './OrderBook';
import { OrderHandlerChain } from '../handlers/OrderHandlerChain';
import { LimitOrderHandler, MarketOrderHandler } from '../handlers/OrderHandlers';
import { TradePersistenceWorker } from '../persistence/TradePersistenceWorker';
import { MatchResult } from '../handlers/IOrderHandler';

/**
 * MatchingEngine — the central orchestrator.
 *
 * Responsibilities:
 *  1. Maintains one OrderBook per symbol (created lazily on first order)
 *  2. Routes incoming orders through the OrderHandlerChain (Strategy + CoR)
 *  3. Enqueues resulting trades to TradePersistenceWorker (async, non-blocking)
 *  4. Exposes cancel, depth, and quote queries
 *
 * The matching loop is SYNCHRONOUS and fully in-memory.
 * The HTTP response is sent before any DB write occurs.
 */
export class MatchingEngine {
  private books: Map<string, OrderBook> = new Map();
  private handlerChain: OrderHandlerChain;
  private persistenceWorker: TradePersistenceWorker;

  constructor(eventBus: IEventBus) {
    this.persistenceWorker = new TradePersistenceWorker(eventBus);
    this.handlerChain      = new OrderHandlerChain();

    // ── Register Phase-1 handlers ──────────────────────────────────────────
    this.handlerChain.register(new LimitOrderHandler());
    this.handlerChain.register(new MarketOrderHandler());
    // Phase 10: this.handlerChain.register(new StopLossOrderHandler());
    // Phase 10: this.handlerChain.register(new IcebergOrderHandler());
    // Phase 10: this.handlerChain.register(new GTTOrderHandler());
  }

  // ── Order Processing ─────────────────────────────────────────────────────

  /**
   * Process an incoming order.
   * Returns the MatchResult synchronously.
   * Trades are persisted asynchronously in the background.
   */
  processOrder(incomingOrder: Order): MatchResult {
    const book   = this.getOrCreateBook(incomingOrder.symbol);
    const result = this.handlerChain.process(incomingOrder, book);

    // Enqueue all trades for async persistence — never blocks the hot path
    for (const trade of result.trades) {
      this.persistenceWorker.enqueue(trade);
    }

    return result;
  }

  /**
   * Cancel a resting order by orderId + symbol.
   * O(1) via orderIndex.
   * Returns true if the order was found and cancelled.
   */
  cancelOrder(orderId: string, symbol: string): boolean {
    const book = this.books.get(symbol.toUpperCase());
    if (!book) return false;

    const cancelled = book.cancelOrder(orderId);
    return cancelled !== null;
  }

  // ── Order Book Reconstruction (on restart) ───────────────────────────────

  /**
   * Bulk-load open/partial orders from the Order Service DB on engine startup.
   * Called once during bootstrap to rebuild in-memory state.
   * Does NOT trigger trades — just re-populates the books.
   */
  loadOrders(orders: Order[]): void {
    for (const order of orders) {
      const book = this.getOrCreateBook(order.symbol);
      book.addOrder(order);
    }
  }

  // ── Market Data Queries ──────────────────────────────────────────────────

  getDepth(symbol: string, levels = 10) {
    const book = this.books.get(symbol.toUpperCase());
    return book ? book.getDepth(levels) : { bids: [], asks: [] };
  }

  getQuote(symbol: string) {
    const book = this.books.get(symbol.toUpperCase());
    return book
      ? book.getQuote()
      : { symbol, bestBid: null, bestAsk: null, spread: null, midpoint: null };
  }

  getBookStats() {
    const stats: Record<string, { orderCount: number }> = {};
    for (const [sym, book] of this.books.entries()) {
      stats[sym] = { orderCount: book.orderCount };
    }
    return stats;
  }

  supportedOrderTypes() {
    return this.handlerChain.supportedTypes();
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private getOrCreateBook(symbol: string): OrderBook {
    const key = symbol.toUpperCase();
    if (!this.books.has(key)) {
      this.books.set(key, new OrderBook(key));
    }
    return this.books.get(key)!;
  }
}
