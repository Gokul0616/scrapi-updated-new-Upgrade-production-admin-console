import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [runUpdates, setRunUpdates] = useState({});

  // Initialize socket connection
  useEffect(() => {
    if (!token || !user) {
      // Disconnect if logged out
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Create socket connection with auth
    // Determine connection settings based on environment
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // In production, use relative path to connect through the API proxy
    // In development, connect directly to backend port
    const backendUrl = isLocalDev ? 'http://localhost:8001' : 'http://51.20.193.44:8001';

    const newSocket = io(backendUrl, {
      auth: {
        token: token
      },
      path: '/api/socket.io',  // Use /api prefix to route through ingress to backend
      transports: ['polling', 'websocket'], // Try polling first, then upgrade to websocket
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      upgrade: true,
      rememberUpgrade: true
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error.message);
      setConnected(false);
    });

    // Run update handlers
    newSocket.on('run:update', (data) => {
      setRunUpdates((prev) => {
        // Use runId as the primary key
        const key = data.runId || data._id;
        return {
          ...prev,
          [key]: {
            ...prev[key],
            ...data
          }
        };
      });
    });

    newSocket.on('run:created', (data) => {
      setRunUpdates((prev) => {
        // Use runId as the primary key
        const key = data.runId || data._id;
        return {
          ...prev,
          [key]: {
            ...data
          }
        };
      });
    });

    newSocket.on('run:status', (data) => {
      setRunUpdates((prev) => {
        // Find existing entry by runId
        const existingKey = Object.keys(prev).find(key =>
          prev[key].runId === data.runId || key === data.runId
        );
        const existing = existingKey ? prev[existingKey] : {};

        return {
          ...prev,
          [data.runId]: {
            ...existing,
            status: data.status,
            runId: data.runId,
            ...data
          }
        };
      });
    });

    newSocket.on('run:progress', (data) => {
      setRunUpdates((prev) => {
        const existing = prev[data.runId] || {};
        return {
          ...prev,
          [data.runId]: {
            ...existing,
            progress: data.progress
          }
        };
      });
    });

    newSocket.on('run:completed', (data) => {
      setRunUpdates((prev) => {
        // Find existing entry by runId
        const existingKey = Object.keys(prev).find(key =>
          prev[key].runId === data.runId || key === data.runId
        );
        const existing = existingKey ? prev[existingKey] : {};

        return {
          ...prev,
          [data.runId]: {
            ...existing,
            status: 'succeeded',
            runId: data.runId,
            ...data
          }
        };
      });
    });

    newSocket.on('run:failed', (data) => {
      setRunUpdates((prev) => {
        // Find existing entry by runId
        const existingKey = Object.keys(prev).find(key =>
          prev[key].runId === data.runId || key === data.runId
        );
        const existing = existingKey ? prev[existingKey] : {};

        return {
          ...prev,
          [data.runId]: {
            ...existing,
            status: 'failed',
            error: data.error,
            runId: data.runId,
            ...data
          }
        };
      });
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, [token, user]);

  // Subscribe to specific run updates
  const subscribeToRun = useCallback((runId) => {
    if (socket && connected) {
      socket.emit('subscribe:run', runId);
    }
  }, [socket, connected]);

  // Unsubscribe from run updates
  const unsubscribeFromRun = useCallback((runId) => {
    if (socket && connected) {
      socket.emit('unsubscribe:run', runId);
    }
  }, [socket, connected]);

  // Get updates for a specific run
  const getRunUpdate = useCallback((runId) => {
    return runUpdates[runId] || null;
  }, [runUpdates]);

  // Clear run update from cache
  const clearRunUpdate = useCallback((runId) => {
    setRunUpdates((prev) => {
      const newUpdates = { ...prev };
      delete newUpdates[runId];
      return newUpdates;
    });
  }, []);

  const value = {
    socket,
    connected,
    runUpdates,
    subscribeToRun,
    unsubscribeFromRun,
    getRunUpdate,
    clearRunUpdate
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
