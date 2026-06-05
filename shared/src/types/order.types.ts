export type OrderSide   = 'BUY' | 'SELL';
export type OrderType   = 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LIMIT' | 'ICEBERG' | 'GTT' | 'BRACKET' | 'COVER';
export type OrderStatus = 'PENDING' | 'OPEN' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'REJECTED';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK' | 'GTT';
