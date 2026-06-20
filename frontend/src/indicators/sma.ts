import type { Candle, OHLCVPoint } from '../types/chart.types';

/**
 * Simple Moving Average (SMA).
 * Standard arithmetic mean over a rolling window of `period` candles.
 *
 * @param candles - Array of OHLCV candles (must be sorted chronologically)
 * @param period  - Lookback window (default 20 for NSE daily charts)
 */
export const calculateSMA = (candles: Candle[], period: number = 20): OHLCVPoint[] => {
  const result: OHLCVPoint[] = [];
  if (candles.length < period) return result;

  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) {
      sum -= candles[i - period].close;
    }
    if (i >= period - 1) {
      result.push({ time: candles[i].time, value: sum / period });
    }
  }
  return result;
};
