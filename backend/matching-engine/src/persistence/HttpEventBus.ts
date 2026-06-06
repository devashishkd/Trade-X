import axios, { AxiosInstance } from 'axios';
import { IEventBus, Trade } from '../models/types';

/**
 * Phase 1 Event Bus: Direct HTTP calls to downstream services.
 *
 * When TRADE_EXECUTED is published:
 *   → POST /internal/orders/trade-fill  (Order Service)   — updates order fills
 *   → POST /internal/wallet/settle      (Auth Service)    — settles buyer/seller wallets
 *
 * Phase 9 replacement: KafkaEventBus — same publish/subscribe interface,
 * zero changes required in MatchingEngine or TradePersistenceWorker.
 */
export class HttpEventBus implements IEventBus {
  private orderHttp: AxiosInstance;
  private authHttp:  AxiosInstance;

  constructor() {
    const serviceKey = process.env.INTERNAL_SERVICE_KEY ?? '';

    this.orderHttp = axios.create({
      baseURL: process.env.ORDER_SERVICE_URL ?? 'http://localhost:3002',
      timeout: 8_000,
      headers: { 'x-service-key': serviceKey },
    });

    this.authHttp = axios.create({
      baseURL: process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001',
      timeout: 8_000,
      headers: { 'x-service-key': serviceKey },
    });
  }

  async publish(event: string, payload: unknown): Promise<void> {
    if (event === 'TRADE_EXECUTED') {
      await this.onTradeExecuted(payload as Trade);
    }
    // Future events (ORDER_CANCELLED, etc.) added here
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  subscribe(_event: string, _handler: (payload: unknown) => Promise<void>): void {
    // Phase 1: push-only model — engine publishes, services consume via HTTP
    // Phase 9: Kafka consumer subscriptions go here
  }

  // ── TRADE_EXECUTED ────────────────────────────────────────────────────────

  private async onTradeExecuted(trade: Trade): Promise<void> {
    // Run both calls concurrently — they are independent
    const [orderFillResult, walletResult] = await Promise.allSettled([
      this.notifyOrderFills(trade),
      this.settleWallets(trade),
    ]);

    if (orderFillResult.status === 'rejected') {
      console.error('[HttpEventBus] Order fill notification failed', {
        tradeId: trade.tradeId,
        reason:  orderFillResult.reason,
      });
    }
    if (walletResult.status === 'rejected') {
      console.error('[HttpEventBus] Wallet settlement failed', {
        tradeId: trade.tradeId,
        reason:  walletResult.reason,
      });
    }
  }

  /** Notify Order Service to update fills for both the buy and sell orders. */
  private async notifyOrderFills(trade: Trade): Promise<void> {
    // Buyer fill
    await this.orderHttp.post('/internal/orders/trade-fill', {
      orderId:  trade.buyOrderId,
      tradeId:  trade.tradeId,
      quantity: trade.quantity,
      price:    trade.price,
    });

    // Seller fill
    await this.orderHttp.post('/internal/orders/trade-fill', {
      orderId:  trade.sellOrderId,
      tradeId:  trade.tradeId,
      quantity: trade.quantity,
      price:    trade.price,
    });
  }

  /**
   * Settle wallets: buyer's locked funds consumed, seller receives proceeds.
   * Called on Auth Service internal route.
   */
  private async settleWallets(trade: Trade): Promise<void> {
    const tradeValue = parseFloat((trade.price * trade.quantity).toFixed(2));
    await this.authHttp.post('/internal/wallet/settle', {
      tradeId:  trade.tradeId,
      buyerId:  trade.buyerId,
      sellerId: trade.sellerId,
      amount:   tradeValue,
    });
  }
}
