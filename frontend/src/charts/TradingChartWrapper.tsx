import React, { useEffect, useMemo } from 'react';
import { ChartToolbar } from './ChartToolbar';
import { CandlestickChart } from './CandlestickChart';
import { OscillatorChart } from './OscillatorChart';
import { useMarketDataStore } from '../stores/useMarketDataStore';
import { useChartUIStore } from '../stores/useChartUIStore';
import { useIndicatorStore, OSCILLATOR_INDICATORS } from '../stores/useIndicatorStore';
import { useChartSocketManager } from '../websocket/useChartSocketManager';
import { calculateSMA } from '../indicators/sma';
import { calculateEMA } from '../indicators/ema';
import { calculateVWAP } from '../indicators/vwap';
import { calculateBollingerBands } from '../indicators/bollinger';
import { calculateRSI } from '../indicators/rsi';
import { calculateMACD } from '../indicators/macd';
import type { ComputedIndicators } from '../types/chart.types';

const EMPTY_CANDLES: any[] = [];

interface TradingChartWrapperProps {
  symbol: string;
  ltp?: number;
  change?: number;
  changePct?: number;
}

export const TradingChartWrapper: React.FC<TradingChartWrapperProps> = ({
  symbol,
  ltp,
  change,
  changePct,
}) => {
  const { activeTimeframe, activeRange, setTimeframe, setRange } = useChartUIStore();
  const { activeIndicators, config, toggleIndicator } = useIndicatorStore();
  const { fetchHistory, isLoading } = useMarketDataStore();

  // ── Reactive candle selector — re-renders on every cache update (live ticks) ─
  const cacheKey = `${symbol}-${activeTimeframe}-${activeRange}`;
  // Use a stable reference to avoid Zustand infinite re-render loops
  const candles = useMarketDataStore((s) => s.caches[cacheKey]?.candles ?? EMPTY_CANDLES);

  // ── Subscribe to live WebSocket ticks ───────────────────────────────────────
  useChartSocketManager(symbol, activeTimeframe);

  // ── Fetch history on mount / TF / Range change ───────────────────────────
  useEffect(() => {
    fetchHistory(symbol, activeTimeframe, activeRange);
  }, [symbol, activeTimeframe, activeRange, fetchHistory]);

  // ── Compute all indicators (memoized — only recalculates on candle change) ─
  const indicatorData = useMemo<ComputedIndicators>(() => {
    if (candles.length === 0) {
      return { sma: [], ema: [], vwap: [], bollinger: [], rsi: [], macd: [] };
    }
    return {
      sma: activeIndicators.includes('SMA')
        ? calculateSMA(candles, config.smaPeriod)
        : [],
      ema: activeIndicators.includes('EMA')
        ? calculateEMA(candles, config.emaPeriod)
        : [],
      vwap: activeIndicators.includes('VWAP')
        ? calculateVWAP(candles)
        : [],
      bollinger: activeIndicators.includes('BOLLINGER')
        ? calculateBollingerBands(candles, config.bollingerPeriod, config.bollingerStdDev)
        : [],
      rsi: activeIndicators.includes('RSI')
        ? calculateRSI(candles, config.rsiPeriod)
        : [],
      macd: activeIndicators.includes('MACD')
        ? calculateMACD(candles, config.macdFast, config.macdSlow, config.macdSignal)
        : [],
    };
  }, [candles, activeIndicators, config]);

  // Whether any oscillator sub-pane should be shown
  const showOscillator = activeIndicators.some((ind) => OSCILLATOR_INDICATORS.includes(ind));

  return (
    <div className="trading-chart-wrapper">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <ChartToolbar
        symbol={symbol}
        ltp={ltp}
        change={change}
        changePct={changePct}
        activeTimeframe={activeTimeframe}
        activeRange={activeRange}
        activeIndicators={activeIndicators}
        onTimeframeChange={setTimeframe}
        onRangeChange={setRange}
        onIndicatorToggle={toggleIndicator}
      />

      {/* ── Chart Area ───────────────────────────────────────────────────── */}
      <div className="chart-area">
        {/* Loading overlay */}
        {isLoading && candles.length === 0 && (
          <div className="chart-loading-overlay">
            <div className="chart-loading-spinner" />
            <span>Loading {activeTimeframe} data…</span>
          </div>
        )}

        {/* Main Candlestick + Volume + Overlay Indicators */}
        <div
          className="candlestick-pane"
          style={{ flex: showOscillator ? '1 1 65%' : '1 1 100%' }}
        >
          <CandlestickChart
            candles={candles}
            activeTimeframe={activeTimeframe}
            activeIndicators={activeIndicators}
            indicatorData={indicatorData}
          />
        </div>

        {/* Oscillator Sub-pane (RSI / MACD) — only when active */}
        {showOscillator && (
          <div className="oscillator-pane">
            <OscillatorChart
              activeIndicators={activeIndicators}
              indicatorData={indicatorData}
            />
          </div>
        )}
      </div>
    </div>
  );
};
