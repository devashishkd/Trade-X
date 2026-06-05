import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors    from 'cors';
import helmet  from 'helmet';

import { connectDB }     from './config/db.config';
import authRoutes        from './routes/auth.routes';
import walletRoutes      from './routes/wallet.routes';
import internalRoutes    from './routes/internal.routes';
import { AppError, errorResponse, createLogger } from '@trade-x/shared';

const logger = createLogger('auth-service');
const app    = express();

// ─── Security & Parsing Middleware ─────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());

// ─── Health Check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() });
});

// ─── Routes ────────────────────────────────────────────────────────────────
app.use('/auth',     authRoutes);
app.use('/wallet',   walletRoutes);
app.use('/internal', internalRoutes);

// ─── 404 Handler ───────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json(errorResponse('NOT_FOUND', `Cannot ${req.method} ${req.path}`));
});

// ─── Global Error Handler ──────────────────────────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn('Application error', { code: err.code, status: err.statusCode, message: err.message });
    return res.status(err.statusCode).json(errorResponse(err.code, err.message, err.field));
  }
  logger.error('Unhandled error', { err });
  return res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
});

// ─── Bootstrap ─────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3001');

const start = async (): Promise<void> => {
  await connectDB();
  app.listen(PORT, () => {
    logger.info(`Auth service running on http://localhost:${PORT}`);
    logger.info('Routes: POST /auth/register | POST /auth/login | GET /auth/me');
    logger.info('Routes: GET /wallet/balance | POST /wallet/deposit');
    logger.info('Routes: POST /internal/wallet/lock|unlock|settle');
  });
};

start().catch((err) => {
  logger.error('Fatal: failed to start auth service', { err });
  process.exit(1);
});
