import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config';

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
