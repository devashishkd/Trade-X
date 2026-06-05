import { Router, Request, Response, NextFunction } from 'express';
import { internalAuth }  from '../middleware/internalAuth.middleware';
import * as walletService from '../services/wallet.service';
import * as authService   from '../services/auth.service';
import { successResponse } from '@trade-x/shared';

const router = Router();

// All /internal/* routes require the service-to-service secret key
router.use(internalAuth);

/**
 * Lock funds for a buy order.
 * Called by: Order Service before submitting order to matching engine.
 */
router.post(
  '/wallet/lock',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, amount, orderId } = req.body;
      await walletService.lockFunds(userId, parseFloat(amount), orderId);
      const balance = await walletService.getBalance(userId);
      res.status(200).json(successResponse(balance));
    } catch (err) { next(err); }
  },
);

/**
 * Unlock funds when an order is cancelled.
 * Called by: Order Service on order cancellation.
 */
router.post(
  '/wallet/unlock',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, amount, orderId } = req.body;
      await walletService.unlockFunds(userId, parseFloat(amount), orderId);
      const balance = await walletService.getBalance(userId);
      res.status(200).json(successResponse(balance));
    } catch (err) { next(err); }
  },
);

/**
 * Settle a completed trade.
 * Called by: Matching Engine after a trade executes.
 * Deducts locked funds from buyer, credits seller's available balance.
 */
router.post(
  '/wallet/settle',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tradeId, buyerId, sellerId, amount } = req.body;
      await walletService.settle(tradeId, buyerId, sellerId, parseFloat(amount));
      res.status(200).json(successResponse({ settled: true, tradeId }));
    } catch (err) { next(err); }
  },
);

/**
 * Get user profile by userId.
 * Called by: Other services to validate user identity.
 */
router.get(
  '/users/:userId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await authService.getProfile(req.params.userId);
      res.status(200).json(successResponse(profile));
    } catch (err) { next(err); }
  },
);

export default router;
