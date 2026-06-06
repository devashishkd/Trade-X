import { Order, OrderType } from '../models/types';
import { OrderBook } from '../engine/OrderBook';
import { IOrderHandler, MatchResult } from './IOrderHandler';

/**
 * Chain of Responsibility: iterates registered handlers until one
 * reports it can handle the given order type.
 *
 * Adding a new order type (Phase 10+) = just register a new handler.
 * Zero changes to the MatchingEngine core.
 */
export class OrderHandlerChain {
  private handlers: IOrderHandler[] = [];

  /** Register a handler. Handlers are checked in registration order. */
  register(handler: IOrderHandler): void {
    this.handlers.push(handler);
  }

  /** Dispatch an order to the first handler that can process it. */
  process(order: Order, book: OrderBook): MatchResult {
    for (const handler of this.handlers) {
      if (handler.canHandle(order.type)) {
        return handler.handle(order, book);
      }
    }

    // No registered handler for this order type
    return {
      trades:          [],
      remainingOrder:  null,
      status:          'REJECTED',
      rejectionReason: `Unsupported order type: ${order.type}`,
    };
  }

  /** List of supported order types (for introspection / health checks). */
  supportedTypes(): OrderType[] {
    // Collect all types any handler claims to support by probing known types
    const all: OrderType[] = [
      'LIMIT', 'MARKET', 'STOP_LOSS', 'STOP_LIMIT',
      'ICEBERG', 'GTT', 'BRACKET', 'COVER',
    ];
    return all.filter(t => this.handlers.some(h => h.canHandle(t)));
  }
}
