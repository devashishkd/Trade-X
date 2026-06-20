import type { Candle, OHLCVPoint } from '../types/chart.types';

/**
 * Relative Strength Index (RSI) — Wilder's smoothing method.
 *
 * Standard RSI(14) used by Zerodha Kite / Groww.
 * - Values above 70 → Overbought
 * - Values below 30 → Oversold
 *
 * @param candles - Array of OHLCV candles (sorted chronologically)
 * @param period  - Lookback period (default 14, standard for NSE)
 */
export const calculateRSI = (candles: Candle[], period: number = 14): OHLCVPoint[] => {
  const result: OHLCVPoint[] = [];
  if (candles.length < period + 1) return result;

  // ── Seed: calculate initial average gain/loss ────────────────────────────────
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  const rsi = (ag: number, al: number) =>
    al === 0 ? 100 : 100 - 100 / (1 + ag / al);

  result.push({ time: candles[period].time, value: rsi(avgGain, avgLoss) });

  // ── Wilder's smoothing (EMA of gains/losses with alpha = 1/period) ────────────
  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    result.push({ time: candles[i].time, value: rsi(avgGain, avgLoss) });
  }

  return result;
};
