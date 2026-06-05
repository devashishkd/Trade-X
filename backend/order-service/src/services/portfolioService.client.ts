import axios from 'axios';
import { AppError, createLogger } from '@trade-x/shared';

const logger = createLogger('order-service');

const portfolioHttp = axios.create({
  baseURL: process.env.PORTFOLIO_SERVICE_URL ?? 'http://localhost:3004',
  timeout: 5000,
  headers: { 'x-service-key': process.env.INTERNAL_SERVICE_KEY },
});

/**
 * Lock shares for a SELL order.
 * Moves `quantity` shares from available → locked in Portfolio Service.
 * Throws INSUFFICIENT_SHARES (422) if not enough shares.
 *
 * NOTE: Phase 2 stub — Portfolio Service is implemented in Phase 4.
 * Returns true (skip check) if service is unavailable during Phase 2.
 */
export const lockShares = async (
  userId:   string,
  symbol:   string,
  quantity: number,
  orderId:  string,
): Promise<void> => {
  try {
    await portfolioHttp.post('/internal/portfolio/lock-shares', {
      userId, symbol, quantity, orderId,
    });
    logger.info('Shares locked', { userId, symbol, quantity, orderId });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (!err.response) {
        // Portfolio service not running (Phase 2) — warn and continue
        logger.warn('Portfolio service unavailable — skipping share lock in Phase 2', { orderId });
        return;
      }
      const { code, message } = err.response.data?.error ?? {};
      throw new AppError(code ?? 'LOCK_FAILED', err.response.status, message ?? 'Failed to lock shares');
    }
    throw err;
  }
};

/**
 * Unlock shares when a SELL order is cancelled.
 */
export const unlockShares = async (
  userId:   string,
  symbol:   string,
  quantity: number,
  orderId:  string,
): Promise<void> => {
  try {
    await portfolioHttp.post('/internal/portfolio/unlock-shares', {
      userId, symbol, quantity, orderId,
    });
  } catch (err) {
    if (axios.isAxiosError(err) && !err.response) {
      logger.warn('Portfolio service unavailable — skipping share unlock in Phase 2', { orderId });
      return;
    }
    logger.error('Failed to unlock shares', { userId, symbol, quantity, orderId, err });
  }
};
