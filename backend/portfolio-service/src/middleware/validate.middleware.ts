import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { errorResponse } from '@trade-x/shared';

export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    res.status(400).json(
      errorResponse('VALIDATION_ERROR', first.msg as string, (first as { path?: string }).path),
    );
    return;
  }
  next();
};
