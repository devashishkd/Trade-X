import mongoose, { Schema, Document } from 'mongoose';

/**
 * MarketSnapshot — persisted OHLCV + LTP per symbol.
 * Updated on every TRADE_EXECUTED event.
 *
 * open:  first trade price of the day
 * high:  highest trade price of the day
 * low:   lowest trade price of the day
 * close: last trade price (= lastTradedPrice, updated continuously)
 * volume: total shares traded today
 */
export interface IMarketSnapshot extends Document {
  symbol:          string;
  name:            string;
  lastTradedPrice: mongoose.Types.Decimal128;
  openPrice:       mongoose.Types.Decimal128;
  highPrice:       mongoose.Types.Decimal128;
  lowPrice:        mongoose.Types.Decimal128;
  closePrice:      mongoose.Types.Decimal128;
  volume:          number;
  tradeCount:      number;
  change:          mongoose.Types.Decimal128;   // LTP - openPrice
  changePct:       mongoose.Types.Decimal128;   // (LTP - openPrice) / openPrice × 100
  updatedAt:       Date;
  createdAt:       Date;
}

const MarketSnapshotSchema = new Schema<IMarketSnapshot>(
  {
    symbol: { type: String, required: true, uppercase: true, unique: true },
    name:   { type: String, required: true },

    lastTradedPrice: { type: mongoose.Schema.Types.Decimal128, required: true },
    openPrice:       { type: mongoose.Schema.Types.Decimal128, required: true },
    highPrice:       { type: mongoose.Schema.Types.Decimal128, required: true },
    lowPrice:        { type: mongoose.Schema.Types.Decimal128, required: true },
    closePrice:      { type: mongoose.Schema.Types.Decimal128, required: true },

    volume:     { type: Number, default: 0 },
    tradeCount: { type: Number, default: 0 },

    change:    { type: mongoose.Schema.Types.Decimal128, default: () => mongoose.Types.Decimal128.fromString('0') },
    changePct: { type: mongoose.Schema.Types.Decimal128, default: () => mongoose.Types.Decimal128.fromString('0') },
  },
  {
    timestamps: true,
    collection: 'market_snapshots',
    toJSON: {
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        const decimalFields = ['lastTradedPrice', 'openPrice', 'highPrice', 'lowPrice', 'closePrice', 'change', 'changePct'];
        for (const f of decimalFields) {
          if (ret[f]) ret[f] = String(ret[f]);
        }
        return ret;
      },
    },
  },
);

export const MarketSnapshot = mongoose.model<IMarketSnapshot>('MarketSnapshot', MarketSnapshotSchema);
