import { create } from 'zustand';
import type { IndicatorType } from '../types/chart.types';

// Re-export for convenience
export type { IndicatorType };

/** Fixed default periods for each indicator (NSE-standard, matching Zerodha Kite defaults) */
export const DEFAULT_INDICATOR_CONFIG = {
  smaPeriod: 20,
  emaPeriod: 9,
  rsiPeriod: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  bollingerPeriod: 20,
  bollingerStdDev: 2,
} as const;

export type IndicatorConfig = typeof DEFAULT_INDICATOR_CONFIG;

/** Overlay indicators drawn on the main candlestick chart */
export const OVERLAY_INDICATORS: IndicatorType[] = ['SMA', 'EMA', 'VWAP', 'BOLLINGER'];

/** Oscillator indicators drawn in a separate sub-pane below the main chart */
export const OSCILLATOR_INDICATORS: IndicatorType[] = ['RSI', 'MACD'];

interface IndicatorState {
  activeIndicators: IndicatorType[];
  config: IndicatorConfig;
  toggleIndicator: (indicator: IndicatorType) => void;
  isActive: (indicator: IndicatorType) => boolean;
  hasOscillator: () => boolean;
}

export const useIndicatorStore = create<IndicatorState>((set, get) => ({
  activeIndicators: [],
  config: { ...DEFAULT_INDICATOR_CONFIG },

  toggleIndicator: (ind) =>
    set((state) => ({
      activeIndicators: state.activeIndicators.includes(ind)
        ? state.activeIndicators.filter((i) => i !== ind)
        : [...state.activeIndicators, ind],
    })),

  isActive: (ind) => get().activeIndicators.includes(ind),

  hasOscillator: () =>
    get().activeIndicators.some((ind) => OSCILLATOR_INDICATORS.includes(ind)),
}));
