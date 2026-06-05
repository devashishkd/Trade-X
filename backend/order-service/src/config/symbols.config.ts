/**
 * Supported trading symbols.
 * Phase 5: Market Data Service seeds these on startup.
 * Adding a new symbol requires only adding it here and to the seed list.
 */
export const SUPPORTED_SYMBOLS = [
  'AAPL', 'GOOG', 'TSLA', 'AMZN', 'MSFT', 'META', 'NVDA', 'NFLX',
] as const;

export type Symbol = typeof SUPPORTED_SYMBOLS[number];

export const isValidSymbol = (symbol: string): boolean =>
  SUPPORTED_SYMBOLS.includes(symbol.toUpperCase() as Symbol);
