import { createProxyMiddleware, Options } from 'http-proxy-middleware';

export const createServiceProxy = (targetUrl: string) => {
  const options: Options = {
    target: targetUrl,
    changeOrigin: true,
    pathRewrite: {
      '^/api': '', // strip /api so downstream services receive /auth, /orders, etc.
    },
    onProxyReq: (proxyReq, req: any) => {
      // Forward injected headers
      if (req.headers['x-user-id']) {
        proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
      }
      if (req.headers['x-user-email']) {
        proxyReq.setHeader('x-user-email', req.headers['x-user-email']);
      }
      if (req.headers['x-username']) {
        proxyReq.setHeader('x-username', req.headers['x-username']);
      }
      if (req.headers['x-request-id']) {
        proxyReq.setHeader('x-request-id', req.headers['x-request-id']);
      }
    },
    onError: (err, _req, res: any) => {
      res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Target service is unavailable' },
      });
    },
  };

  return createProxyMiddleware(options);
};
