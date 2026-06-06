import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import routes from './routes';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { errorHandlerMiddleware } from './middleware/errorHandler.middleware';
import { createLogger } from '@trade-x/shared';

const logger = createLogger('api-gateway');
const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────
// Note: We don't use express.json() globally here because http-proxy-middleware 
// handles body proxying better when the body isn't fully parsed by the gateway,
// unless we specifically configure it to restream the body.
app.use(helmet());
app.use(cors());
app.use(requestIdMiddleware);

// ── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
});

// ── Proxy Routes ───────────────────────────────────────────────────────────
app.use(routes);

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Cannot ${req.method} ${req.path} at API Gateway` },
  });
});

// ── Global Error Handler ───────────────────────────────────────────────────
app.use(errorHandlerMiddleware);

// ── Bootstrap ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3000');

app.listen(PORT, () => {
  logger.info(`API Gateway running on http://localhost:${PORT}`);
  logger.info('Proxying to downstream services configured in routes.config.ts');
});
