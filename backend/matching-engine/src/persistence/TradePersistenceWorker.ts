import { Trade, IEventBus } from '../models/types';

/**
 * Async trade persistence worker.
 *
 * Design: the hot matching path is never blocked by I/O.
 *
 * After a match, trades are pushed onto an in-memory queue.
 * The worker drains the queue asynchronously in the background,
 * publishing TRADE_EXECUTED events to the event bus (which in turn
 * calls Order Service and Auth Service to settle wallets / update fills).
 *
 * Phase 1 event bus: HttpEventBus (direct HTTP calls)
 * Phase 9 event bus: KafkaEventBus (drop-in swap, zero logic changes)
 */
export class TradePersistenceWorker {
  private queue:        Trade[] = [];
  private isProcessing: boolean = false;
  private eventBus:     IEventBus;

  constructor(eventBus: IEventBus) {
    this.eventBus = eventBus;
  }

  /** Enqueue a trade for async persistence. Non-blocking. */
  enqueue(trade: Trade): void {
    this.queue.push(trade);
    if (!this.isProcessing) {
      // Kick off async drain without awaiting
      this.processBatch().catch(err => {
        console.error('[TradePersistenceWorker] Batch processing error', err);
      });
    }
  }

  private async processBatch(): Promise<void> {
    this.isProcessing = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, 100); // 100 trades per batch
        await this.persistBatch(batch);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Publish TRADE_EXECUTED for each trade.
   * Uses Promise.allSettled so one failure does not block others.
   */
  private async persistBatch(trades: Trade[]): Promise<void> {
    const results = await Promise.allSettled(
      trades.map(trade => this.eventBus.publish('TRADE_EXECUTED', trade)),
    );

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'rejected') {
        console.error(
          '[TradePersistenceWorker] Failed to publish trade',
          { tradeId: trades[i].tradeId, reason: r.reason },
        );
      }
    }
  }

  /** Number of trades currently pending in the queue. */
  get pendingCount(): number {
    return this.queue.length;
  }
}
