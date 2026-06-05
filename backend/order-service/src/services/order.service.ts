import { v4 as uuidv4 }    from 'uuid';
import { Order, IOrder }    from '../models/Order.model';
import * as authClient      from './authService.client';
import * as portfolioClient from './portfolioService.client';
import * as engineClient    from './matchingEngine.client';
import { toDecimal128, fromDecimal128, AppError, createLogger } from '@trade-x/shared';
import { OrderSide, OrderType, TimeInForce } from '@trade-x/shared';

const logger = createLogger('order-service');

// ── DTOs ───────────────────────────────────────────────────────────────────

export interface PlaceOrderDto {
  symbol:      string;
  side:        OrderSide;
  type:        OrderType;
  quantity:    number;
  price?:      number;
  timeInForce?: TimeInForce;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const calculateWAP = (trades: engineClient.EngineTrade[]): number => {
  const totalValue = trades.reduce((s, t) => s + t.price * t.quantity, 0);
  const totalQty   = trades.reduce((s, t) => s + t.quantity, 0);
  return totalQty > 0 ? totalValue / totalQty : 0;
};

const serializeOrder = (order: IOrder) => ({
  orderId:           order.orderId,
  userId:            order.userId,
  symbol:            order.symbol,
  side:              order.side,
  type:              order.type,
  status:            order.status,
  price:             order.price ? fromDecimal128(order.price).toFixed(2) : null,
  quantity:          order.quantity,
  filledQuantity:    order.filledQuantity,
  remainingQuantity: order.remainingQuantity,
  averagePrice:      order.averagePrice ? fromDecimal128(order.averagePrice).toFixed(2) : null,
  timeInForce:       order.timeInForce,
  fills:             order.fills.map(f => ({
    tradeId:    f.tradeId,
    quantity:   f.quantity,
    price:      fromDecimal128(f.price).toFixed(2),
    executedAt: f.executedAt,
  })),
  rejectionReason: order.rejectionReason,
  cancelledAt:     order.cancelledAt,
  filledAt:        order.filledAt,
  createdAt:       order.createdAt,
  updatedAt:       order.updatedAt,
});

// ── Place Order (Saga Pattern) ─────────────────────────────────────────────
/**
 * Full order placement saga:
 *   1. Persist order as PENDING
 *   2. Lock funds (BUY) or shares (SELL)
 *   3. Update to OPEN
 *   4. Submit to matching engine
 *   5. Apply fills
 *
 * On any failure after step 2: compensate by unlocking resources.
 */
export const placeOrder = async (userId: string, dto: PlaceOrderDto) => {
  const orderId = uuidv4();

  // Step 1: Persist order in PENDING state
  const order = await Order.create({
    orderId,
    userId,
    symbol:            dto.symbol.toUpperCase(),
    side:              dto.side,
    type:              dto.type,
    status:            'PENDING',
    price:             dto.price != null ? toDecimal128(dto.price) : null,
    quantity:          dto.quantity,
    filledQuantity:    0,
    remainingQuantity: dto.quantity,
    timeInForce:       dto.timeInForce ?? 'GTC',
  });

  logger.info('Order created (PENDING)', { orderId, userId, symbol: dto.symbol, side: dto.side });

  // Track what was locked so we can compensate on failure
  let lockedAmount  = 0;
  let lockedShares  = 0;
  let resourcesLocked = false;

  try {
    // Step 2: Lock resources based on side
    if (dto.side === 'BUY') {
      if (dto.type === 'LIMIT' && dto.price) {
        lockedAmount = parseFloat((dto.price * dto.quantity).toFixed(2));
        await authClient.lockFunds(userId, lockedAmount, orderId);
        resourcesLocked = true;
      }
      // MARKET orders: locked at Phase 5 integration with market data for estimated price
    } else {
      // SELL: lock shares (Portfolio Service — available Phase 4+, degrades gracefully before)
      lockedShares = dto.quantity;
      await portfolioClient.lockShares(userId, dto.symbol, dto.quantity, orderId);
      // portfolioClient gracefully skips if service not available (Phase 2)
    }

    // Step 3: Mark OPEN — funds/shares are now reserved
    order.status = 'OPEN';
    await order.save();
    logger.info('Order opened', { orderId });

    // Step 4: Submit to matching engine (degrades gracefully if Phase 3 not started)
    const engineResult = await engineClient.submitOrder({
      orderId,
      userId,
      symbol:            order.symbol,
      side:              dto.side,
      type:              dto.type,
      price:             dto.price ?? null,
      quantity:          dto.quantity,
      remainingQuantity: dto.quantity,
      timestamp:         new Date().toISOString(),
    });

    // Step 5: Apply fill results if any trades occurred
    if (engineResult.trades.length > 0) {
      order.fills = engineResult.trades.map(t => ({
        tradeId:    t.tradeId,
        quantity:   t.quantity,
        price:      toDecimal128(t.price),
        executedAt: new Date(t.executedAt),
      }));
      order.filledQuantity    = engineResult.filledQuantity;
      order.remainingQuantity = engineResult.remainingQuantity;
      order.status            = engineResult.status;
      order.averagePrice      = toDecimal128(calculateWAP(engineResult.trades));

      if (engineResult.status === 'FILLED') {
        order.filledAt = new Date();
      }

      await order.save();
      logger.info('Order filled', {
        orderId,
        status:         engineResult.status,
        filledQuantity: engineResult.filledQuantity,
        trades:         engineResult.trades.length,
      });
    }

    return serializeOrder(order);
  } catch (err) {
    logger.error('Order placement failed — compensating', { orderId, err });

    // ── Saga Compensation: unlock resources ────────────────────────────────
    if (resourcesLocked && lockedAmount > 0) {
      try {
        await authClient.unlockFunds(userId, lockedAmount, orderId);
        logger.info('Saga compensation: funds unlocked', { orderId, lockedAmount });
      } catch (unlockErr) {
        // Log and continue — do not let compensation error swallow original error
        logger.error('CRITICAL: saga compensation (unlock funds) failed', { orderId, unlockErr });
      }
    }

    // Mark order as REJECTED with reason
    try {
      order.status = 'REJECTED';
      order.rejectionReason = err instanceof Error ? err.message : 'Placement failed';
      await order.save();
    } catch (saveErr) {
      logger.error('Failed to mark order as REJECTED', { orderId, saveErr });
    }

    throw err;
  }
};

// ── Get Orders (paginated) ─────────────────────────────────────────────────
export const getOrders = async (
  userId:  string,
  filters: {
    symbol?:  string;
    status?:  string;
    side?:    string;
    page:     number;
    limit:    number;
  },
) => {
  const query: Record<string, unknown> = { userId };
  if (filters.symbol) query.symbol = filters.symbol.toUpperCase();
  if (filters.status) query.status = filters.status;
  if (filters.side)   query.side   = filters.side;

  const [orders, total] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .lean(),
    Order.countDocuments(query),
  ]);

  return {
    orders: orders.map(o => ({
      orderId:           o.orderId,
      symbol:            o.symbol,
      side:              o.side,
      type:              o.type,
      status:            o.status,
      price:             o.price ? fromDecimal128(o.price as mongoose.Types.Decimal128).toFixed(2) : null,
      quantity:          o.quantity,
      filledQuantity:    o.filledQuantity,
      remainingQuantity: o.remainingQuantity,
      averagePrice:      o.averagePrice ? fromDecimal128(o.averagePrice as mongoose.Types.Decimal128).toFixed(2) : null,
      timeInForce:       o.timeInForce,
      createdAt:         o.createdAt,
      cancelledAt:       o.cancelledAt,
      filledAt:          o.filledAt,
    })),
    pagination: {
      page:    filters.page,
      limit:   filters.limit,
      total,
      hasNext: filters.page * filters.limit < total,
      hasPrev: filters.page > 1,
    },
  };
};

