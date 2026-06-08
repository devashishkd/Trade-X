import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';

interface TradeData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface TradingChartProps {
  data: TradeData[];
  symbol: string;
}

export const TradingChart: React.FC<TradingChartProps> = ({ data }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9da3af', // text-secondary
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    // Ensure data is sorted by time
    const sortedData = [...data].sort((a, b) => a.time - b.time);
    
    // Deduplicate by time (lightweight-charts requires unique times)
    const uniqueData: TradeData[] = [];
    sortedData.forEach(d => {
      const last = uniqueData[uniqueData.length - 1];
      if (!last || last.time !== d.time) {
        uniqueData.push(d);
      } else {
        // If same timestamp, update the close value
        last.close = d.close;
        last.high = Math.max(last.high, d.high);
        last.low = Math.min(last.low, d.low);
      }
    });

    candlestickSeries.setData(uniqueData as any);

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || entries[0].target !== chartContainerRef.current) return;
      const newRect = entries[0].contentRect;
      if (chartRef.current) {
        chartRef.current.applyOptions({ width: newRect.width, height: newRect.height });
      }
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // Update data when it changes
  useEffect(() => {
    if (seriesRef.current) {
      if (data.length > 0) {
        const sortedData = [...data].sort((a, b) => a.time - b.time);
        const uniqueData: TradeData[] = [];
        sortedData.forEach(d => {
          const last = uniqueData[uniqueData.length - 1];
          if (!last || last.time !== d.time) {
            uniqueData.push(d);
          } else {
            last.close = d.close;
            last.high = Math.max(last.high, d.high);
            last.low = Math.min(last.low, d.low);
          }
        });
        seriesRef.current.setData(uniqueData as any);
      } else {
        seriesRef.current.setData([]);
      }
    }
  }, [data]);

  return (
    <div className="w-full h-full relative" ref={chartContainerRef}>
      {data.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 z-10 pointer-events-none">
          Waiting for trades...
        </div>
      )}
    </div>
  );
};
