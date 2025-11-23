import axios from 'axios';

// Determine the base URL based on environment
// In production (preview domain), use same origin to avoid CORS
// In local development, use the explicit backend URL
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const baseURL = isLocalDev ? 'http://localhost:8001' : 'http://51.20.193.44:8001';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle common errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401) {
      // Don't redirect if this is the initial auth check (GET /api/auth/me)
      const isAuthCheck = error.config?.url?.includes('/api/auth/me');

      // Remove invalid token
      localStorage.removeItem('token');

      // Only redirect if:
      // 1. Not the initial auth check
      // 2. Not already on auth pages
      if (!isAuthCheck && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/signup')) {
        window.location.href = '/login';
      }
    }

    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default api;
