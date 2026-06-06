import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors   from 'cors';
import helmet from 'helmet';

import { connectDB }      from './config/db.config';
import marketRoutes       from './routes/market.routes';
import internalRoutes     from './routes/internal.routes';
import { seedSymbols }    from './seed/symbols.seed';
import { AppError, errorResponse, createLogger } from '@trade-x/shared';

const logger = createLogger('market-data-service');
const app    = express();

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());

// ── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'market-data-service', timestamp: new Date().toISOString() });
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/market',   marketRoutes);
app.use('/internal', internalRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json(errorResponse('NOT_FOUND', `Cannot ${req.method} ${req.path}`));
});

// ── Global Error Handler ───────────────────────────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn('Application error', { code: err.code, status: err.statusCode });
    return res.status(err.statusCode).json(errorResponse(err.code, err.message, err.field));
  }
  logger.error('Unhandled error', { err });
  return res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
});

// ── Bootstrap ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? process.env.MARKET_PORT ?? '3005');

const start = async (): Promise<void> => {
  await connectDB();
  await seedSymbols();

  app.listen(PORT, () => {
    logger.info(`Market Data Service running on http://localhost:${PORT}`);
    logger.info('Routes:');
    logger.info('  GET  /market/symbols');
    logger.info('  GET  /market/:symbol/quote');
    logger.info('  GET  /market/:symbol/depth');
    logger.info('  GET  /market/:symbol/trades');
    logger.info('  POST /internal/market/trade-executed');
    logger.info('  GET  /internal/market/:symbol/ltp');
    logger.info('  POST /internal/market/batch-ltp');
  });
};

start().catch(err => {
  logger.error('Fatal: failed to start market data service', { err });
  process.exit(1);
});
