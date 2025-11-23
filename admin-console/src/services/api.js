// Determine API URL based on environment
// In development, Vite proxy handles /api requests
// In production, we need to point to the backend explicitly
const API_URL = import.meta.env.DEV
    ? ''
    : 'http://13.60.190.11:8001';

export const getApiUrl = (path) => {
    return `${API_URL}${path}`;
};
