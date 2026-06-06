import { Router } from 'express';
import * as holdingsController from '../controllers/holdings.controller';
import * as tradesController   from '../controllers/trades.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// All portfolio routes require authentication
router.use(requireAuth);

/**
 * GET /portfolio/holdings
 * Returns all holdings enriched with current price and unrealized P&L.
 */
router.get('/holdings', holdingsController.getHoldings);

/**
 * GET /portfolio/summary
 * Aggregated portfolio overview: total invested, current value, overall P&L.
 */
router.get('/summary', holdingsController.getSummary);

/**
 * GET /portfolio/trades?symbol=AAPL&page=1&limit=20
 * Returns paginated trade history.
 */
router.get('/trades', tradesController.getTrades);

export default router;
