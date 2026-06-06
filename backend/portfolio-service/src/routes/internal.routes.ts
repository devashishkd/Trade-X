import { Router, Request, Response, NextFunction } from 'express';
import { internalAuth }    from '../middleware/internalAuth.middleware';
import * as holdingsService from '../services/holdings.service';
import { successResponse }  from '@trade-x/shared';

const router = Router();
router.use(internalAuth);

/**
 * POST /internal/portfolio/lock-shares
 * Called by Order Service before a SELL order is submitted.
 * Moves availableQty → lockedQty.
 */
router.post(
  '/portfolio/lock-shares',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, symbol, quantity, orderId } = req.body;
      await holdingsService.lockShares(userId, symbol, parseInt(quantity), orderId);
      res.status(200).json(successResponse({ locked: true, userId, symbol, quantity }));
    } catch (err) { next(err); }
  },
);

/**
 * POST /internal/portfolio/unlock-shares
 * Called by Order Service when a SELL order is cancelled.
 * Moves lockedQty → availableQty.
 */
router.post(
  '/portfolio/unlock-shares',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, symbol, quantity, orderId } = req.body;
      await holdingsService.unlockShares(userId, symbol, parseInt(quantity), orderId);
      res.status(200).json(successResponse({ unlocked: true, userId, symbol, quantity }));
    } catch (err) { next(err); }
  },
);

/**
 * POST /internal/portfolio/trade-executed
 * Called by the Matching Engine (via HttpEventBus) on every trade.
 * Idempotent — safe to call multiple times for the same trade.
 */
router.post(
  '/portfolio/trade-executed',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await holdingsService.onTradeExecuted(req.body);
      res.status(200).json(successResponse({ processed: true }));
    } catch (err) { next(err); }
  },
);

/**
 * GET /internal/market/:symbol/ltp
 * Thin proxy — read holding data for internal use (market data enrichment).
 * Note: this is actually served by market-data-service in Phase 5;
 * this endpoint exposes portfolio's view of a symbol's cost basis (not LTP).
 */
router.get(
  '/portfolio/holdings/:userId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const holdings = await holdingsService.getHoldings(req.params.userId);
      res.status(200).json(successResponse(holdings));
    } catch (err) { next(err); }
  },
);

export default router;
