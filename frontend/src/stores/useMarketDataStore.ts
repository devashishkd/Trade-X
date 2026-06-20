import { create } from 'zustand';
import { apiClient } from '../services/apiClient';
import type { Candle, Timeframe, Range } from '../types/chart.types';

// Re-export for backward compatibility with existing imports
export type { Candle, Timeframe, Range };

interface CacheEntry {
  candles: Candle[];
  fetchedAt: number;
}

interface MarketDataState {
  caches: Record<string, CacheEntry>;
  isLoading: boolean;
  error: string | null;
  fetchHistory: (symbol: string, tf: Timeframe, range: Range) => Promise<Candle[]>;
  updateLatestCandle: (symbol: string, tf: Timeframe, candle: Candle) => void;
  getCachedCandles: (symbol: string, tf: Timeframe, range: Range) => Candle[];
}

export const useMarketDataStore = create<MarketDataState>((set, get) => ({
  caches: {},
  isLoading: false,
  error: null,

  getCachedCandles: (symbol, tf, range) => {
    const key = `${symbol}-${tf}-${range}`;
    return get().caches[key]?.candles ?? [];
  },

  fetchHistory: async (symbol, tf, range) => {
    const key = `${symbol}-${tf}-${range}`;
    const cached = get().caches[key];

    // Cache TTL of 60 seconds — avoids duplicate fetches on re-mounts
    if (cached && Date.now() - cached.fetchedAt < 60_000) {
      return cached.candles;
    }

    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.get(`/market/${symbol}/history`, {
        params: { timeframe: tf, range },
      });
      const candles: Candle[] = res.data.data;
      set((state) => ({
        isLoading: false,
        caches: {
          ...state.caches,
          [key]: { candles, fetchedAt: Date.now() },
        },
      }));
      return candles;
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      return [];
    }
  },

  updateLatestCandle: (symbol, tf, candle) => {
    set((state) => {
      const newCaches = { ...state.caches };
      let changed = false;

      for (const [key, entry] of Object.entries(newCaches)) {
        if (!key.startsWith(`${symbol}-${tf}-`)) continue;

        const updatedCandles = [...entry.candles];
        const lastIndex = updatedCandles.length - 1;

        if (lastIndex >= 0 && updatedCandles[lastIndex].time === candle.time) {
          // Live tick on same candle — update in place
          updatedCandles[lastIndex] = candle;
        } else if (lastIndex < 0 || candle.time > updatedCandles[lastIndex].time) {
          // New candle started
          updatedCandles.push(candle);
        }

        newCaches[key] = { ...entry, candles: updatedCandles };
        changed = true;
      }

      return changed ? { caches: newCaches } : state;
    });
  },
}));
