import mongoose, { Schema, Document } from 'mongoose';

export interface IHistoricalPrice extends Document {
  symbol:    string;
  timeframe: string; // e.g., '1D'
  timestamp: Date;
  open:      mongoose.Types.Decimal128;
  high:      mongoose.Types.Decimal128;
  low:       mongoose.Types.Decimal128;
  close:     mongoose.Types.Decimal128;
  volume:    number;
}

const HistoricalPriceSchema = new Schema<IHistoricalPrice>(
  {
    symbol:    { type: String, required: true, uppercase: true },
    timeframe: { type: String, required: true, default: '1D' },
    timestamp: { type: Date, required: true },
    open:      { type: mongoose.Schema.Types.Decimal128, required: true },
    high:      { type: mongoose.Schema.Types.Decimal128, required: true },
    low:       { type: mongoose.Schema.Types.Decimal128, required: true },
    close:     { type: mongoose.Schema.Types.Decimal128, required: true },
    volume:    { type: Number, default: 0 }
  },
  {
    timestamps: true,
    collection: 'historical_prices',
    toJSON: {
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        if (ret['open']) ret['open'] = String(ret['open']);
        if (ret['high']) ret['high'] = String(ret['high']);
        if (ret['low']) ret['low'] = String(ret['low']);
        if (ret['close']) ret['close'] = String(ret['close']);
        return ret;
      },
    },
  }
);

HistoricalPriceSchema.index({ symbol: 1, timeframe: 1, timestamp: 1 }, { unique: true });

export const HistoricalPrice = mongoose.model<IHistoricalPrice>('HistoricalPrice', HistoricalPriceSchema);
