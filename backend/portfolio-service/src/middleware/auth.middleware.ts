import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { errorResponse } from '@trade-x/shared';

interface JwtPayload { userId: string; email: string; username: string; role: string; }

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  // Gateway-injected header (Phase 6+)
  const userId = req.headers['x-user-id'] as string | undefined;
  if (userId) { next(); return; }

  // Direct Bearer JWT (Phase 2–5 dev mode)
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json(errorResponse('UNAUTHORIZED', 'Authentication required'));
    return;
  }
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');
    const payload = jwt.verify(authHeader.replace('Bearer ', ''), secret) as JwtPayload;
    req.headers['x-user-id']    = payload.userId;
    req.headers['x-user-email'] = payload.email;
    next();
  } catch {
    res.status(401).json(errorResponse('UNAUTHORIZED', 'Invalid or expired token'));
  }
};
