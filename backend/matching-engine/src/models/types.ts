export type OrderSide   = 'BUY' | 'SELL';
export type OrderType   = 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LIMIT' | 'ICEBERG' | 'GTT' | 'BRACKET' | 'COVER';
export type OrderStatus = 'PENDING' | 'OPEN' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'REJECTED';

export interface Order {
  orderId:      string;
  userId:       string;
  symbol:       string;
  side:         OrderSide;
  type:         OrderType;
  price:        number;        // 0 for MARKET orders (not used for matching)
  quantity:     number;
  remainingQty: number;
  timestamp:    Date;
  status?:      OrderStatus;
}

export interface Trade {
  tradeId:            string;
  symbol:             string;
  buyOrderId:         string;
  sellOrderId:        string;
  buyerId:            string;
  sellerId:           string;
  quantity:           number;
  price:              number;
  makerSide:          'BUY' | 'SELL';
  executedAt:         Date;
  buyerRemainingQty:  number;
  sellerRemainingQty: number;
  buyerStatus:        'FILLED' | 'PARTIAL';
  sellerStatus:       'FILLED' | 'PARTIAL';
}

/**
 * Abstraction over the event bus.
 * Phase 1: HttpEventBus (direct HTTP calls to other services)
 * Phase 9: KafkaEventBus  — zero business logic changes required
 */
export interface IEventBus {
  publish(event: string, payload: unknown): Promise<void>;
  subscribe(event: string, handler: (payload: unknown) => Promise<void>): void;
}
