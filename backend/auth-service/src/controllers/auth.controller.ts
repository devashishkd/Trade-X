import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { successResponse } from '@trade-x/shared';

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(successResponse(result));
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await authService.login(req.body);
    res.status(200).json(successResponse(result));
  } catch (err) {
    next(err);
  }
};

export const me = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const result = await authService.getProfile(userId);
    res.status(200).json(successResponse(result));
  } catch (err) {
    next(err);
  }
};
