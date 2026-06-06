import { Router, Request, Response, NextFunction } from 'express';
import { internalAuth }  from '../middleware/internalAuth.middleware';
import * as orderService from '../services/order.service';
import { Order }         from '../models/Order.model';
import { fromDecimal128, successResponse } from '@trade-x/shared';
import mongoose from 'mongoose';

const router = Router();
router.use(internalAuth);

/**
 * Called by Matching Engine after a trade executes.
 * Updates order fills, filledQuantity, remainingQuantity, status.
 */
router.post(
  '/orders/trade-fill',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId, tradeId, quantity, price } = req.body;
      await orderService.applyTradeFill(orderId, tradeId, quantity, price);
      res.status(200).json(successResponse({ updated: true, orderId }));
    } catch (err) { next(err); }
  },
);

/**
 * Called by Matching Engine on startup for order book reconstruction.
 * Returns all OPEN and PARTIAL orders so the engine can rebuild its in-memory books.
 */
router.get(
  '/orders/open',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const orders = await Order.find({ status: { $in: ['OPEN', 'PARTIAL'] } }).lean();
      const engineOrders = orders
        .filter(o => o.price != null) // LIMIT orders only — MARKET orders don't rest in book
        .map(o => ({
          orderId:           o.orderId,
          userId:            o.userId,
          symbol:            o.symbol,
          side:              o.side,
          type:              o.type,
          price:             o.price ? fromDecimal128(o.price as mongoose.Types.Decimal128) : null,
          quantity:          o.quantity,
          remainingQuantity: o.remainingQuantity,
          timestamp:         o.createdAt.toISOString(),
          timeInForce:       o.timeInForce,
        }));
      res.status(200).json(successResponse(engineOrders));
    } catch (err) { next(err); }
  },
);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'order-service' });
});

export default router;
