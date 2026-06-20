import React, { useEffect, useRef } from 'react';
import {
  createChart,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import type { ComputedIndicators, IndicatorType } from '../types/chart.types';
import { useChartViewportStore } from '../stores/useChartViewportStore';

const THEME = {
  bg: '#0d1117',        // Slightly darker than main chart to visually separate
  grid: '#1a1f2e',
  text: '#9598a1',
  border: '#2B2B43',
} as const;

interface OscillatorChartProps {
  activeIndicators: IndicatorType[];
  indicatorData: ComputedIndicators;
}

export const OscillatorChart: React.FC<OscillatorChartProps> = ({
  activeIndicators,
  indicatorData,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // RSI series
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiOBRef = useRef<ISeriesApi<'Line'> | null>(null); // Overbought (70)
  const rsiOSRef = useRef<ISeriesApi<'Line'> | null>(null); // Oversold (30)

  // MACD series
  const macdLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const signalLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Viewport sync — OscillatorChart is the reader (never writes)
  const visibleLogicalRange = useChartViewportStore((s) => s.visibleLogicalRange);

  const showRSI = activeIndicators.includes('RSI');
  const showMACD = activeIndicators.includes('MACD');

  // ── Chart Init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: THEME.bg },
        textColor: THEME.text,
        fontFamily: "'Inter', 'Outfit', sans-serif",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: THEME.grid },
        horzLines: { color: THEME.grid },
      },
      crosshair: { vertLine: { labelVisible: false } },
      timeScale: {
        borderColor: THEME.border,
        visible: false, // Time axis hidden — synced from main chart
      },
      rightPriceScale: {
        borderColor: THEME.border,
        autoScale: true,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      handleScroll: false,  // Main chart handles scrolling
      handleScale: false,   // Main chart handles scaling
    });
    chartRef.current = chart;

    // ── RSI Series ────────────────────────────────────────────────────────────
    rsiSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#FF6B35',
      lineWidth: 1,
      visible: false,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    // Reference lines for RSI (70 overbought, 30 oversold) rendered as flat line series
    rsiOBRef.current = chart.addSeries(LineSeries, {
      color: 'rgba(239, 83, 80, 0.4)',
      lineWidth: 1,
      lineStyle: 2, // dashed
      visible: false,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    rsiOSRef.current = chart.addSeries(LineSeries, {
      color: 'rgba(38, 166, 154, 0.4)',
      lineWidth: 1,
      lineStyle: 2, // dashed
      visible: false,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    // ── MACD Series ───────────────────────────────────────────────────────────
    macdLineRef.current = chart.addSeries(LineSeries, {
      color: '#42A5F5',
      lineWidth: 1,
      visible: false,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    signalLineRef.current = chart.addSeries(LineSeries, {
      color: '#FF6B6B',
      lineWidth: 1,
      visible: false,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    macdHistRef.current = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      visible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // ── Responsive resize ─────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      rsiSeriesRef.current = null;
      rsiOBRef.current = null;
      rsiOSRef.current = null;
      macdLineRef.current = null;
      signalLineRef.current = null;
      macdHistRef.current = null;
    };
  }, []);

  // ── Viewport Sync (reads from store, never writes back) ────────────────────
  useEffect(() => {
    if (!chartRef.current || !visibleLogicalRange) return;
    try {
      chartRef.current.timeScale().setVisibleLogicalRange(visibleLogicalRange);
    } catch {
      // Ignore if range is out of bounds for this dataset
    }
  }, [visibleLogicalRange]);

  // ── RSI Data + Visibility ──────────────────────────────────────────────────
  useEffect(() => {
    if (!rsiSeriesRef.current || !rsiOBRef.current || !rsiOSRef.current) return;

    rsiSeriesRef.current.applyOptions({ visible: showRSI });
    rsiOBRef.current.applyOptions({ visible: showRSI });
    rsiOSRef.current.applyOptions({ visible: showRSI });

    if (showRSI && indicatorData.rsi.length > 0) {
      rsiSeriesRef.current.setData(
        indicatorData.rsi.map((d) => ({ time: d.time as Time, value: d.value }))
      );
      // Reference lines: same timestamps, constant values at 70 and 30
      const times = indicatorData.rsi.map((d) => d.time as Time);
      rsiOBRef.current.setData(times.map((t) => ({ time: t, value: 70 })));
      rsiOSRef.current.setData(times.map((t) => ({ time: t, value: 30 })));
    }
  }, [showRSI, indicatorData.rsi]);

  // ── MACD Data + Visibility ─────────────────────────────────────────────────
  useEffect(() => {
    if (!macdLineRef.current || !signalLineRef.current || !macdHistRef.current) return;

    macdLineRef.current.applyOptions({ visible: showMACD });
    signalLineRef.current.applyOptions({ visible: showMACD });
    macdHistRef.current.applyOptions({ visible: showMACD });

    if (showMACD && indicatorData.macd.length > 0) {
      macdLineRef.current.setData(
        indicatorData.macd.map((d) => ({ time: d.time as Time, value: d.macd }))
      );
      signalLineRef.current.setData(
        indicatorData.macd.map((d) => ({ time: d.time as Time, value: d.signal }))
      );
      macdHistRef.current.setData(
        indicatorData.macd.map((d) => ({
          time: d.time as Time,
          value: d.histogram,
          color: d.histogram >= 0 ? 'rgba(38, 166, 154, 0.7)' : 'rgba(239, 83, 80, 0.7)',
        }))
      );
    }
  }, [showMACD, indicatorData.macd]);

  return (
    <div className="oscillator-chart-wrapper" id="oscillator-chart-container">
      {/* Pane label */}
      <div className="oscillator-label">
        {showRSI && !showMACD && <span style={{ color: '#FF6B35' }}>RSI(14)</span>}
        {showMACD && !showRSI && (
          <>
            <span style={{ color: '#42A5F5' }}>MACD(12,26,9)</span>
          </>
        )}
        {showRSI && showMACD && (
          <>
            <span style={{ color: '#FF6B35' }}>RSI(14)</span>
            <span style={{ margin: '0 6px', color: '#2B2B43' }}>|</span>
            <span style={{ color: '#42A5F5' }}>MACD(12,26,9)</span>
          </>
        )}
      </div>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};
