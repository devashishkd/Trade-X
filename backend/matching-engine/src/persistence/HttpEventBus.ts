import axios, { AxiosInstance } from 'axios';
import { IEventBus, Trade } from '../models/types';

/**
 * Phase 1 Event Bus: Direct HTTP fan-out to all downstream consumers.
 *
 * On TRADE_EXECUTED, notifies all 4 consumers concurrently:
 *   1. Order Service      — updates order fills for buyer + seller
 *   2. Auth Service       — settles buyer/seller wallets
 *   3. Portfolio Service  — updates holdings (WAP, locked qty)
 *   4. Market Data Service — updates LTP, OHLCV, recent trades
 *
 * Phase 9 replacement: KafkaEventBus — zero business logic changes required.
 */
export class HttpEventBus implements IEventBus {
  private orderHttp:     AxiosInstance;
  private authHttp:      AxiosInstance;
  private portfolioHttp: AxiosInstance;
  private marketHttp:    AxiosInstance;

  constructor() {
    const serviceKey = process.env.INTERNAL_SERVICE_KEY ?? '';

    const make = (baseURL: string) => axios.create({
      baseURL,
      timeout: 8_000,
      headers: { 'x-service-key': serviceKey },
    });

    this.orderHttp     = make(process.env.ORDER_SERVICE_URL       ?? 'http://localhost:3002');
    this.authHttp      = make(process.env.AUTH_SERVICE_URL        ?? 'http://localhost:3001');
    this.portfolioHttp = make(process.env.PORTFOLIO_SERVICE_URL   ?? 'http://localhost:3004');
    this.marketHttp    = make(process.env.MARKET_DATA_SERVICE_URL ?? 'http://localhost:3005');
  }

  async publish(event: string, payload: unknown): Promise<void> {
    if (event === 'TRADE_EXECUTED') {
      await this.onTradeExecuted(payload as Trade);
    }
    // Future events (ORDER_CANCELLED, POSITION_UPDATED, etc.) handled here
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  subscribe(_event: string, _handler: (payload: unknown) => Promise<void>): void {
    // Phase 1: push-only model — engine publishes, services consume via HTTP
    // Phase 9: Kafka consumer subscriptions replace this
  }

  // ── TRADE_EXECUTED — fan out to all 4 consumers ───────────────────────────

  private async onTradeExecuted(trade: Trade): Promise<void> {
    const tradePayload = {
      tradeId:     trade.tradeId,
      symbol:      trade.symbol,
      buyOrderId:  trade.buyOrderId,
      sellOrderId: trade.sellOrderId,
      buyerId:     trade.buyerId,
      sellerId:    trade.sellerId,
      quantity:    trade.quantity,
      price:       trade.price,
      makerSide:   trade.makerSide,
      executedAt:  trade.executedAt.toISOString(),
    };

    const results = await Promise.allSettled([
      this.notifyOrderFills(trade),
      this.settleWallets(trade),
      this.notifyPortfolio(tradePayload),
      this.notifyMarketData(tradePayload),
    ]);

    const labels = ['OrderFill', 'WalletSettle', 'Portfolio', 'MarketData'];
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[HttpEventBus] ${labels[i]} notification failed`, {
          tradeId: trade.tradeId,
          reason:  r.reason,
        });
      }
    });
  }

  /** Notify Order Service to update fills for both the buy and sell orders. */
  private async notifyOrderFills(trade: Trade): Promise<void> {
    await Promise.all([
      this.orderHttp.post('/internal/orders/trade-fill', {
        orderId:  trade.buyOrderId,
        tradeId:  trade.tradeId,
        quantity: trade.quantity,
        price:    trade.price,
      }),
      this.orderHttp.post('/internal/orders/trade-fill', {
        orderId:  trade.sellOrderId,
        tradeId:  trade.tradeId,
        quantity: trade.quantity,
        price:    trade.price,
      }),
    ]);
  }

  /** Settle wallets: debit buyer's locked funds, credit seller's available balance. */
  private async settleWallets(trade: Trade): Promise<void> {
    const tradeValue = parseFloat((trade.price * trade.quantity).toFixed(2));
    await this.authHttp.post('/internal/wallet/settle', {
      tradeId:  trade.tradeId,
      buyerId:  trade.buyerId,
      sellerId: trade.sellerId,
      amount:   tradeValue,
    });
  }

  /** Notify Portfolio Service to update holdings for buyer and seller. */
  private async notifyPortfolio(payload: unknown): Promise<void> {
    await this.portfolioHttp.post('/internal/portfolio/trade-executed', payload);
  }

  /** Notify Market Data Service to update LTP, OHLCV, and recent trade feed. */
  private async notifyMarketData(payload: unknown): Promise<void> {
    await this.marketHttp.post('/internal/market/trade-executed', payload);
  }
}
