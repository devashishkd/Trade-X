export const EngineConfig = {
  MARKET_ORDER_SLIPPAGE_PROTECTION_PCT: 
    parseFloat(process.env.SLIPPAGE_PROTECTION_PCT || '0.02'),
  
  // Future: per-symbol configuration
  getSlippageProtection(symbol: string): number {
    // We could lookup symbol specific config here
    return this.MARKET_ORDER_SLIPPAGE_PROTECTION_PCT;
  }
};
