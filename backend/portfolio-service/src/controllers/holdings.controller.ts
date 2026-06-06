import { Request, Response, NextFunction } from 'express';
import * as portfolioService from '../services/portfolio.service';
import { successResponse } from '@trade-x/shared';

export const getHoldings = async (
  req: Request, res: Response, next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const result = await portfolioService.getHoldings(userId);
    res.status(200).json(successResponse(result));
  } catch (err) { next(err); }
};

export const getSummary = async (
  req: Request, res: Response, next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const result = await portfolioService.getPortfolioSummary(userId);
    res.status(200).json(successResponse(result));
  } catch (err) { next(err); }
};
