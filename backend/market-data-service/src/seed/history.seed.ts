import { HistoricalPrice } from '../models/HistoricalPrice.model';
import { MarketSnapshot } from '../models/MarketSnapshot.model';
import { toDecimal128 } from '@trade-x/shared';
import { createLogger } from '@trade-x/shared';

const logger = createLogger('market-data-service');

/**
 * NSE 4H candle session boundaries in UTC.
 * Indian markets run 9:15 AM – 3:30 PM IST (UTC+5:30).
 *
 * We split each trading day into two 4H buckets:
 *   Session 1: 9:15 AM IST  = 03:45 UTC
 *   Session 2: 1:15 PM IST  = 07:45 UTC
 *
 * This matches the live `upsertLiveCandle` bucketing in marketData.service.ts.
 */
const NSE_4H_SESSION_1_UTC = { h: 3, m: 45 }; // 9:15 IST
const NSE_4H_SESSION_2_UTC = { h: 7, m: 45 }; // 13:15 IST

export const seedHistory = async (): Promise<void> => {
  try {
    // ── NOTE: No early-exit guard. A DB wipe followed by re-seeding must work. ──
    const existingCount = await HistoricalPrice.countDocuments();
    if (existingCount > 0) {
      logger.info(`Historical data already seeded (${existingCount} documents). Skipping.`);
      return;
    }

    const snapshots = await MarketSnapshot.find({});
    if (snapshots.length === 0) {
      logger.info('No symbols found to seed history for.');
      return;
    }

    // 5 years of calendar days (~1825 days, ~1305 trading days after weekend skip)
    const DAYS_IN_5_YEARS = 365 * 5;
    const docs: any[] = [];
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    for (const snapshot of snapshots) {
      const targetPrice = parseFloat(snapshot.lastTradedPrice.toString());
      // Start 5 years ago at 40% of current price, drift linearly to current
      let currentPrice = targetPrice * 0.4;
      const dailyDrift = (targetPrice - currentPrice) / DAYS_IN_5_YEARS;

      // ── Weekly aggregation state ──────────────────────────────────────────────
      // Week boundaries: Sunday midnight UTC
      let weekBoundary = new Date(now.getTime() - DAYS_IN_5_YEARS * 86_400_000);
      // Advance to next Sunday
      weekBoundary.setUTCDate(weekBoundary.getUTCDate() + (7 - weekBoundary.getUTCDay()) % 7);
      weekBoundary.setUTCHours(0, 0, 0, 0);

      let wOpen = currentPrice,
        wHigh = currentPrice,
        wLow = currentPrice,
        wClose = currentPrice,
        wVol = 0,
        wStarted = false;

      for (let i = DAYS_IN_5_YEARS; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 86_400_000);
        date.setUTCHours(0, 0, 0, 0);

        // Skip weekends (Saturday = 6, Sunday = 0) — NSE is closed
        if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;

        const volatility = currentPrice * 0.03;
        const open = currentPrice;
        let close = currentPrice + dailyDrift + (Math.random() - 0.5) * volatility;
        if (close < 1) close = 1;

        const high = Math.max(open, close) + Math.random() * volatility * 0.5;
        const low = Math.min(open, close) - Math.random() * volatility * 0.5;
        const volume = Math.floor(Math.random() * 500_000) + 100_000;

        // ── 1D Candle ─────────────────────────────────────────────────────────
        docs.push({
          symbol: snapshot.symbol,
          timeframe: '1D',
          timestamp: date,
          open: toDecimal128(open),
          high: toDecimal128(high),
          low: toDecimal128(low),
          close: toDecimal128(close),
          volume,
        });

        // ── 1W Candle Aggregation ────────────────────────────────────────────
        if (!wStarted) {
          wOpen = open;
          wHigh = high;
          wLow = low;
          wVol = volume;
          wStarted = true;
        } else {
          wHigh = Math.max(wHigh, high);
          wLow = Math.min(wLow, low);
          wVol += volume;
        }
        wClose = close;

        // Flush weekly candle when we cross the week boundary
        if (date >= weekBoundary || i === 0) {
          docs.push({
            symbol: snapshot.symbol,
            timeframe: '1W',
            timestamp: weekBoundary,
            open: toDecimal128(wOpen),
            high: toDecimal128(wHigh),
            low: toDecimal128(wLow),
            close: toDecimal128(wClose),
            volume: wVol,
          });
          // Advance to the next Sunday boundary
          const nextWeek = new Date(date.getTime());
          nextWeek.setUTCDate(nextWeek.getUTCDate() + (7 - nextWeek.getUTCDay()) % 7 || 7);
          nextWeek.setUTCHours(0, 0, 0, 0);
          weekBoundary = nextWeek;
          wStarted = false;
        }

        // ── 4H Candles — NSE IST session aligned ────────────────────────────
        // Session 1: 9:15 AM IST  → stored as 03:45 UTC
        // Session 2: 1:15 PM IST  → stored as 07:45 UTC
        const midPrice =
          (open + close) / 2 + (Math.random() - 0.5) * volatility * 0.2;

        const h1Time = new Date(date);
        h1Time.setUTCHours(NSE_4H_SESSION_1_UTC.h, NSE_4H_SESSION_1_UTC.m, 0, 0);

        const h2Time = new Date(date);
        h2Time.setUTCHours(NSE_4H_SESSION_2_UTC.h, NSE_4H_SESSION_2_UTC.m, 0, 0);

        // Session 1: Open → Mid (~60% of daily volume)
        docs.push({
          symbol: snapshot.symbol,
          timeframe: '4H',
          timestamp: h1Time,
          open: toDecimal128(open),
          high: toDecimal128(Math.max(open, midPrice, high * 0.99)),
          low: toDecimal128(Math.min(open, midPrice, low * 1.01)),
          close: toDecimal128(midPrice),
          volume: Math.floor(volume * 0.6),
        });

        // Session 2: Mid → Close (~40% of daily volume)
        docs.push({
          symbol: snapshot.symbol,
          timeframe: '4H',
          timestamp: h2Time,
          open: toDecimal128(midPrice),
          high: toDecimal128(Math.max(midPrice, close, high * 0.99)),
          low: toDecimal128(Math.min(midPrice, close, low * 1.01)),
          close: toDecimal128(close),
          volume: Math.floor(volume * 0.4),
        });

        currentPrice = close;
      }
    }

    // ── Batch insert in chunks of 5000, ignoring duplicates (ordered: false) ────
    const CHUNK_SIZE = 5000;
    let inserted = 0;
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      try {
        await HistoricalPrice.insertMany(chunk, { ordered: false });
        inserted += chunk.length;
      } catch (err: any) {
        // E11000 = duplicate key — safe to skip on re-seed
        if (err.code !== 11000 && err.name !== 'BulkWriteError') {
          throw err;
        }
        inserted += err.insertedDocs?.length ?? 0;
      }
    }

    logger.info(`Seeded ${inserted} historical price candles (1D, 1W, 4H — IST aligned).`);
  } catch (error) {
    logger.error('Failed to seed historical data', error);
  }
};