// ── Get Single Order ───────────────────────────────────────────────────────
export const getOrder = async (userId: string, orderId: string) => {
  const order = await Order.findOne({ orderId });
  if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
  if (order.userId !== userId) throw new AppError('FORBIDDEN', 403, 'Access denied');
  return serializeOrder(order);
};

// ── Cancel Order ───────────────────────────────────────────────────────────
export const cancelOrder = async (userId: string, orderId: string) => {
  const order = await Order.findOne({ orderId });
  if (!order)               throw new AppError('NOT_FOUND', 404, 'Order not found');
  if (order.userId !== userId) throw new AppError('FORBIDDEN', 403, 'Access denied');
  if (!['OPEN', 'PARTIAL', 'PENDING'].includes(order.status)) {
    throw new AppError('ORDER_NOT_CANCELLABLE', 422,
      `Order cannot be cancelled in ${order.status} status`);
  }

  // Remove from matching engine order book (O(1))
  await engineClient.cancelOrder(orderId, order.symbol);

  // Calculate how much to unlock
  const cancelledQty    = order.remainingQuantity;
  const lockedPrice     = order.price ? fromDecimal128(order.price) : 0;
  const unlockedAmount  = order.side === 'BUY' ? parseFloat((lockedPrice * cancelledQty).toFixed(2)) : 0;

  // Unlock resources
  if (order.side === 'BUY' && unlockedAmount > 0) {
    await authClient.unlockFunds(userId, unlockedAmount, orderId);
  } else if (order.side === 'SELL') {
    await portfolioClient.unlockShares(userId, order.symbol, cancelledQty, orderId);
  }

  // Update order status
  order.status      = 'CANCELLED';
  order.cancelledAt = new Date();
  await order.save();

  logger.info('Order cancelled', { orderId, cancelledQty, unlockedAmount });

  return {
    orderId,
    status:           'CANCELLED',
    cancelledAt:      order.cancelledAt,
    filledQuantity:   order.filledQuantity,
    cancelledQuantity: cancelledQty,
    unlockedAmount:   order.side === 'BUY' ? unlockedAmount.toFixed(2) : '0.00',
  };
};

// ── Internal: Apply Trade Fills ────────────────────────────────────────────
// Called by the matching engine (or event handler in Phase 9) after trade execution.
export const applyTradeFill = async (
  orderId:  string,
  tradeId:  string,
  quantity: number,
  price:    number,
): Promise<void> => {
  const order = await Order.findOne({ orderId });
  if (!order) { logger.warn('applyTradeFill: order not found', { orderId }); return; }

  order.fills.push({ tradeId, quantity, price: toDecimal128(price), executedAt: new Date() });
  order.filledQuantity    += quantity;
  order.remainingQuantity -= quantity;

  const wap = calculateWAP(order.fills.map(f => ({
    price: fromDecimal128(f.price), quantity: f.quantity,
    tradeId: f.tradeId, buyOrderId: '', sellOrderId: '', buyerId: '',
    sellerId: '', symbol: order.symbol, makerSide: 'BUY' as const, executedAt: '',
  })));
  order.averagePrice = toDecimal128(wap);
  order.status       = order.remainingQuantity <= 0 ? 'FILLED' : 'PARTIAL';
  if (order.status === 'FILLED') order.filledAt = new Date();

  await order.save();
};

// Required for lean() queries
import mongoose from 'mongoose';
