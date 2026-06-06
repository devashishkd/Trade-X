import { Request, Response, NextFunction } from 'express';
import { createLogger } from '@trade-x/shared';

const logger = createLogger('api-gateway');

export const errorHandlerMiddleware = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  logger.error('Gateway Error', { err, path: req.path });
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred at the API Gateway',
    },
  });
};
