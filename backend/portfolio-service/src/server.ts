import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors   from 'cors';
import helmet from 'helmet';

import { connectDB }       from './config/db.config';
import portfolioRoutes     from './routes/portfolio.routes';
import internalRoutes      from './routes/internal.routes';
import { AppError, errorResponse, createLogger } from '@trade-x/shared';

const logger = createLogger('portfolio-service');
const app    = express();

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());

// ── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'portfolio-service', timestamp: new Date().toISOString() });
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/portfolio', portfolioRoutes);
app.use('/internal',  internalRoutes);

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
const PORT = parseInt(process.env.PORT ?? process.env.PORTFOLIO_PORT ?? '3004');

const start = async (): Promise<void> => {
  await connectDB();
  app.listen(PORT, () => {
    logger.info(`Portfolio service running on http://localhost:${PORT}`);
    logger.info('Routes:');
    logger.info('  GET  /portfolio/holdings');
    logger.info('  GET  /portfolio/summary');
    logger.info('  GET  /portfolio/trades');
    logger.info('  POST /internal/portfolio/lock-shares');
    logger.info('  POST /internal/portfolio/unlock-shares');
    logger.info('  POST /internal/portfolio/trade-executed');
  });
};

start().catch(err => {
  logger.error('Fatal: failed to start portfolio service', { err });
  process.exit(1);
});
