import React from 'react';
import { TradingChartWrapper } from '../../charts/TradingChartWrapper';

interface TradingChartProps {
  symbol: string;
  ltp?: number;
  change?: number;
  changePct?: number;
}

/**
 * TradingChart — thin integration wrapper.
 *
 * All chart logic lives in src/charts/TradingChartWrapper.tsx and its
 * sub-components (CandlestickChart, OscillatorChart, ChartToolbar).
 * This component exists to keep the Trading page import path stable.
 */
export const TradingChart: React.FC<TradingChartProps> = (props) => {
  return <TradingChartWrapper {...props} />;
};
