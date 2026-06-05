import { Wallet }  from '../models/Wallet.model';
import { toDecimal128, fromDecimal128, AppError } from '@trade-x/shared';

const MAX_RETRIES = 3;

// ─── Get Balance ───────────────────────────────────────────────────────────
export const getBalance = async (userId: string) => {
  const wallet = await Wallet.findOne({ userId });
  if (!wallet) throw new AppError('NOT_FOUND', 404, 'Wallet not found');

  const available = fromDecimal128(wallet.availableBalance);
  const locked    = fromDecimal128(wallet.lockedBalance);

  return {
    userId,
    availableBalance: available.toFixed(2),
    lockedBalance:    locked.toFixed(2),
    totalBalance:     (available + locked).toFixed(2),
    currency:         wallet.currency,
  };
};

// ─── Deposit ───────────────────────────────────────────────────────────────
export const deposit = async (userId: string, amount: number) => {
  const wallet = await Wallet.findOne({ userId });
  if (!wallet) throw new AppError('NOT_FOUND', 404, 'Wallet not found');

  const prevBalance = fromDecimal128(wallet.availableBalance);
  const newBalance  = prevBalance + amount;

  await Wallet.findOneAndUpdate(
    { userId },
    { $set: { availableBalance: toDecimal128(newBalance) } },
  );

  return {
    previousBalance:  prevBalance.toFixed(2),
    depositAmount:    amount.toFixed(2),
    availableBalance: newBalance.toFixed(2),
    currency:         wallet.currency,
  };
};

// ─── Lock Funds (optimistic locking with retry) ────────────────────────────
// Called when a BUY order is placed. Moves funds from available → locked.
export const lockFunds = async (
  userId: string,
  amount: number,
  _orderId: string,
): Promise<void> => {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) throw new AppError('NOT_FOUND', 404, 'Wallet not found');

    const available = fromDecimal128(wallet.availableBalance);
    if (available < amount) {
      throw new AppError(
        'INSUFFICIENT_BALANCE',
        422,
        `Insufficient balance. Available: $${available.toFixed(2)}, Required: $${amount.toFixed(2)}`,
      );
    }

    const locked = fromDecimal128(wallet.lockedBalance);

    // Optimistic lock: only update if version hasn't changed since we read it
    const updated = await Wallet.findOneAndUpdate(
      { userId, version: wallet.version },
      {
        $inc: { version: 1 },
        $set: {
          availableBalance: toDecimal128(available - amount),
          lockedBalance:    toDecimal128(locked + amount),
        },
      },
    );

    if (updated) return; // Success — version matched, update applied
    // Version mismatch: another request modified wallet concurrently → retry
  }

  throw new AppError('CONFLICT', 409, 'Could not lock funds after multiple retries');
};

// ─── Unlock Funds ──────────────────────────────────────────────────────────
// Called when an order is cancelled. Moves funds from locked → available.
export const unlockFunds = async (
  userId: string,
  amount: number,
  _orderId: string,
): Promise<void> => {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) throw new AppError('NOT_FOUND', 404, 'Wallet not found');

    const available    = fromDecimal128(wallet.availableBalance);
    const locked       = fromDecimal128(wallet.lockedBalance);
    // Safety: never unlock more than what is actually locked
    const unlockAmount = Math.min(amount, locked);

    const updated = await Wallet.findOneAndUpdate(
      { userId, version: wallet.version },
      {
        $inc: { version: 1 },
        $set: {
          availableBalance: toDecimal128(available + unlockAmount),
          lockedBalance:    toDecimal128(locked - unlockAmount),
        },
      },
    );

    if (updated) return;
  }

  throw new AppError('CONFLICT', 409, 'Could not unlock funds after multiple retries');
};

// ─── Settle Trade ──────────────────────────────────────────────────────────
// Called after a trade executes.
// Buyer: locked funds are consumed (lockedBalance decreases, no return to available).
// Seller: receives trade value in availableBalance.
export const settle = async (
  _tradeId: string,
  buyerId:  string,
  sellerId: string,
  amount:   number,
): Promise<void> => {
  const [buyerWallet, sellerWallet] = await Promise.all([
    Wallet.findOne({ userId: buyerId }),
    Wallet.findOne({ userId: sellerId }),
  ]);

  if (!buyerWallet)  throw new AppError('NOT_FOUND', 404, `Buyer wallet not found`);
  if (!sellerWallet) throw new AppError('NOT_FOUND', 404, `Seller wallet not found`);

  // Buyer: deduct from lockedBalance (funds were locked at order placement)
  const buyerLocked = fromDecimal128(buyerWallet.lockedBalance);
  await Wallet.findOneAndUpdate(
    { userId: buyerId },
    { $set: { lockedBalance: toDecimal128(Math.max(0, buyerLocked - amount)) } },
  );

  // Seller: credit availableBalance with trade proceeds
  const sellerAvailable = fromDecimal128(sellerWallet.availableBalance);
  await Wallet.findOneAndUpdate(
    { userId: sellerId },
    { $set: { availableBalance: toDecimal128(sellerAvailable + amount) } },
  );
};
