import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, LineSeries } from 'lightweight-charts';

interface SparklineData {
  time: number;
  value: number;
}

interface SparklineProps {
  data: SparklineData[];
  color?: string;
  isPositive?: boolean;
}

export const SparklineChart: React.FC<SparklineProps> = ({ data, color, isPositive = true }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'transparent',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      handleScroll: false,
      handleScale: false,
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    const defaultColor = isPositive ? '#06b6d4' : '#ef4444'; // cyan-500 or red-500 (neon aesthetic)

    const lineSeries = chart.addSeries(LineSeries, {
      color: color || defaultColor,
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    if (data.length > 0) {
      // Ensure unique sorted data
      const sortedData = [...data].sort((a, b) => a.time - b.time);
      const uniqueData: SparklineData[] = [];
      sortedData.forEach(d => {
        const last = uniqueData[uniqueData.length - 1];
        if (!last || last.time !== d.time) {
          uniqueData.push(d);
        } else {
          last.value = d.value;
        }
      });
      lineSeries.setData(uniqueData as any);
      chart.timeScale().fitContent();
    }

    chartRef.current = chart;
    seriesRef.current = lineSeries;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || entries[0].target !== chartContainerRef.current) return;
      const newRect = entries[0].contentRect;
      if (chartRef.current) {
        chartRef.current.applyOptions({ width: newRect.width, height: newRect.height });
        chartRef.current.timeScale().fitContent();
      }
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      const sortedData = [...data].sort((a, b) => a.time - b.time);
      const uniqueData: SparklineData[] = [];
      sortedData.forEach(d => {
        const last = uniqueData[uniqueData.length - 1];
        if (!last || last.time !== d.time) {
          uniqueData.push(d);
        } else {
          last.value = d.value;
        }
      });
      seriesRef.current.setData(uniqueData as any);
      chartRef.current?.timeScale().fitContent();
    }
  }, [data]);

  return <div className="w-full h-full" ref={chartContainerRef} />;
};
