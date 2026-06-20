import { Request, Response, NextFunction } from 'express';
import * as marketDataService from '../services/marketData.service';
import { successResponse, errorResponse } from '@trade-x/shared';

export const getSymbols = async (
  _req: Request, res: Response, next: NextFunction,
): Promise<void> => {
  try {
    const symbols = await marketDataService.getAllSymbols();
    res.status(200).json(successResponse(symbols));
  } catch (err) { next(err); }
};

export const getQuote = async (
  req: Request, res: Response, next: NextFunction,
): Promise<void> => {
  try {
    const { symbol } = req.params;
    const quote = await marketDataService.getFullQuote(symbol);
    if (!quote) {
      res.status(404).json(errorResponse('NOT_FOUND', `Symbol ${symbol} not found`));
      return;
    }
    res.status(200).json(successResponse(quote));
  } catch (err) { next(err); }
};

export const getDepth = async (
  req: Request, res: Response, next: NextFunction,
): Promise<void> => {
  try {
    const { symbol } = req.params;
    const levels = parseInt(req.query.levels as string) || 20;
    const depth = await marketDataService.getDepth(symbol, levels);
    res.status(200).json(successResponse(depth));
  } catch (err) { next(err); }
};

export const getTrades = async (
  req: Request, res: Response, next: NextFunction,
): Promise<void> => {
  try {
    const { symbol } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const trades = await marketDataService.getRecentTrades(symbol, limit);
    res.status(200).json(successResponse(trades));
  } catch (err) { next(err); }
};

export const getHistory = async (
  req: Request, res: Response, next: NextFunction,
): Promise<void> => {
  try {
    const { symbol } = req.params;
    const timeframe = (req.query.timeframe as string) || '1D';
    const range = (req.query.range as string) || '1Y';
    const history = await marketDataService.getHistory(symbol, timeframe, range);
    res.status(200).json(successResponse(history));
  } catch (err) { next(err); }
};
