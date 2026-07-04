import axios from 'axios';

// In Docker: VITE_API_URL=/api (nginx proxies /api → gateway)
// On Render: VITE_API_URL=https://trade-x-api-gateway.onrender.com/api
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
});

// Request interceptor: attach token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const requestUrl: string = error.config?.url ?? '';
      // Only clear the session if the 401 came from an auth-sensitive endpoint
      // (not from background market-data or other polling requests).
      const isAuthEndpoint =
        requestUrl.includes('/auth/') ||
        requestUrl.includes('/orders') ||
        requestUrl.includes('/portfolio') ||
        requestUrl.includes('/wallet');

      if (isAuthEndpoint) {
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
