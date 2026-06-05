export interface TradeExecutedPayload {
  tradeId:     string;
  symbol:      string;
  buyOrderId:  string;
  sellOrderId: string;
  buyerId:     string;
  sellerId:    string;
  quantity:    number;
  price:       number;
  makerSide:   'BUY' | 'SELL';
  executedAt:  string; // ISO timestamp
}
