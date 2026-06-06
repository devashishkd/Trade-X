// ── Handler Interface & Types ─────────────────────────────────────────────────

import { Order, Trade, OrderType } from '../models/types';
import { OrderBook } from '../engine/OrderBook';

export interface MatchResult {
  trades:          Trade[];
  remainingOrder:  Order | null; // null = fully filled or rejected
  status:          'FILLED' | 'PARTIAL' | 'OPEN' | 'REJECTED';
  rejectionReason?: string;
}

export interface IOrderHandler {
  canHandle(orderType: OrderType): boolean;
  handle(order: Order, book: OrderBook): MatchResult;
}
