import { Request, Response, NextFunction } from 'express';

/**
 * Protects all /internal/* routes.
 * Only other services (with the shared key) can call these.
 * This trust boundary maps cleanly to mTLS in a future K8s deployment.
 */
export const internalAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const key = req.headers['x-service-key'];
  if (!key || key !== process.env.INTERNAL_SERVICE_KEY) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
};
