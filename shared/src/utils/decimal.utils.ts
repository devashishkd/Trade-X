import mongoose from 'mongoose';

export const toDecimal128 = (value: number | string): mongoose.Types.Decimal128 =>
  mongoose.Types.Decimal128.fromString(String(value));

export const fromDecimal128 = (
  d: mongoose.Types.Decimal128 | null | undefined,
): number => (d ? parseFloat(d.toString()) : 0);

export const decimal128ToFixed = (
  d: mongoose.Types.Decimal128 | null | undefined,
  digits = 2,
): string => fromDecimal128(d).toFixed(digits);
