import { Router } from 'express';
import * as marketDataController from '../controllers/marketData.controller';

const router = Router();

// Public routes - no authentication required for market data

/**
 * GET /market/symbols
 * Get all supported symbols and their latest snapshot data.
 */
router.get('/symbols', marketDataController.getSymbols);

/**
 * GET /market/:symbol/quote
 * Get full quote (snapshot + live best bid/ask).
 */
router.get('/:symbol/quote', marketDataController.getQuote);

/**
 * GET /market/:symbol/depth?levels=20
 * Get live order book depth.
 */
router.get('/:symbol/depth', marketDataController.getDepth);

/**
 * GET /market/:symbol/trades?limit=50
 * Get recent trades feed.
 */
router.get('/:symbol/trades', marketDataController.getTrades);

/**
 * GET /market/:symbol/history?timeframe=1D|1W|1M|1Y|5Y
 * Get historical chart data.
 */
router.get('/:symbol/history', marketDataController.getHistory);

export default router;
