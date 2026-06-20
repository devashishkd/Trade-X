import React, { useEffect, useRef, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type MouseEventParams,
} from 'lightweight-charts';
import type { Candle, ComputedIndicators, Timeframe, IndicatorType } from '../types/chart.types';
import { useChartViewportStore } from '../stores/useChartViewportStore';

// ── Chart Theme (Zerodha Kite dark palette) ────────────────────────────────────
const THEME = {
  bg: '#131722',
  grid: '#1e2436',
  text: '#d1d4dc',
  border: '#2B2B43',
  candleUp: '#26a69a',
  candleDown: '#ef5350',
} as const;

interface CandlestickChartProps {
  candles: Candle[];
  activeTimeframe: Timeframe;
  activeIndicators: IndicatorType[];
  indicatorData: ComputedIndicators;
}

interface OHLCVInfo {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: number;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  candles,
  activeTimeframe,
  activeIndicators,
  indicatorData,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Series refs
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null);

  // For smart live-tick updates
  const prevCandlesRef = useRef<Candle[]>([]);

  // Viewport store — CandlestickChart is the writer
  const setVisibleLogicalRange = useChartViewportStore((s) => s.setVisibleLogicalRange);

  // ── Chart Initialization ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: THEME.bg },
        textColor: THEME.text,
        fontFamily: "'Inter', 'Outfit', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: THEME.grid, style: 1 },
        horzLines: { color: THEME.grid, style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#758696', width: 1, style: 3, labelBackgroundColor: '#2B2B43' },
        horzLine: { color: '#758696', width: 1, style: 3, labelBackgroundColor: '#2B2B43' },
      },
      timeScale: {
        borderColor: THEME.border,
        timeVisible: activeTimeframe === '4H',
        secondsVisible: false,
        rightOffset: 12,
        shiftVisibleRangeOnNewBar: true,
        tickMarkFormatter: undefined,
      },
      rightPriceScale: {
        borderColor: THEME.border,
        autoScale: true,
        scaleMargins: { top: 0.08, bottom: 0.2 },
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });
    chartRef.current = chart;

    // ── Series: Candlestick (main) ────────────────────────────────────────────
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: THEME.candleUp,
      downColor: THEME.candleDown,
      borderVisible: false,
      wickUpColor: THEME.candleUp,
      wickDownColor: THEME.candleDown,
    });
    candleSeriesRef.current = candleSeries;

    // ── Series: Volume (sub-scaled within the same pane) ─────────────────────
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: THEME.candleUp,
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    } as any);
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // ── Series: SMA ───────────────────────────────────────────────────────────
    smaSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#2962FF',
      lineWidth: 1,
      visible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // ── Series: EMA ───────────────────────────────────────────────────────────
    emaSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#FFD600',
      lineWidth: 1,
      visible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // ── Series: VWAP ──────────────────────────────────────────────────────────
    vwapSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#AB47BC',
      lineWidth: 1,
      lineStyle: 2, // dashed
      visible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // ── Series: Bollinger Bands (3 lines) ─────────────────────────────────────
    bbUpperRef.current = chart.addSeries(LineSeries, {
      color: 'rgba(38, 166, 154, 0.6)',
      lineWidth: 1,
      visible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    bbMiddleRef.current = chart.addSeries(LineSeries, {
      color: 'rgba(38, 166, 154, 0.9)',
      lineWidth: 1,
      lineStyle: 2,
      visible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    bbLowerRef.current = chart.addSeries(LineSeries, {
      color: 'rgba(38, 166, 154, 0.6)',
      lineWidth: 1,
      visible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // ── Crosshair tooltip ─────────────────────────────────────────────────────
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!tooltipRef.current) return;
      if (!param.point || !param.time || !candleSeriesRef.current) {
        tooltipRef.current.style.opacity = '0';
        return;
      }
      const data = param.seriesData.get(candleSeriesRef.current) as any;
      if (!data) {
        tooltipRef.current.style.opacity = '0';
        return;
      }
      const { open, high, low, close } = data;
      const vol = (param.seriesData.get(volumeSeriesRef.current!) as any)?.value;
      const isUp = close >= open;
      const color = isUp ? THEME.candleUp : THEME.candleDown;

      tooltipRef.current.style.opacity = '1';
      tooltipRef.current.innerHTML = `
        <span style="color:#9598a1;font-size:10px;margin-right:6px">O</span><span style="color:${color}">${open.toFixed(2)}</span>
        <span style="color:#9598a1;font-size:10px;margin:0 6px 0 10px">H</span><span style="color:#26a69a">${high.toFixed(2)}</span>
        <span style="color:#9598a1;font-size:10px;margin:0 6px 0 10px">L</span><span style="color:#ef5350">${low.toFixed(2)}</span>
        <span style="color:#9598a1;font-size:10px;margin:0 6px 0 10px">C</span><span style="color:${color}">${close.toFixed(2)}</span>
        ${vol !== undefined ? `<span style="color:#9598a1;font-size:10px;margin:0 6px 0 10px">V</span><span style="color:#9598a1">${vol >= 1_000_000 ? (vol / 1_000_000).toFixed(2) + 'M' : vol >= 1_000 ? (vol / 1_000).toFixed(1) + 'K' : vol}</span>` : ''}
      `;
    });

    // ── Viewport sync → OscillatorChart ──────────────────────────────────────
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      setVisibleLogicalRange(range as any);
    });

    // ── Responsive resize via ResizeObserver ──────────────────────────────────
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
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      smaSeriesRef.current = null;
      emaSeriesRef.current = null;
      vwapSeriesRef.current = null;
      bbUpperRef.current = null;
      bbMiddleRef.current = null;
      bbLowerRef.current = null;
      prevCandlesRef.current = [];
    };
  }, [activeTimeframe, setVisibleLogicalRange]); // Reinit when TF changes (timeVisible config)

  // ── Candle Data Update (smart: full setData or live series.update()) ──────
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return;

    const prev = prevCandlesRef.current;
    const curr = candles;
    const lastCurr = curr[curr.length - 1];

    const isLiveTick =
      prev.length > 0 &&
      curr.length === prev.length &&
      lastCurr.time === prev[prev.length - 1].time;

    if (isLiveTick) {
      // O(1) live tick — only update last candle
      candleSeriesRef.current.update({
        time: lastCurr.time as Time,
        open: lastCurr.open,
        high: lastCurr.high,
        low: lastCurr.low,
        close: lastCurr.close,
      });
      volumeSeriesRef.current.update({
        time: lastCurr.time as Time,
        value: lastCurr.volume,
        color: lastCurr.close >= lastCurr.open
          ? 'rgba(38, 166, 154, 0.5)'
          : 'rgba(239, 83, 80, 0.5)',
      });
    } else {
      // Full reload (TF/Range switch or initial load)
      const ohlcv = curr.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      const vol = curr.map((c) => ({
        time: c.time as Time,
        value: c.volume,
        color: c.close >= c.open
          ? 'rgba(38, 166, 154, 0.5)'
          : 'rgba(239, 83, 80, 0.5)',
      }));

      candleSeriesRef.current.setData(ohlcv);
      volumeSeriesRef.current.setData(vol);
      chartRef.current?.timeScale().fitContent();
    }

    prevCandlesRef.current = curr;
  }, [candles]);

  // ── Indicator Visibility + Data ────────────────────────────────────────────
  useEffect(() => {
    if (!smaSeriesRef.current) return;

    const showSMA = activeIndicators.includes('SMA');
    smaSeriesRef.current.applyOptions({ visible: showSMA });
    if (showSMA && indicatorData.sma.length > 0) {
      smaSeriesRef.current.setData(
        indicatorData.sma.map((d) => ({ time: d.time as Time, value: d.value }))
      );
    }
  }, [activeIndicators, indicatorData.sma]);

  useEffect(() => {
    if (!emaSeriesRef.current) return;
    const show = activeIndicators.includes('EMA');
    emaSeriesRef.current.applyOptions({ visible: show });
    if (show && indicatorData.ema.length > 0) {
      emaSeriesRef.current.setData(
        indicatorData.ema.map((d) => ({ time: d.time as Time, value: d.value }))
      );
    }
  }, [activeIndicators, indicatorData.ema]);

  useEffect(() => {
    if (!vwapSeriesRef.current) return;
    const show = activeIndicators.includes('VWAP');
    vwapSeriesRef.current.applyOptions({ visible: show });
    if (show && indicatorData.vwap.length > 0) {
      vwapSeriesRef.current.setData(
        indicatorData.vwap.map((d) => ({ time: d.time as Time, value: d.value }))
      );
    }
  }, [activeIndicators, indicatorData.vwap]);

  useEffect(() => {
    if (!bbUpperRef.current || !bbMiddleRef.current || !bbLowerRef.current) return;
    const show = activeIndicators.includes('BOLLINGER');
    bbUpperRef.current.applyOptions({ visible: show });
    bbMiddleRef.current.applyOptions({ visible: show });
    bbLowerRef.current.applyOptions({ visible: show });
    if (show && indicatorData.bollinger.length > 0) {
      bbUpperRef.current.setData(
        indicatorData.bollinger.map((d) => ({ time: d.time as Time, value: d.upper }))
      );
      bbMiddleRef.current.setData(
        indicatorData.bollinger.map((d) => ({ time: d.time as Time, value: d.middle }))
      );
      bbLowerRef.current.setData(
        indicatorData.bollinger.map((d) => ({ time: d.time as Time, value: d.lower }))
      );
    }
  }, [activeIndicators, indicatorData.bollinger]);

  return (
    <div className="candlestick-chart-wrapper">
      {/* ── OHLCV Info bar (Zerodha-style: top-left of chart) ──────────── */}
      <div
        ref={tooltipRef}
        className="chart-ohlcv-tooltip"
        style={{ opacity: 0 }}
        aria-live="polite"
        aria-label="Candle OHLCV info"
      />
      {/* ── LWC Canvas Container ────────────────────────────────────────── */}
      <div ref={containerRef} className="candlestick-chart-canvas" id="candlestick-chart-container" />
    </div>
  );
};
