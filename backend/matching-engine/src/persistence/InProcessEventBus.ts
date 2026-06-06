import { IEventBus } from '../models/types';

/**
 * InProcessEventBus — synchronous in-memory event bus.
 *
 * Used for:
 *   1. Unit tests — no HTTP calls, no network dependency
 *   2. Single-process mode / local dev without downstream services
 *
 * All published events are dispatched synchronously to registered handlers.
 * This makes test assertions predictable without async complexity.
 *
 * Phase 9 upgrade path:
 *   Replace with KafkaEventBus in production.
 *   HttpEventBus for Phase 1 integration testing.
 *   InProcessEventBus for isolated unit tests.
 */
export class InProcessEventBus implements IEventBus {
  private handlers: Map<string, Array<(payload: unknown) => Promise<void>>> = new Map();

  /** Register a handler for an event type. */
  subscribe(event: string, handler: (payload: unknown) => Promise<void>): void {
    const existing = this.handlers.get(event) ?? [];
    existing.push(handler);
    this.handlers.set(event, existing);
  }

  /** Dispatch event to all registered handlers synchronously. */
  async publish(event: string, payload: unknown): Promise<void> {
    const eventHandlers = this.handlers.get(event) ?? [];
    for (const handler of eventHandlers) {
      await handler(payload);
    }
  }

  /** Captured events — useful for test assertions. */
  private _published: Array<{ event: string; payload: unknown }> = [];

  /** Returns all events published since last reset. Useful in tests. */
  getPublished(): Array<{ event: string; payload: unknown }> {
    return [...this._published];
  }

  /** Clear captured events between tests. */
  reset(): void {
    this._published = [];
    this.handlers.clear();
  }
}
