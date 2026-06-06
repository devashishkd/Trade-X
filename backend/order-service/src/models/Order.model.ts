import mongoose, { Schema, Document } from 'mongoose';
import { OrderSide, OrderType, OrderStatus, TimeInForce } from '@trade-x/shared';

export interface IOrderFill {
  tradeId:    string;
  quantity:   number;
  price:      mongoose.Types.Decimal128;
  executedAt: Date;
}

export interface IOrder extends Document {
  orderId:           string;
  userId:            string;
  symbol:            string;
  side:              OrderSide;
  type:              OrderType;
  status:            OrderStatus;
  price:             mongoose.Types.Decimal128 | null;
  stopPrice:         mongoose.Types.Decimal128 | null;
  quantity:          number;
  filledQuantity:    number;
  remainingQuantity: number;
  averagePrice:      mongoose.Types.Decimal128 | null;
  timeInForce:       TimeInForce;
  fills:             IOrderFill[];
  rejectionReason:   string | null;
  cancelledAt:       Date | null;
  filledAt:          Date | null;
  createdAt:         Date;
  updatedAt:         Date;
}

const FillSchema = new Schema<IOrderFill>(
  {
    tradeId:    { type: String, required: true },
    quantity:   { type: Number, required: true },
    price:      { type: mongoose.Schema.Types.Decimal128, required: true },
    executedAt: { type: Date,   required: true },
  },
  { _id: false },
);

const OrderSchema = new Schema<IOrder>(
  {
    orderId:  { type: String, required: true },
    userId:   { type: String, required: true },
    symbol:   { type: String, required: true, uppercase: true, trim: true },
    side:     { type: String, enum: ['BUY', 'SELL'], required: true },
    type:     { type: String, enum: ['LIMIT','MARKET','STOP_LOSS','STOP_LIMIT','ICEBERG','GTT','BRACKET','COVER'], required: true },
    status:   { type: String, enum: ['PENDING','OPEN','PARTIAL','FILLED','CANCELLED','REJECTED'], default: 'PENDING' },

    price:             { type: mongoose.Schema.Types.Decimal128, default: null },
    stopPrice:         { type: mongoose.Schema.Types.Decimal128, default: null },
    quantity:          { type: Number, required: true, min: 1 },
    filledQuantity:    { type: Number, default: 0 },
    remainingQuantity: { type: Number, required: true },
    averagePrice:      { type: mongoose.Schema.Types.Decimal128, default: null },
    timeInForce:       { type: String, enum: ['GTC','IOC','FOK','GTT'], default: 'GTC' },

    fills:           { type: [FillSchema], default: [] },
    rejectionReason: { type: String, default: null },
    cancelledAt:     { type: Date, default: null },
    filledAt:        { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'orders',
    toJSON: {
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        if (ret['price'])        ret['price']        = String(ret['price']);
        if (ret['averagePrice']) ret['averagePrice']  = String(ret['averagePrice']);
        if (ret['stopPrice'])    ret['stopPrice']     = String(ret['stopPrice']);
        if (Array.isArray(ret['fills'])) {
          ret['fills'] = (ret['fills'] as Array<Record<string, unknown>>).map(f => ({
            ...f,
            price: f['price'] != null ? String(f['price']) : f['price'],
          }));
        }
        return ret;
      },
    },
  },
);

// ── Indexes ────────────────────────────────────────────────────────────────
OrderSchema.index({ orderId: 1 },                            { unique: true });
OrderSchema.index({ userId: 1, createdAt: -1 });              // User order history (most common)
OrderSchema.index({ symbol: 1, status: 1, createdAt: -1 });   // Engine book reconstruction on startup
OrderSchema.index({ userId: 1, status: 1 });                  // "My open orders" filter
OrderSchema.index({ status: 1 });                             // Admin / monitoring queries

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
