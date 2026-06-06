import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  userId: string;
  email: string;
  username: string;
  role?: string;
}

/**
 * Authentication middleware for the API Gateway.
 * Validates the JWT and injects user headers for downstream services.
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing authentication token' },
    });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is missing');

    const payload = jwt.verify(token, secret) as JwtPayload;

    // Inject headers for downstream services
    req.headers['x-user-id'] = payload.userId;
    req.headers['x-user-email'] = payload.email;
    req.headers['x-username'] = payload.username;
    
    // Do not forward the raw JWT to downstream services
    delete req.headers['authorization'];

    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
  }
};
