// Determine API URL based on environment
// In development, we use the proxy configured in vite.config.js
// In production, we point to the backend server
const isDev = import.meta.env.DEV;

export const API_BASE_URL = isDev
    ? '/api'
    : 'http://51.20.193.44:8001/api';

export const SOCKET_URL = isDev
    ? 'http://localhost:8001'
    : 'http://51.20.193.44:8001';
