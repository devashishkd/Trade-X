import { create } from 'zustand';
import type { Timeframe, Range } from '../types/chart.types';

// Re-export for convenience
export type { Timeframe, Range };

interface ChartUIState {
  activeTimeframe: Timeframe;
  activeRange: Range;
  setTimeframe: (tf: Timeframe) => void;
  setRange: (r: Range) => void;
}

export const useChartUIStore = create<ChartUIState>((set) => ({
  activeTimeframe: '1D',
  activeRange: '1Y',

  setTimeframe: (tf) => set({ activeTimeframe: tf }),
  setRange: (r) => set({ activeRange: r }),
}));
