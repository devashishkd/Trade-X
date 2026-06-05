import { body, query } from 'express-validator';
import { isValidSymbol } from '../config/symbols.config';

export const placeOrderValidator = [
  body('symbol')
    .trim().toUpperCase()
    .notEmpty().withMessage('Symbol is required')
    .custom((v: string) => {
      if (!isValidSymbol(v)) throw new Error(`Unsupported symbol: ${v}`);
      return true;
    }),

  body('side')
    .notEmpty().withMessage('Side is required')
    .isIn(['BUY', 'SELL']).withMessage("Side must be 'BUY' or 'SELL'"),

  body('type')
    .notEmpty().withMessage('Order type is required')
    .isIn(['LIMIT', 'MARKET']).withMessage("Type must be 'LIMIT' or 'MARKET'"),

  body('quantity')
    .notEmpty().withMessage('Quantity is required')
    .isInt({ min: 1, max: 100_000 }).withMessage('Quantity must be an integer between 1 and 100,000'),

  body('price')
    .if(body('type').equals('LIMIT'))
    .notEmpty().withMessage('Price is required for LIMIT orders')
    .isFloat({ min: 0.01, max: 999_999.99 }).withMessage('Price must be between 0.01 and 999,999.99'),

  body('price')
    .if(body('type').equals('MARKET'))
    .optional(),

  body('timeInForce')
    .optional()
    .isIn(['GTC', 'IOC', 'FOK']).withMessage("timeInForce must be GTC, IOC, or FOK"),
];

export const listOrdersValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1–100'),
  query('status').optional().isIn(['PENDING','OPEN','PARTIAL','FILLED','CANCELLED','REJECTED']),
  query('side').optional().isIn(['BUY', 'SELL']),
  query('symbol').optional().trim().toUpperCase(),
];
