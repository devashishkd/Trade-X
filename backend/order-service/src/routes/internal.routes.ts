import { Router, Request, Response, NextFunction } from 'express';
import { internalAuth }  from '../middleware/internalAuth.middleware';
import * as orderService from '../services/order.service';
import { successResponse } from '@trade-x/shared';

const router = Router();
router.use(internalAuth);

/**
 * Called by Matching Engine (or event handler in Phase 9) after a trade executes.
 * Updates the order's fills, filledQuantity, remainingQuantity, and status.
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
 * Health check for internal service mesh.
 */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'order-service' });
});

export default router;
