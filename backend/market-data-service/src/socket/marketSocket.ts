import { Server, Socket } from 'socket.io';
import { createServer, Server as HttpServer } from 'http';
import { createLogger } from '@trade-x/shared';

const logger = createLogger('market-data-service:socket');

let io: Server | null = null;

// ── Shared types emitted to clients ───────────────────────────────────────────

export interface TickerUpdate {
  symbol:          string;
  lastTradedPrice: number;
  highPrice:       number;
  lowPrice:        number;
  openPrice:       number;
  change:          number;
  changePct:       number;
  volume:          number;
  tradeCount:      number;
}

export interface CandleBar {
  time:   number; // Unix timestamp in seconds
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface TradeEvent {
  tradeId:    string;
  price:      number;
  quantity:   number;
  makerSide:  'BUY' | 'SELL';
  executedAt: string;
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Attach Socket.IO to an existing HTTP server.
 * Call this once during service bootstrap, before .listen().
 */
export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: [
        'http://localhost:5173', // Vite dev
        'http://localhost:4173', // Vite preview
        'http://localhost:3000', // API gateway (if serving frontend)
      ],
      methods: ['GET', 'POST'],
    },
    // Allow long-polling as fallback for environments where WS is blocked
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    logger.info('Client connected', { id: socket.id });

    // Client subscribes to a symbol room
    socket.on('subscribe', (symbol: string) => {
      if (typeof symbol !== 'string') return;
      const room = symbol.toUpperCase();
      socket.join(room);
      logger.info('Client subscribed', { id: socket.id, room });
    });

    // Client unsubscribes from a symbol room
    socket.on('unsubscribe', (symbol: string) => {
      if (typeof symbol !== 'string') return;
      const room = symbol.toUpperCase();
      socket.leave(room);
      logger.info('Client unsubscribed', { id: socket.id, room });
    });

    socket.on('disconnect', (reason: string) => {
      logger.info('Client disconnected', { id: socket.id, reason });
    });
  });

  logger.info('Socket.IO server initialized');
  return io;
}

export function getIO(): Server | null {
  return io;
}

// ── Emit helpers ──────────────────────────────────────────────────────────────

/**
 * Broadcast a ticker update to all subscribers of that symbol.
 */
export function emitTickerUpdate(symbol: string, data: TickerUpdate): void {
  if (!io) return;
  io.to(symbol.toUpperCase()).emit('ticker_update', data);
}

/**
 * Broadcast an updated/new OHLC candle to subscribers.
 */
export function emitCandleUpdate(symbol: string, timeframe: string, candle: CandleBar): void {
  if (!io) return;
  io.to(symbol.toUpperCase()).emit('candle_update', { symbol: symbol.toUpperCase(), timeframe, candle });
}

/**
 * Broadcast a single executed trade to subscribers.
 */
export function emitTrade(symbol: string, trade: TradeEvent): void {
  if (!io) return;
  io.to(symbol.toUpperCase()).emit('trade', { symbol: symbol.toUpperCase(), ...trade });
}
