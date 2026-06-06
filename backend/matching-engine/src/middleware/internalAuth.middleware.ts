import { Request, Response, NextFunction } from 'express';

/**
 * Service-to-service authentication middleware.
 * Validates the x-service-key header against INTERNAL_SERVICE_KEY env var.
 */
export const internalAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const key = req.headers['x-service-key'];
  if (!key || key !== process.env.INTERNAL_SERVICE_KEY) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid service key' } });
    return;
  }
  next();
};
