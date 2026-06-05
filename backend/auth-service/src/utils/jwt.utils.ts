import jwt from 'jsonwebtoken';
import { AppError } from '@trade-x/shared';

export interface JwtPayload {
  userId:   string;
  email:    string;
  username: string;
  role:     string;
}

export const signToken = (payload: JwtPayload): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign(payload, secret, {
    expiresIn: parseInt(process.env.JWT_EXPIRES_IN ?? '86400'),
  });
};

export const verifyToken = (token: string): JwtPayload => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid or expired token');
  }
};
