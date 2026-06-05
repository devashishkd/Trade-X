export const TradeXEvents = {
  ORDER_CREATED:       'ORDER_CREATED',
  ORDER_CANCELLED:     'ORDER_CANCELLED',
  ORDER_MODIFIED:      'ORDER_MODIFIED',
  ORDER_FILLED:        'ORDER_FILLED',
  ORDER_PARTIAL_FILL:  'ORDER_PARTIAL_FILL',
  ORDER_REJECTED:      'ORDER_REJECTED',
  TRADE_EXECUTED:      'TRADE_EXECUTED',
  WALLET_UPDATED:      'WALLET_UPDATED',
  POSITION_UPDATED:    'POSITION_UPDATED',
  MARKET_DATA_UPDATED: 'MARKET_DATA_UPDATED',
} as const;

export type TradeEvent = typeof TradeXEvents[keyof typeof TradeXEvents];

/**
 * The critical abstraction that makes Kafka a drop-in replacement.
 * Phase 1: HttpEventBus  →  Phase 9: KafkaEventBus
 * Zero business logic changes required.
 */
export interface IEventBus {
  publish(event: TradeEvent, payload: unknown): Promise<void>;
  subscribe(event: TradeEvent, handler: (payload: unknown) => Promise<void>): void;
}
