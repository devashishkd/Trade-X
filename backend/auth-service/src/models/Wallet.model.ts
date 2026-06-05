import mongoose, { Schema, Document } from 'mongoose';

export interface IWallet extends Document {
  userId:           string;
  availableBalance: mongoose.Types.Decimal128;
  lockedBalance:    mongoose.Types.Decimal128;
  currency:         string;
  version:          number;
  createdAt:        Date;
  updatedAt:        Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    userId: { type: String, required: true },
    availableBalance: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0'),
    },
    lockedBalance: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0'),
    },
    currency: { type: String, default: 'USD' },
    // Optimistic locking: increment on every write, check before update
    version:  { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'wallets',
    toJSON: {
      transform: (_, ret) => {
        // Serialize Decimal128 as strings in JSON (not BSON objects)
        if (ret.availableBalance) ret.availableBalance = ret.availableBalance.toString();
        if (ret.lockedBalance)    ret.lockedBalance    = ret.lockedBalance.toString();
        return ret;
      },
    },
  },
);

WalletSchema.index({ userId: 1 }, { unique: true });

export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
