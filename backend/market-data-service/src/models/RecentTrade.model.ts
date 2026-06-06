import mongoose, { Schema, Document } from 'mongoose';

/**
 * RecentTrade — rolling window of the last N trades per symbol.
 * Used for the trade feed display on the trading UI.
 *
 * makerSide: 'BUY' = buyer was the resting order (green tick)
 *            'SELL' = seller was the resting order (red tick)
 */
export interface IRecentTrade extends Document {
  tradeId:   string;
  symbol:    string;
  price:     mongoose.Types.Decimal128;
  quantity:  number;
  makerSide: 'BUY' | 'SELL';
  executedAt:Date;
  createdAt: Date;
}

const RecentTradeSchema = new Schema<IRecentTrade>(
  {
    tradeId:    { type: String, required: true, unique: true },
    symbol:     { type: String, required: true, uppercase: true },
    price:      { type: mongoose.Schema.Types.Decimal128, required: true },
    quantity:   { type: Number, required: true },
    makerSide:  { type: String, enum: ['BUY', 'SELL'], required: true },
    executedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    collection: 'recent_trades',
    toJSON: {
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        if (ret['price']) ret['price'] = String(ret['price']);
        return ret;
      },
    },
  },
);

// Most recent trades first, per symbol
RecentTradeSchema.index({ symbol: 1, executedAt: -1 });
// TTL index: auto-delete trades older than 24 hours (rolling window)
RecentTradeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export const RecentTrade = mongoose.model<IRecentTrade>('RecentTrade', RecentTradeSchema);
