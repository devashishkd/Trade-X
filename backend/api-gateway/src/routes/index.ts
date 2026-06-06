import { Router } from 'express';
import { routes } from '../config/routes.config';
import { createServiceProxy } from '../proxy/serviceProxy';
import { authMiddleware } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/rateLimit.middleware';

const router = Router();

// Apply global rate limiting (Phase 8/9 placeholder)
router.use(rateLimitMiddleware);

routes.forEach((route) => {
  const proxy = createServiceProxy(route.target);
  
  if (route.requiresAuth) {
    // Apply auth middleware before proxying
    router.use(route.path, authMiddleware, proxy);
  } else {
    router.use(route.path, proxy);
  }
});

export default router;
