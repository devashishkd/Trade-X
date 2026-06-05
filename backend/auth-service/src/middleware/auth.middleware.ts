import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.utils';
import { errorResponse } from '@trade-x/shared';

/**
 * Dual-mode auth middleware:
 * - Production (via API Gateway): reads x-user-id header injected by gateway
 * - Development (direct calls):   validates Bearer JWT token directly
 *
 * This allows the auth service to be tested directly in Phase 1
 * without needing the gateway. In Phase 6, the gateway handles JWT
 * and injects x-user-id — no code changes needed here.
 */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Gateway-injected header (Phase 6+)
  const userId = req.headers['x-user-id'] as string | undefined;
  if (userId) {
    next();
    return;
  }

  // Direct call with Bearer token (Phase 1 dev mode)
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json(errorResponse('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  try {
    const payload = verifyToken(authHeader.replace('Bearer ', ''));
    req.headers['x-user-id']    = payload.userId;
    req.headers['x-user-email'] = payload.email;
    req.headers['x-username']   = payload.username;
    next();
  } catch {
    res.status(401).json(errorResponse('UNAUTHORIZED', 'Invalid or expired token'));
  }
};
