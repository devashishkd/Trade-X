import { useEffect } from 'react';
import { getSocket } from '../services/socket';
import { useMarketDataStore } from '../stores/useMarketDataStore';
import type { Candle, Timeframe } from '../types/chart.types';

export const useChartSocketManager = (symbol: string, activeTimeframe: Timeframe) => {
  const updateLatestCandle = useMarketDataStore((s) => s.updateLatestCandle);

  useEffect(() => {
    if (!symbol) return;
    const socket = getSocket();

    socket.emit('subscribe', symbol);

    const handleCandleUpdate = (data: {
      symbol: string;
      timeframe: Timeframe;
      candle: Candle;
    }) => {
      if (data.symbol === symbol.toUpperCase()) {
        updateLatestCandle(symbol, data.timeframe, data.candle);
      }
    };

    socket.on('candle_update', handleCandleUpdate);

    return () => {
      socket.off('candle_update', handleCandleUpdate);
      socket.emit('unsubscribe', symbol);
    };
  }, [symbol, activeTimeframe, updateLatestCandle]);
};
