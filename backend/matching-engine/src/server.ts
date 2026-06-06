import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors   from 'cors';
import helmet from 'helmet';
import axios  from 'axios';

import { MatchingEngine }     from './engine/MatchingEngine';
import { HttpEventBus }       from './persistence/HttpEventBus';
import { createEngineRouter } from './handlers/engineRouter';
import { internalAuth }       from './middleware/internalAuth.middleware';
import { Order, OrderSide, OrderType } from './models/types';

// ── Bootstrap ──────────────────────────────────────────────────────────────

const PORT         = parseInt(process.env.ENGINE_PORT ?? process.env.PORT ?? '3003');
const ORDER_SVC    = process.env.ORDER_SERVICE_URL ?? 'http://localhost:3002';
const SERVICE_KEY  = process.env.INTERNAL_SERVICE_KEY ?? '';

const eventBus = new HttpEventBus();
const engine   = new MatchingEngine(eventBus);

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());

// ── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'matching-engine',
    timestamp: new Date().toISOString(),
  });
});

// ── Internal Engine Routes (requires service key) ──────────────────────────
app.use('/internal/engine', internalAuth, createEngineRouter(engine));

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Cannot ${req.method} ${req.path}` },
  });
});

// ── Global Error Handler ───────────────────────────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[matching-engine] Unhandled error', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
});

// ── Order Book Reconstruction ──────────────────────────────────────────────
/**
 * On startup, fetch all OPEN/PARTIAL orders from Order Service and
 * rebuild the in-memory order books. This ensures continuity across
 * engine restarts — no orders are lost.
 */
async function reconstructOrderBooks(): Promise<void> {
  try {
    console.log('[matching-engine] Fetching open orders for book reconstruction...');

    const { data } = await axios.get<{ data: Array<{
      orderId:           string;
      userId:            string;
      symbol:            string;
      side:              string;
      type:              string;
      price:             number | null;
      quantity:          number;
      remainingQuantity: number;
      timestamp:         string;
    }> }>(`${ORDER_SVC}/internal/orders/open`, {
      headers: { 'x-service-key': SERVICE_KEY },
      timeout: 10_000,
    });

    const orders: Order[] = (data.data ?? [])
      .filter(o => o.price != null) // Only LIMIT orders rest in book
      .map(o => ({
        orderId:      o.orderId,
        userId:       o.userId,
        symbol:       o.symbol.toUpperCase(),
        side:         o.side as OrderSide,
        type:         o.type as OrderType,
        price:        o.price!,
        quantity:     o.quantity,
        remainingQty: o.remainingQuantity,
        timestamp:    new Date(o.timestamp),
      }));

    engine.loadOrders(orders);
    console.log(`[matching-engine] Reconstructed ${orders.length} open order(s) into ${
      Object.keys(engine.getBookStats()).length
    } symbol book(s).`);
  } catch (err) {
    // Non-fatal: engine still starts, books are empty
    // Orders placed before reconstruction will be added on next submit
    if (axios.isAxiosError(err) && !err.response) {
      console.warn('[matching-engine] Order Service unavailable — starting with empty books');
    } else {
      console.error('[matching-engine] Book reconstruction error', err);
    }
  }
}

// ── Start ──────────────────────────────────────────────────────────────────
const start = async (): Promise<void> => {
  await reconstructOrderBooks();

  app.listen(PORT, () => {
    console.log(`[matching-engine] Running on http://localhost:${PORT}`);
    console.log('[matching-engine] Routes:');
    console.log('  POST   /internal/engine/order');
    console.log('  DELETE /internal/engine/order/:orderId');
    console.log('  GET    /internal/engine/orderbook/:symbol');
    console.log('  GET    /internal/engine/quote/:symbol');
    console.log('  GET    /internal/engine/stats');
  });
};

start().catch(err => {
  console.error('[matching-engine] Fatal startup error', err);
  process.exit(1);
});
