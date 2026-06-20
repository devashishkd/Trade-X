import { create } from 'zustand';

/** Lightweight Charts logical range: { from: number; to: number } */
export interface LogicalRange {
  from: number;
  to: number;
}

interface ChartViewportState {
  /**
   * The current visible logical range from the main CandlestickChart instance.
   * Written by CandlestickChart, read by OscillatorChart to keep time scales in sync.
   */
  visibleLogicalRange: LogicalRange | null;
  setVisibleLogicalRange: (range: LogicalRange | null) => void;
}

export const useChartViewportStore = create<ChartViewportState>((set) => ({
  visibleLogicalRange: null,
  setVisibleLogicalRange: (range) => set({ visibleLogicalRange: range }),
}));
