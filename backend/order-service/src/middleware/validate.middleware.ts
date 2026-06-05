import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { errorResponse } from '@trade-x/shared';

export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0] as { msg: string; path?: string };
    res.status(400).json(errorResponse('VALIDATION_ERROR', first.msg, first.path));
    return;
  }
  next();
};
