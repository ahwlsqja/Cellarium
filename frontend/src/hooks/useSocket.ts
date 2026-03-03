'use client';

import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';
import type { ClientToServerEvents, ServerToClientEvents } from '@/lib/socket-types';

/**
 * Socket.IO connection lifecycle hook.
 * Call ONCE in the canvas page layout, not per component.
 * Connects on mount, disconnects on unmount.
 */
export function useSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents>>(getSocket());

  useEffect(() => {
    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socket.connect();

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.disconnect();
    };
  }, []);

  return socketRef.current;
}
