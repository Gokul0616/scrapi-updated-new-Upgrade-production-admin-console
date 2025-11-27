// Determine API URL based on environment
// In development, we use the proxy configured in vite.config.js
// In production, we point to the backend server on port 8001
const isDev = import.meta.env.DEV;
const hostname = window.location.hostname;

export const API_BASE_URL = isDev
    ? '/api'
    : `http://${hostname}:8001/api`;

export const SOCKET_URL = isDev
    ? 'http://localhost:8001'
    : `http://${hostname}:8001`;
