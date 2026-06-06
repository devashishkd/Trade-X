import { servicesConfig } from './services.config';

export interface RouteConfig {
  path: string;
  target: string;
  requiresAuth: boolean;
}

export const routes: RouteConfig[] = [
  // Auth Service
  { path: '/api/auth/register', target: servicesConfig.authService, requiresAuth: false },
  { path: '/api/auth/login',    target: servicesConfig.authService, requiresAuth: false },
  { path: '/api/auth/me',       target: servicesConfig.authService, requiresAuth: true },
  
  // Wallet routes (served by Auth Service)
  { path: '/api/wallet',        target: servicesConfig.authService, requiresAuth: true },
  
  // Order Service
  { path: '/api/orders',        target: servicesConfig.orderService, requiresAuth: true },
  
  // Portfolio Service
  { path: '/api/portfolio',     target: servicesConfig.portfolioService, requiresAuth: true },
  
  // Market Data Service
  { path: '/api/market',        target: servicesConfig.marketDataService, requiresAuth: false },
];
