import axios from 'axios';
import { createLogger } from '@trade-x/shared';

const logger = createLogger('portfolio-service');

const marketHttp = axios.create({
  baseURL: process.env.MARKET_DATA_SERVICE_URL ?? 'http://localhost:3005',
  timeout: 3_000,
  headers: { 'x-service-key': process.env.INTERNAL_SERVICE_KEY },
});

/**
 * Fetch the Last Traded Price (LTP) for a symbol.
 * Used to compute unrealized P&L on holdings.
 * Returns null if market-data-service is unavailable or symbol not found.
 */
export const getLastTradedPrice = async (symbol: string): Promise<number | null> => {
  try {
    const { data } = await marketHttp.get<{ data: { lastTradedPrice: number } }>(
      `/internal/market/${symbol}/ltp`,
    );
    return data.data?.lastTradedPrice ?? null;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (!err.response) {
        logger.warn('Market data service unavailable — P&L will not include unrealized gain', { symbol });
      } else if (err.response.status === 404) {
        logger.warn('Symbol not found in market data', { symbol });
      }
    }
    return null;
  }
};

/**
 * Batch fetch LTPs for multiple symbols in one call.
 * Falls back to individual calls if batch endpoint unavailable.
 */
export const getLastTradedPrices = async (
  symbols: string[],
): Promise<Map<string, number>> => {
  const result = new Map<string, number>();
  if (symbols.length === 0) return result;

  try {
    const { data } = await marketHttp.post<{
      data: Record<string, number>;
    }>('/internal/market/batch-ltp', { symbols });

    for (const [sym, price] of Object.entries(data.data ?? {})) {
      if (price != null) result.set(sym, price);
    }
  } catch {
    // Fallback: fetch individually (tolerates partial failures)
    await Promise.allSettled(
      symbols.map(async sym => {
        const price = await getLastTradedPrice(sym);
        if (price !== null) result.set(sym, price);
      }),
    );
  }

  return result;
};
