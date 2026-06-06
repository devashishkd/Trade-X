import mongoose, { Schema, Document } from 'mongoose';

/**
 * PortfolioTransaction — immutable audit trail of all portfolio changes.
 *
 * type:
 *   BUY_FILL     — shares received from a filled buy order
 *   SELL_FILL    — shares removed by a filled sell order
 *   LOCK         — shares reserved for an open sell order
 *   UNLOCK       — shares released from a cancelled sell order
 *   ADJUSTMENT   — admin correction
 */
export type PortfolioTxType =
  | 'BUY_FILL'
  | 'SELL_FILL'
  | 'LOCK'
  | 'UNLOCK'
  | 'ADJUSTMENT';

export interface IPortfolioTransaction extends Document {
  txId:      string;
  userId:    string;
  symbol:    string;
  type:      PortfolioTxType;
  quantity:  number;
  price:     mongoose.Types.Decimal128 | null; // null for LOCK/UNLOCK
  orderId:   string | null;
  tradeId:   string | null;
  createdAt: Date;
}

const PortfolioTransactionSchema = new Schema<IPortfolioTransaction>(
  {
    txId:     { type: String, required: true },
    userId:   { type: String, required: true },
    symbol:   { type: String, required: true, uppercase: true },
    type:     {
      type: String,
      enum: ['BUY_FILL', 'SELL_FILL', 'LOCK', 'UNLOCK', 'ADJUSTMENT'],
      required: true,
    },
    quantity: { type: Number, required: true },
    price:    { type: mongoose.Schema.Types.Decimal128, default: null },
    orderId:  { type: String, default: null },
    tradeId:  { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'portfolio_transactions',
    toJSON: {
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        if (ret['price']) ret['price'] = String(ret['price']);
        return ret;
      },
    },
  },
);

PortfolioTransactionSchema.index({ userId: 1, createdAt: -1 }); // Transaction history
PortfolioTransactionSchema.index({ tradeId: 1 }, { sparse: true }); // Trade idempotency check

export const PortfolioTransaction = mongoose.model<IPortfolioTransaction>(
  'PortfolioTransaction',
  PortfolioTransactionSchema,
);
