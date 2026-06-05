import { Request, Response, NextFunction } from 'express';

export const internalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const key = req.headers['x-service-key'];
  if (!key || key !== process.env.INTERNAL_SERVICE_KEY) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
};
