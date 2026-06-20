import type { Candle, OHLCVPoint } from '../types/chart.types';

/**
 * Exponential Moving Average (EMA).
 * Uses a smoothing factor k = 2 / (period + 1).
 * Bootstrapped from the first candle's close price (standard approach).
 *
 * @param candles - Array of OHLCV candles (must be sorted chronologically)
 * @param period  - Lookback period (default 9 for NSE intraday)
 */
export const calculateEMA = (candles: Candle[], period: number = 9): OHLCVPoint[] => {
  const result: OHLCVPoint[] = [];
  if (candles.length === 0) return result;

  const k = 2 / (period + 1);
  let ema = candles[0].close;

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      result.push({ time: candles[i].time, value: ema });
    } else {
      ema = candles[i].close * k + ema * (1 - k);
      result.push({ time: candles[i].time, value: ema });
    }
  }
  return result;
};

/**
 * Internal helper: compute EMA over an array of plain numbers (not candles).
 * Used by MACD to compute the signal line from the MACD line values.
 */
export const calculateEMAOnValues = (
  values: OHLCVPoint[],
  period: number,
): OHLCVPoint[] => {
  const result: OHLCVPoint[] = [];
  if (values.length === 0) return result;

  const k = 2 / (period + 1);
  let ema = values[0].value;

  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      result.push({ time: values[i].time, value: ema });
    } else {
      ema = values[i].value * k + ema * (1 - k);
      result.push({ time: values[i].time, value: ema });
    }
  }
  return result;
};

/**
 * Internal helper: compute EMA over raw numbers, returns number[].
 * Used by MACD to subtract fast and slow EMA arrays.
 */
export const calculateEMAValues = (candles: Candle[], period: number): number[] => {
  if (candles.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = new Array(candles.length).fill(0);
  result[0] = candles[0].close;
  for (let i = 1; i < candles.length; i++) {
    result[i] = candles[i].close * k + result[i - 1] * (1 - k);
  }
  return result;
};
