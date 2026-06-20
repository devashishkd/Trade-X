// ── Core Chart Types ──────────────────────────────────────────────────────────

export type Timeframe = '4H' | '1D' | '1W';
export type Range = '1M' | '6M' | '1Y' | '5Y' | 'MAX';
export type IndicatorType = 'SMA' | 'EMA' | 'VWAP' | 'RSI' | 'MACD' | 'BOLLINGER';

/**
 * A single OHLCV candle. `time` is a Unix timestamp in seconds (as returned by the API).
 */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Indicator Output Types ─────────────────────────────────────────────────────

/** Single-value series point (used by SMA, EMA, VWAP, RSI) */
export interface OHLCVPoint {
  time: number;
  value: number;
}

/** Bollinger Bands output (upper, middle, lower) */
export interface BollingerPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

/** MACD output (macd line, signal line, histogram) */
export interface MACDPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

/** All computed indicator data passed from TradingChartWrapper to chart components */
export interface ComputedIndicators {
  sma: OHLCVPoint[];
  ema: OHLCVPoint[];
  vwap: OHLCVPoint[];
  bollinger: BollingerPoint[];
  rsi: OHLCVPoint[];
  macd: MACDPoint[];
}
