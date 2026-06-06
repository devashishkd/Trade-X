import mongoose, { Schema, Document } from 'mongoose';

/**
 * Trade — persistent record of an executed trade in portfolio context.
 * Written when a TRADE_EXECUTED event is received from the Matching Engine.
 *
 * Both buyer and seller get their own Trade document.
 * side = BUY if this user was the buyer, SELL if seller.
 */
export interface ITrade extends Document {
  tradeId:    string;
  userId:     string;
  symbol:     string;
  side:       'BUY' | 'SELL';
  quantity:   number;
  price:      mongoose.Types.Decimal128;
  orderId:    string;
  executedAt: Date;
  createdAt:  Date;
}

const TradeSchema = new Schema<ITrade>(
  {
    tradeId:    { type: String, required: true },
    userId:     { type: String, required: true },
    symbol:     { type: String, required: true, uppercase: true },
    side:       { type: String, enum: ['BUY', 'SELL'], required: true },
    quantity:   { type: Number, required: true },
    price:      { type: mongoose.Schema.Types.Decimal128, required: true },
    orderId:    { type: String, required: true },
    executedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    collection: 'portfolio_trades',
    toJSON: {
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        if (ret['price']) ret['price'] = String(ret['price']);
        return ret;
      },
    },
  },
);

// Per-user trade history
TradeSchema.index({ userId: 1, executedAt: -1 });
TradeSchema.index({ userId: 1, symbol: 1, executedAt: -1 });
// Idempotency: prevent duplicate processing of the same trade-side
TradeSchema.index({ tradeId: 1, userId: 1 }, { unique: true });

export const Trade = mongoose.model<ITrade>('Trade', TradeSchema);
