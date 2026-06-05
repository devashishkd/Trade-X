import { Request, Response, NextFunction } from 'express';
import * as orderService from '../services/order.service';
import { successResponse, paginatedResponse } from '@trade-x/shared';

export const placeOrder = async (
  req: Request, res: Response, next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const result = await orderService.placeOrder(userId, req.body);
    res.status(201).json(successResponse(result));
  } catch (err) { next(err); }
};

export const getOrders = async (
  req: Request, res: Response, next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const page   = parseInt(req.query.page  as string) || 1;
    const limit  = parseInt(req.query.limit as string) || 20;

    const result = await orderService.getOrders(userId, {
      symbol: req.query.symbol as string,
      status: req.query.status as string,
      side:   req.query.side   as string,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err) { next(err); }
};

export const getOrder = async (
  req: Request, res: Response, next: NextFunction,
): Promise<void> => {
  try {
    const userId  = req.headers['x-user-id'] as string;
    const result  = await orderService.getOrder(userId, req.params.orderId);
    res.status(200).json(successResponse(result));
  } catch (err) { next(err); }
};

export const cancelOrder = async (
  req: Request, res: Response, next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const result = await orderService.cancelOrder(userId, req.params.orderId);
    res.status(200).json(successResponse(result));
  } catch (err) { next(err); }
};
