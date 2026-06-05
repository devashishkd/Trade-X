import { Request, Response, NextFunction } from 'express';
import * as walletService from '../services/wallet.service';
import { successResponse } from '@trade-x/shared';

export const getBalance = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const result = await walletService.getBalance(userId);
    res.status(200).json(successResponse(result));
  } catch (err) {
    next(err);
  }
};

export const deposit = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const amount = parseFloat(req.body.amount);
    const result = await walletService.deposit(userId, amount);
    res.status(200).json(successResponse(result));
  } catch (err) {
    next(err);
  }
};
