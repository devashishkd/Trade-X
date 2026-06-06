import { Request, Response, NextFunction } from 'express';

/**
 * Placeholder for rate limiting middleware.
 * Scheduled for Phase 8 / 9 with Redis backing.
 */
export const rateLimitMiddleware = (_req: Request, _res: Response, next: NextFunction): void => {
  // TODO: Phase 9 implementation
  next();
};
