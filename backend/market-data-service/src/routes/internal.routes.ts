import { Router, Request, Response, NextFunction } from 'express';
import { internalAuth } from '../middleware/internalAuth.middleware';
import * as marketDataService from '../services/marketData.service';
import { successResponse } from '@trade-x/shared';

const router = Router();
router.use(internalAuth);

/**
 * POST /internal/market/trade-executed
 * Consumes the trade executed event from the matching engine.
 */
router.post(
  '/market/trade-executed',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await marketDataService.onTradeExecuted(req.body);
      res.status(200).json(successResponse({ processed: true }));
    } catch (err) { next(err); }
  },
);

/**
 * GET /internal/market/:symbol/ltp
 * Used by Portfolio Service to compute unrealized P&L.
 */
router.get(
  '/market/:symbol/ltp',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ltp = await marketDataService.getLTP(req.params.symbol);
      res.status(200).json(successResponse({ lastTradedPrice: ltp }));
    } catch (err) { next(err); }
  },
);

/**
 * POST /internal/market/batch-ltp
 * Batch fetch LTPs (used by Portfolio Service).
 */
router.post(
  '/market/batch-ltp',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { symbols } = req.body;
      const prices = await marketDataService.getBatchLTPs(symbols || []);
      res.status(200).json(successResponse(prices));
    } catch (err) { next(err); }
  },
);

export default router;
