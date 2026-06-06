import 'dotenv/config';

export const servicesConfig = {
  authService:       process.env.AUTH_SERVICE_URL        || 'http://localhost:3001',
  orderService:      process.env.ORDER_SERVICE_URL       || 'http://localhost:3002',
  matchingEngine:    process.env.MATCHING_ENGINE_URL     || 'http://localhost:3003',
  portfolioService:  process.env.PORTFOLIO_SERVICE_URL   || 'http://localhost:3004',
  marketDataService: process.env.MARKET_DATA_SERVICE_URL || 'http://localhost:3005',
};
