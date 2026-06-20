import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { Timeframe, Range, IndicatorType } from '../types/chart.types';
import { OVERLAY_INDICATORS, OSCILLATOR_INDICATORS } from '../stores/useIndicatorStore';

interface ChartToolbarProps {
  symbol: string;
  ltp?: number;
  change?: number;
  changePct?: number;
  activeTimeframe: Timeframe;
  activeRange: Range;
  activeIndicators: IndicatorType[];
  onTimeframeChange: (tf: Timeframe) => void;
  onRangeChange: (r: Range) => void;
  onIndicatorToggle: (ind: IndicatorType) => void;
}

const TIMEFRAMES: Timeframe[] = ['4H', '1D', '1W'];
const RANGES: Range[] = ['1M', '6M', '1Y', '5Y', 'MAX'];
const ALL_INDICATORS: IndicatorType[] = ['SMA', 'EMA', 'VWAP', 'BOLLINGER', 'RSI', 'MACD'];

/** Display labels for indicator buttons */
const INDICATOR_LABELS: Record<IndicatorType, string> = {
  SMA: 'SMA',
  EMA: 'EMA',
  VWAP: 'VWAP',
  BOLLINGER: 'BB',
  RSI: 'RSI',
  MACD: 'MACD',
};

/** Colors assigned to each indicator button when active */
const INDICATOR_COLORS: Record<IndicatorType, string> = {
  SMA: '#2962FF',
  EMA: '#FFD600',
  VWAP: '#AB47BC',
  BOLLINGER: '#26a69a',
  RSI: '#FF6B35',
  MACD: '#42A5F5',
};

export const ChartToolbar: React.FC<ChartToolbarProps> = ({
  symbol,
  ltp,
  change,
  changePct,
  activeTimeframe,
  activeRange,
  activeIndicators,
  onTimeframeChange,
  onRangeChange,
  onIndicatorToggle,
}) => {
  const isPositive = (change ?? 0) >= 0;
  const hasLTP = ltp !== undefined && ltp > 0;

  return (
    <div className="chart-toolbar">
      {/* ── Left: Symbol + Price ─────────────────────────────────────── */}
      <div className="toolbar-symbol-block">
        <span className="toolbar-symbol-name">{symbol}</span>
        {hasLTP && (
          <>
            <span className={`toolbar-ltp ${isPositive ? 'price-up' : 'price-down'}`}>
              ₹{ltp!.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`toolbar-change ${isPositive ? 'price-up' : 'price-down'}`}>
              {isPositive ? (
                <TrendingUp size={12} style={{ display: 'inline', marginRight: 3 }} />
              ) : (
                <TrendingDown size={12} style={{ display: 'inline', marginRight: 3 }} />
              )}
              {isPositive ? '+' : ''}{change!.toFixed(2)} ({isPositive ? '+' : ''}{changePct!.toFixed(2)}%)
            </span>
          </>
        )}
      </div>

      {/* ── Center: Timeframe + Range ─────────────────────────────────── */}
      <div className="toolbar-center">
        {/* Timeframe selector */}
        <div className="toolbar-btn-group" role="group" aria-label="Timeframe">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              id={`chart-tf-${tf}`}
              onClick={() => onTimeframeChange(tf)}
              className={`toolbar-btn ${activeTimeframe === tf ? 'toolbar-btn--active-tf' : ''}`}
              aria-pressed={activeTimeframe === tf}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="toolbar-divider" />

        {/* Range selector */}
        <div className="toolbar-btn-group" role="group" aria-label="Range">
          {RANGES.map((r) => (
            <button
              key={r}
              id={`chart-range-${r}`}
              onClick={() => onRangeChange(r)}
              className={`toolbar-btn ${activeRange === r ? 'toolbar-btn--active-range' : ''}`}
              aria-pressed={activeRange === r}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* ── Right: Indicators ─────────────────────────────────────────── */}
      <div className="toolbar-indicators" role="group" aria-label="Indicators">
        <span className="toolbar-indicators-label">Indicators</span>
        {ALL_INDICATORS.map((ind) => {
          const isActive = activeIndicators.includes(ind);
          const isOscillator = OSCILLATOR_INDICATORS.includes(ind);
          const color = INDICATOR_COLORS[ind];
          return (
            <button
              key={ind}
              id={`chart-ind-${ind.toLowerCase()}`}
              onClick={() => onIndicatorToggle(ind)}
              className={`toolbar-ind-btn ${isActive ? 'toolbar-ind-btn--active' : ''} ${isOscillator ? 'toolbar-ind-btn--oscillator' : ''}`}
              style={isActive ? { borderColor: color, color } : undefined}
              aria-pressed={isActive}
              title={OVERLAY_INDICATORS.includes(ind) ? 'Overlay' : 'Sub-pane'}
            >
              {INDICATOR_LABELS[ind]}
            </button>
          );
        })}
      </div>
    </div>
  );
};
