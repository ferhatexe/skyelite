import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Get Socket URL dynamically based on current browser domain
const SOCKET_URL = window.location.origin;

interface UseSocketProps {
  role: 'admin' | 'courier';
  token?: string | null;          // admin JWT token
  deviceId?: string | null;       // courier device id
  courierName?: string | null;    // courier name
  deviceInfo?: string | null;     // courier device info
}

export const useSocket = ({ role, token, deviceId, courierName, deviceInfo }: UseSocketProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Only connect if we have the required parameters
    if (role === 'admin' && !token) return;
    if (role === 'courier' && (!deviceId || !courierName)) return;

    // Create socket connection
    const socket = io(SOCKET_URL, {
      auth: {
        role,
        token,
        deviceId,
        courierName,
        deviceInfo
      },
      transports: ['websocket', 'polling'], // Fallback options
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log(`[SOCKET]: Connected with ID ${socket.id}`);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[SOCKET]: Disconnected');
    });

    socket.on('connect_error', (error) => {
      setIsConnected(false);
      console.error('[SOCKET]: Connection Error', error.message);
    });

    return () => {
      if (socket) {
        socket.disconnect();
        console.log('[SOCKET]: Disconnected on cleanup');
      }
    };
  }, [role, token, deviceId, courierName, deviceInfo]);

  return {
    socket: socketRef.current,
    isConnected,
  };
};
