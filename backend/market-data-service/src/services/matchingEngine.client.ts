import axios from 'axios';
import { createLogger } from '@trade-x/shared';

const logger = createLogger('market-data-service');

const engineHttp = axios.create({
  baseURL: process.env.MATCHING_ENGINE_URL ?? 'http://localhost:3003',
  timeout: 5_000,
  headers: { 'x-service-key': process.env.INTERNAL_SERVICE_KEY },
});

/**
 * Fetch live order book depth from the matching engine's in-memory book.
 * Falls back to empty arrays if engine is unavailable.
 */
export const getDepth = async (
  symbol: string,
  levels = 20,
): Promise<{ bids: [number, number][]; asks: [number, number][] }> => {
  try {
    const { data } = await engineHttp.get<{
      data: { bids: [number, number][]; asks: [number, number][] };
    }>(`/internal/engine/orderbook/${symbol}`, { params: { levels } });
    return data.data ?? { bids: [], asks: [] };
  } catch (err) {
    if (axios.isAxiosError(err) && !err.response) {
      logger.warn('Matching engine unavailable — returning empty depth', { symbol });
    }
    return { bids: [], asks: [] };
  }
};

/**
 * Fetch live best bid/ask from the matching engine.
 */
export const getQuote = async (symbol: string) => {
  try {
    const { data } = await engineHttp.get<{
      data: { symbol: string; bestBid: number | null; bestAsk: number | null; spread: number | null };
    }>(`/internal/engine/quote/${symbol}`);
    return data.data ?? null;
  } catch {
    return null;
  }
};
