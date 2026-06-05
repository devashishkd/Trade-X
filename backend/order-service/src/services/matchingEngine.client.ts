import axios from 'axios';
import { createLogger } from '@trade-x/shared';
import { OrderSide, OrderType } from '@trade-x/shared';

const logger = createLogger('order-service');

const engineHttp = axios.create({
  baseURL: process.env.MATCHING_ENGINE_URL ?? 'http://localhost:3003',
  timeout: 10_000,
  headers: { 'x-service-key': process.env.INTERNAL_SERVICE_KEY },
});

// ── Types ──────────────────────────────────────────────────────────────────

export interface EngineOrder {
  orderId:           string;
  userId:            string;
  symbol:            string;
  side:              OrderSide;
  type:              OrderType;
  price:             number | null;
  quantity:          number;
  remainingQuantity: number;
  timestamp:         string;
}

export interface EngineTrade {
  tradeId:    string;
  buyOrderId: string;
  sellOrderId:string;
  buyerId:    string;
  sellerId:   string;
  symbol:     string;
  quantity:   number;
  price:      number;
  makerSide:  'BUY' | 'SELL';
  executedAt: string;
}

export interface EngineMatchResult {
  orderId:           string;
  status:            'OPEN' | 'PARTIAL' | 'FILLED' | 'REJECTED';
  filledQuantity:    number;
  remainingQuantity: number;
  trades:            EngineTrade[];
}

// ── Client Methods ─────────────────────────────────────────────────────────

/**
 * Submit an order to the matching engine.
 * Returns match result synchronously (engine processes in-memory immediately).
 *
 * If engine is unavailable (Phase 2, before Phase 3 is built),
 * returns a default OPEN result — order stays in DB and will be
 * reconstructed into the engine's order book when it starts.
 */
export const submitOrder = async (order: EngineOrder): Promise<EngineMatchResult> => {
  try {
    const { data } = await engineHttp.post<{ data: EngineMatchResult }>(
      '/internal/engine/order',
      order,
    );
    logger.info('Order submitted to engine', { orderId: order.orderId, status: data.data.status });
    return data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && !err.response) {
      // Engine not running yet (Phase 2) — degrade gracefully
      logger.warn('Matching engine unavailable — order queued as OPEN, will reconstruct on engine start', {
        orderId: order.orderId,
      });
      return {
        orderId:           order.orderId,
        status:            'OPEN',
        filledQuantity:    0,
        remainingQuantity: order.remainingQuantity,
        trades:            [],
      };
    }
    logger.error('Matching engine error', { orderId: order.orderId, err });
    throw err;
  }
};

/**
 * Cancel an order in the matching engine (O(1) via orderIndex).
 * Gracefully degrades if engine is unavailable.
 */
export const cancelOrder = async (orderId: string, symbol: string): Promise<boolean> => {
  try {
    await engineHttp.delete(`/internal/engine/order/${orderId}`, { data: { symbol } });
    logger.info('Order cancelled in engine', { orderId });
    return true;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (!err.response) {
        logger.warn('Engine unavailable during cancel — order cancelled in DB only', { orderId });
        return false;
      }
      if (err.response.status === 404) {
        // Order not in book (already filled or partially filled)
        return false;
      }
    }
    logger.error('Failed to cancel order in engine', { orderId, err });
    return false;
  }
};
