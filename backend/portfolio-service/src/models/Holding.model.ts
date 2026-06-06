import mongoose, { Schema, Document } from 'mongoose';

/**
 * Holding — tracks a user's share position for a single symbol.
 *
 * availableQty: shares that can be sold or transferred
 * lockedQty:    shares reserved for open SELL orders (cannot be sold again)
 * totalQty:     availableQty + lockedQty (computed, not stored)
 *
 * avgCostBasis: weighted average price paid across all buy fills.
 * Recomputed on every BUY trade fill using WAP formula.
 */
export interface IHolding extends Document {
  userId:       string;
  symbol:       string;
  availableQty: number;
  lockedQty:    number;
  avgCostBasis: mongoose.Types.Decimal128; // weighted average cost
  version:      number;                   // optimistic lock
  updatedAt:    Date;
  createdAt:    Date;
}

const HoldingSchema = new Schema<IHolding>(
  {
    userId:       { type: String, required: true },
    symbol:       { type: String, required: true, uppercase: true, trim: true },
    availableQty: { type: Number, required: true, default: 0, min: 0 },
    lockedQty:    { type: Number, required: true, default: 0, min: 0 },
    avgCostBasis: {
      type:    mongoose.Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0'),
    },
    version: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'holdings',
    toJSON: {
      virtuals: true,
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        if (ret['avgCostBasis']) ret['avgCostBasis'] = String(ret['avgCostBasis']);
        return ret;
      },
    },
  },
);

// Compound unique index — one holding per user per symbol
HoldingSchema.index({ userId: 1, symbol: 1 }, { unique: true });
HoldingSchema.index({ userId: 1 });

export const Holding = mongoose.model<IHolding>('Holding', HoldingSchema);
