import { Request, Response, NextFunction } from 'express';
import * as holdingsService from '../services/holdings.service';
import { successResponse } from '@trade-x/shared';

export const getTrades = async (
  req: Request, res: Response, next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const page   = parseInt(req.query.page  as string) || 1;
    const limit  = parseInt(req.query.limit as string) || 20;
    const symbol = req.query.symbol as string | undefined;

    const result = await holdingsService.getTrades(userId, { symbol, page, limit });

    res.status(200).json({
      success: true,
      data: result.trades,
      pagination: result.pagination,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err) { next(err); }
};
