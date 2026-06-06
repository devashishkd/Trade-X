import { Order } from '../models/types';
import { OrderBook } from '../engine/OrderBook';
import { IOrderHandler, MatchResult } from './IOrderHandler';

/**
 * StopLossHandler — Phase 10 stub.
 *
 * A stop-loss order triggers when the market price crosses the stop price:
 *   BUY  stop:  triggers when price RISES above stopPrice (buy to cover short)
 *   SELL stop:  triggers when price FALLS below stopPrice (sell to cut loss)
 *
 * On trigger: converts to a market order and executes immediately.
 * Pre-trigger: parks in a stop-order registry (not in the live book).
 *
 * Implementation deferred to Phase 10.
 */
export class StopLossHandler implements IOrderHandler {
  canHandle(type: string): boolean {
    return type === 'STOP_LOSS';
  }

  handle(_order: Order, _book: OrderBook): MatchResult {
    // TODO Phase 10: implement stop-order registry + trigger logic
    throw new Error(
      'StopLossHandler not implemented — scheduled for Phase 10. ' +
      'Reject STOP_LOSS orders at the Order Service layer before reaching the engine.',
    );
  }
}

/**
 * IcebergHandler — Phase 10 stub.
 *
 * An iceberg order shows only a visible "tip" quantity in the public order book.
 * When the visible portion fills, the next slice is automatically revealed.
 *
 *   totalQty:   the full order size (hidden from the market)
 *   visibleQty: the slice shown in the book at any time (e.g. 10% of total)
 *
 * Implementation deferred to Phase 10.
 */
export class IcebergHandler implements IOrderHandler {
  canHandle(type: string): boolean {
    return type === 'ICEBERG';
  }

  handle(_order: Order, _book: OrderBook): MatchResult {
    // TODO Phase 10: reveal slices as each portion fills
    throw new Error(
      'IcebergHandler not implemented — scheduled for Phase 10.',
    );
  }
}
