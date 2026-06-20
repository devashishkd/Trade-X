import type { Candle, OHLCVPoint, MACDPoint } from '../types/chart.types';
import { calculateEMAValues, calculateEMAOnValues } from './ema';

/**
 * MACD — Moving Average Convergence Divergence.
 *
 * Standard MACD(12, 26, 9) as used in Zerodha Kite / Groww:
 *   - MACD Line  = EMA(12) - EMA(26)
 *   - Signal Line = EMA(9) of MACD Line
 *   - Histogram  = MACD Line - Signal Line
 *
 * @param candles      - Array of OHLCV candles (sorted chronologically)
 * @param fastPeriod   - Fast EMA period (default 12)
 * @param slowPeriod   - Slow EMA period (default 26)
 * @param signalPeriod - Signal EMA period (default 9)
 */
export const calculateMACD = (
  candles: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9,
): MACDPoint[] => {
  if (candles.length < slowPeriod + signalPeriod) return [];

  // ── Step 1: Compute raw EMA arrays (number[]) ─────────────────────────────────
  const fastEMAs = calculateEMAValues(candles, fastPeriod);
  const slowEMAs = calculateEMAValues(candles, slowPeriod);

  // ── Step 2: MACD line — meaningful from slowPeriod-1 onward ──────────────────
  const macdLine: OHLCVPoint[] = [];
  for (let i = slowPeriod - 1; i < candles.length; i++) {
    macdLine.push({
      time: candles[i].time,
      value: fastEMAs[i] - slowEMAs[i],
    });
  }

  // ── Step 3: Signal line — EMA(signalPeriod) of MACD line ─────────────────────
  const signalLine = calculateEMAOnValues(macdLine, signalPeriod);

  // ── Step 4: Assemble final output (signal line determines the start index) ────
  const result: MACDPoint[] = [];
  const offset = signalPeriod - 1; // signal needs signalPeriod candles of MACD to start

  for (let i = offset; i < macdLine.length; i++) {
    const macd = macdLine[i].value;
    const signal = signalLine[i].value;
    result.push({
      time: macdLine[i].time,
      macd,
      signal,
      histogram: macd - signal,
    });
  }

  return result;
};
