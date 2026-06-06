import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, LineSeries } from 'lightweight-charts';

interface TradeData {
  time: number;
  value: number;
}

interface TradingChartProps {
  data: TradeData[];
  symbol: string;
}

export const TradingChart: React.FC<TradingChartProps> = ({ data, symbol }) => {
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

    const lineSeries = chart.addSeries(LineSeries, {
      color: '#8b5cf6', // accent-secondary
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
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
        // If same timestamp, update the value
        last.value = d.value;
      }
    });

    lineSeries.setData(uniqueData);

    chartRef.current = chart;
    seriesRef.current = lineSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update data when it changes
  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      const sortedData = [...data].sort((a, b) => a.time - b.time);
      const uniqueData: TradeData[] = [];
      sortedData.forEach(d => {
        const last = uniqueData[uniqueData.length - 1];
        if (!last || last.time !== d.time) {
          uniqueData.push(d);
        } else {
          last.value = d.value;
        }
      });
      seriesRef.current.setData(uniqueData);
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
