import { io } from 'socket.io-client';
import { getApiUrl } from './api';

// Socket.io client needs the full URL
// getApiUrl returns URL with path, we just need the origin for socket if it's different
// But socket.io client handles relative paths well if on same origin
// For production (different port), we need full URL
const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:8001' : 'http://13.60.190.11:8001';

export const socket = io(SOCKET_URL, {
    path: '/api/socket.io',
    autoConnect: false,
    transports: ['websocket', 'polling'],
    auth: (cb) => {
        // Get token from localStorage
        const token = localStorage.getItem('token');
        cb({ token });
    }
});

export const connectSocket = () => {
    if (!socket.connected) {
        socket.connect();
    }
};

export const disconnectSocket = () => {
    if (socket.connected) {
        socket.disconnect();
    }
};
