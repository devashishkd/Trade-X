import { Router, Request, Response, NextFunction } from 'express';
import { MatchingEngine } from '../engine/MatchingEngine';
import { Order, OrderSide, OrderType } from '../models/types';

/**
 * Internal HTTP API for the Matching Engine.
 *
 * All routes require the x-service-key header (internalAuth middleware).
 * These routes are called exclusively by the Order Service.
 *
 * POST   /internal/engine/order          — submit a new order
 * DELETE /internal/engine/order/:orderId — cancel a resting order
 * GET    /internal/engine/orderbook/:symbol — order book depth snapshot
 * GET    /internal/engine/quote/:symbol     — best bid/ask/spread
 * GET    /internal/engine/stats             — engine stats (active books, etc.)
 */
export function createEngineRouter(engine: MatchingEngine): Router {
  const router = Router();

  // ── Submit Order ───────────────────────────────────────────────────────────
  /**
   * POST /internal/engine/order
   * Body: { orderId, userId, symbol, side, type, price, quantity, remainingQuantity, timestamp }
   * Returns: { orderId, status, filledQuantity, remainingQuantity, trades[] }
   */
  router.post(
    '/order',
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const {
          orderId, userId, symbol, side, type,
          price, quantity, remainingQuantity, timestamp,
        } = req.body;

        // Validate required fields
        if (!orderId || !userId || !symbol || !side || !type || quantity == null) {
          res.status(400).json({
            success: false,
            error: { code: 'INVALID_PAYLOAD', message: 'Missing required order fields' },
          });
          return;
        }

        const order: Order = {
          orderId,
          userId,
          symbol:       symbol.toUpperCase(),
          side:         side as OrderSide,
          type:         type as OrderType,
          price:        parseFloat(price ?? 0),
          quantity:     parseInt(quantity),
          remainingQty: parseInt(remainingQuantity ?? quantity),
          timestamp:    new Date(timestamp ?? Date.now()),
        };

        const result = engine.processOrder(order);

        // Map MatchResult → response shape expected by order-service client
        res.status(200).json({
          success: true,
          data: {
            orderId:           order.orderId,
            status:            result.status,
            filledQuantity:    order.quantity - (result.remainingOrder?.remainingQty ?? 0),
            remainingQuantity: result.remainingOrder?.remainingQty ?? 0,
            trades: result.trades.map(t => ({
              tradeId:    t.tradeId,
              buyOrderId: t.buyOrderId,
              sellOrderId:t.sellOrderId,
              buyerId:    t.buyerId,
              sellerId:   t.sellerId,
              symbol:     t.symbol,
              quantity:   t.quantity,
              price:      t.price,
              makerSide:  t.makerSide,
              executedAt: t.executedAt.toISOString(),
            })),
            rejectionReason: result.rejectionReason,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Cancel Order ───────────────────────────────────────────────────────────
  /**
   * DELETE /internal/engine/order/:orderId
   * Body:  { symbol }
   * Returns: { cancelled: true|false, orderId }
   */
  router.delete(
    '/order/:orderId',
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const { orderId } = req.params;
        const { symbol }  = req.body;

        if (!symbol) {
          res.status(400).json({
            success: false,
            error: { code: 'INVALID_PAYLOAD', message: 'symbol is required' },
          });
          return;
        }

        const cancelled = engine.cancelOrder(orderId, symbol);

        if (!cancelled) {
          // Order not found — already filled, partially filled, or wrong symbol
          res.status(404).json({
            success: false,
            error: { code: 'ORDER_NOT_FOUND', message: 'Order not in active order book' },
          });
          return;
        }

        res.status(200).json({ success: true, data: { cancelled: true, orderId } });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Order Book Depth ───────────────────────────────────────────────────────
  /**
   * GET /internal/engine/orderbook/:symbol?levels=20
   */
  router.get(
    '/orderbook/:symbol',
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const symbol = (req.params.symbol as string).toUpperCase();
        const levels = parseInt(req.query.levels as string) || 20;
        const depth  = engine.getDepth(symbol, levels);
        res.status(200).json({ success: true, data: { symbol, ...depth } });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Quote (Best Bid/Ask) ──────────────────────────────────────────────────
  /**
   * GET /internal/engine/quote/:symbol
   */
  router.get(
    '/quote/:symbol',
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const symbol = (req.params.symbol as string).toUpperCase();
        const quote  = engine.getQuote(symbol);
        res.status(200).json({ success: true, data: quote });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Engine Stats ──────────────────────────────────────────────────────────
  /**
   * GET /internal/engine/stats
   */
  router.get(
    '/stats',
    (_req: Request, res: Response, next: NextFunction) => {
      try {
        res.status(200).json({
          success: true,
          data: {
            books:              engine.getBookStats(),
            supportedOrderTypes: engine.supportedOrderTypes(),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
