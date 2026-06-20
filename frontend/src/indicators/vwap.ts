import type { Candle, OHLCVPoint } from '../types/chart.types';

/**
 * Volume Weighted Average Price (VWAP).
 *
 * VWAP = Σ(Typical Price × Volume) / Σ(Volume)
 * where Typical Price = (High + Low + Close) / 3
 *
 * This implementation computes a cumulative VWAP from the first candle in the dataset.
 * It is most meaningful for 4H (intraday) data. For 1D / 1W, it serves as a
 * long-term price-volume anchor, consistent with how Zerodha Kite displays it.
 *
 * @param candles - Array of OHLCV candles (sorted chronologically)
 */
export const calculateVWAP = (candles: Candle[]): OHLCVPoint[] => {
  const result: OHLCVPoint[] = [];
  if (candles.length === 0) return result;

  let cumulativeTPV = 0; // cumulative (typicalPrice × volume)
  let cumulativeVolume = 0;

  for (const candle of candles) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativeTPV += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;

    result.push({
      time: candle.time,
      value: cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice,
    });
  }

  return result;
};
