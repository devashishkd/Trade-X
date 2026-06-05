import axios from 'axios';
import { AppError, createLogger } from '@trade-x/shared';

const logger = createLogger('order-service');

const authHttp = axios.create({
  baseURL: process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001',
  timeout: 5000,
  headers: { 'x-service-key': process.env.INTERNAL_SERVICE_KEY },
});

/**
 * Lock funds for a BUY order.
 * Moves `amount` from availableBalance → lockedBalance in Auth Service.
 * Throws INSUFFICIENT_BALANCE (422) if not enough funds.
 */
export const lockFunds = async (
  userId:  string,
  amount:  number,
  orderId: string,
): Promise<void> => {
  try {
    await authHttp.post('/internal/wallet/lock', { userId, amount, orderId });
    logger.info('Funds locked', { userId, amount, orderId });
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      const { code, message } = err.response.data?.error ?? {};
      throw new AppError(code ?? 'LOCK_FAILED', err.response.status, message ?? 'Failed to lock funds');
    }
    throw new AppError('SERVICE_UNAVAILABLE', 503, 'Auth service unavailable');
  }
};

/**
 * Unlock funds when an order is cancelled.
 * Compensating transaction for the saga.
 */
export const unlockFunds = async (
  userId:  string,
  amount:  number,
  orderId: string,
): Promise<void> => {
  try {
    await authHttp.post('/internal/wallet/unlock', { userId, amount, orderId });
    logger.info('Funds unlocked', { userId, amount, orderId });
  } catch (err) {
    // Log but don't rethrow — best-effort unlock during saga compensation
    logger.error('Failed to unlock funds (saga compensation)', { userId, amount, orderId, err });
    if (axios.isAxiosError(err) && err.response) {
      const { code, message } = err.response.data?.error ?? {};
      throw new AppError(code ?? 'UNLOCK_FAILED', err.response.status, message ?? 'Failed to unlock funds');
    }
    throw new AppError('SERVICE_UNAVAILABLE', 503, 'Auth service unavailable');
  }
};
