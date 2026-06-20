import type { Candle, BollingerPoint } from '../types/chart.types';

/**
 * Bollinger Bands — BB(20, 2σ).
 *
 * Standard Bollinger Bands as displayed in Zerodha Kite:
 *   - Middle Band = SMA(20)
 *   - Upper Band  = SMA(20) + 2 × Standard Deviation
 *   - Lower Band  = SMA(20) - 2 × Standard Deviation
 *
 * Uses population standard deviation (not sample) — consistent with TradingView.
 *
 * @param candles           - Array of OHLCV candles (sorted chronologically)
 * @param period            - Lookback period (default 20)
 * @param stdDevMultiplier  - Standard deviation multiplier (default 2)
 */
export const calculateBollingerBands = (
  candles: Candle[],
  period: number = 20,
  stdDevMultiplier: number = 2,
): BollingerPoint[] => {
  const result: BollingerPoint[] = [];
  if (candles.length < period) return result;

  for (let i = period - 1; i < candles.length; i++) {
    // Rolling window of `period` candles
    const slice = candles.slice(i - period + 1, i + 1);
    const closes = slice.map((c) => c.close);

    // Mean (SMA)
    const mean = closes.reduce((sum, v) => sum + v, 0) / period;

    // Population std deviation
    const variance = closes.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);

    result.push({
      time: candles[i].time,
      upper: mean + stdDevMultiplier * stdDev,
      middle: mean,
      lower: mean - stdDevMultiplier * stdDev,
    });
  }

  return result;
};
