import { body } from 'express-validator';

export const depositValidator = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isNumeric().withMessage('Amount must be a number')
    .custom((v: number) => {
      if (v < 1)         throw new Error('Minimum deposit is $1');
      if (v > 1_000_000) throw new Error('Maximum deposit is $1,000,000');
      return true;
    }),
];
