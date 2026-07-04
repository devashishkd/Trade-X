import { io, Socket } from 'socket.io-client';

// Connect directly to market-data-service (bypasses the HTTP-only API gateway)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3005';

// ── Types ─────────────────────────────────────────────────────────────────────

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
  time:   number;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface CandleUpdate {
  symbol:    string;
  timeframe: string;
  candle:    CandleBar;
}

export interface TradeEvent {
  symbol:     string;
  tradeId:    string;
  price:      number;
  quantity:   number;
  makerSide:  'BUY' | 'SELL';
  executedAt: string;
}

export interface SymbolCallbacks {
  onTicker?: (data: TickerUpdate) => void;
  onCandle?:  (data: CandleUpdate) => void;
  onTrade?:   (data: TradeEvent)   => void;
}

// ── Singleton socket instance ─────────────────────────────────────────────────

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[socket] Connected to market-data-service:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[socket] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[socket] Connection error:', err.message);
    });
  }
  return socket;
}

// ── Active subscriptions ──────────────────────────────────────────────────────
// Track which symbols we're subscribed to and their handlers so we can clean up

const activeHandlers = new Map<string, SymbolCallbacks>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Subscribe to real-time events for a symbol.
 * Joins the symbol's socket room and registers event handlers.
 */
export function subscribeToSymbol(symbol: string, callbacks: SymbolCallbacks): void {
  const sym = symbol.toUpperCase();
  const s   = getSocket();

  // Only clean up existing handlers if we were already tracking this symbol.
  // Avoids sending a spurious 'unsubscribe' event on first subscribe.
  if (activeHandlers.has(sym)) {
    unsubscribeFromSymbol(sym);
  }

  activeHandlers.set(sym, callbacks);

  s.emit('subscribe', sym);

  if (callbacks.onTicker) {
    s.on('ticker_update', callbacks.onTicker);
  }
  if (callbacks.onCandle) {
    s.on('candle_update', callbacks.onCandle);
  }
  if (callbacks.onTrade) {
    s.on('trade', callbacks.onTrade);
  }
}

/**
 * Unsubscribe from a symbol's room and remove its event handlers.
 * Only emits the socket 'unsubscribe' event if the client was actually in the room.
 */
export function unsubscribeFromSymbol(symbol: string): void {
  const sym = symbol.toUpperCase();
  const s   = getSocket();
  const cbs = activeHandlers.get(sym);

  if (cbs) {
    if (cbs.onTicker) s.off('ticker_update', cbs.onTicker);
    if (cbs.onCandle)  s.off('candle_update',  cbs.onCandle);
    if (cbs.onTrade)   s.off('trade',           cbs.onTrade);
    activeHandlers.delete(sym);
    // Only tell the server to leave the room if we were actually in it
    s.emit('unsubscribe', sym);
  }
}

/**
 * Disconnect the socket entirely (call on app unmount if needed).
 */
export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
