import { MarketSnapshot } from '../models/MarketSnapshot.model';
import { toDecimal128 } from '@trade-x/shared';
import { createLogger } from '@trade-x/shared';

const logger = createLogger('market-data-service');

/**
 * Initial symbol definitions per the design spec.
 * Run once on startup if symbols don't exist yet.
 */
const INITIAL_SYMBOLS = [
  { symbol: 'AAPL', name: 'Apple Inc.',       price: 152.50 },
  { symbol: 'GOOG', name: 'Alphabet Inc.',    price: 2800.00 },
  { symbol: 'TSLA', name: 'Tesla Inc.',       price: 250.00 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 3400.00 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 310.00 },
  { symbol: 'NFLX', name: 'Netflix Inc.',    price: 450.00 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.',    price: 875.00 },
  { symbol: 'META', name: 'Meta Platforms',  price: 520.00 },
];

/**
 * Seed initial symbols with starting prices.
 * Idempotent — skips symbols that already exist.
 */
export const seedSymbols = async (): Promise<void> => {
  let seeded = 0;

  for (const sym of INITIAL_SYMBOLS) {
    const exists = await MarketSnapshot.findOne({ symbol: sym.symbol });
    if (exists) continue;

    const d128 = (v: number) => toDecimal128(v);

    await MarketSnapshot.create({
      symbol:          sym.symbol,
      name:            sym.name,
      lastTradedPrice: d128(sym.price),
      openPrice:       d128(sym.price),
      highPrice:       d128(sym.price),
      lowPrice:        d128(sym.price),
      closePrice:      d128(sym.price),
      volume:          0,
      tradeCount:      0,
      change:          d128(0),
      changePct:       d128(0),
    });
    seeded++;
  }

  if (seeded > 0) {
    logger.info(`Seeded ${seeded} symbol(s)`, { symbols: INITIAL_SYMBOLS.map(s => s.symbol) });
  } else {
    logger.info('All symbols already seeded');
  }
};
