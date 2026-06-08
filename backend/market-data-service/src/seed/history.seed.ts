import { HistoricalPrice } from '../models/HistoricalPrice.model';
import { MarketSnapshot } from '../models/MarketSnapshot.model';
import { toDecimal128 } from '@trade-x/shared';
import { createLogger } from '@trade-x/shared';

const logger = createLogger('market-data-service');

export const seedHistory = async (): Promise<void> => {
  try {
    const existingCount = await HistoricalPrice.countDocuments();
    if (existingCount > 0) {
      logger.info('Historical data already seeded.');
      return;
    }

    const snapshots = await MarketSnapshot.find({});
    if (snapshots.length === 0) {
      logger.info('No symbols found to seed history for.');
      return;
    }

    const DAYS_IN_5_YEARS = 365 * 5;
    const docs = [];
    const now = new Date();
    // Round to start of day for cleaner daily candles
    now.setUTCHours(0, 0, 0, 0);

    for (const snapshot of snapshots) {
      const targetPrice = parseFloat(snapshot.lastTradedPrice.toString());
      let currentPrice = targetPrice * 0.5; // Start 5 years ago at half the price
      const dailyDrift = (targetPrice - currentPrice) / DAYS_IN_5_YEARS;

      for (let i = DAYS_IN_5_YEARS; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        
        const volatility = currentPrice * 0.03; // 3% volatility
        const open = currentPrice;
        let close = currentPrice + dailyDrift + (Math.random() - 0.5) * volatility;
        if (close < 1) close = 1; // prevent negative prices

        const high = Math.max(open, close) + Math.random() * (volatility * 0.5);
        const low = Math.min(open, close) - Math.random() * (volatility * 0.5);
        
        docs.push({
          symbol: snapshot.symbol,
          timeframe: '1D',
          timestamp: date,
          open: toDecimal128(open),
          high: toDecimal128(high),
          low: toDecimal128(low),
          close: toDecimal128(close),
          volume: Math.floor(Math.random() * 50000) + 1000
        });
        
        currentPrice = close;
      }
    }

    const chunkSize = 5000;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      await HistoricalPrice.insertMany(chunk);
    }

    logger.info(`Seeded ${docs.length} historical price candles.`);
  } catch (error) {
    logger.error('Failed to seed historical data', error);
  }
};
