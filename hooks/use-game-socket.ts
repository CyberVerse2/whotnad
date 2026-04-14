'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ServerMessage } from '@/types/messages';

interface UseGameSocketOptions {
  onMessage?: (msg: ServerMessage) => void;
}

export function useGameSocket(userId: string | null, options?: UseGameSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);
  const onMessageRef = useRef(options?.onMessage);
  const userIdRef = useRef(userId);

  onMessageRef.current = options?.onMessage;
  userIdRef.current = userId;

  const connect = useCallback(() => {
    const uid = userIdRef.current;
    if (!uid) return;

    // Clean up any existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?token=${encodeURIComponent(uid)}`);

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttempt.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        onMessageRef.current?.(msg);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;

      // Auto-reconnect with exponential backoff
      if (userIdRef.current) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 10_000);
        reconnectAttempt.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    };

    wsRef.current = ws;
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Connect when userId is available, disconnect on cleanup
  useEffect(() => {
    if (userId) {
      connect();
    } else {
      disconnect();
    }

    return disconnect;
  }, [userId, connect, disconnect]);

  return { isConnected, sendMessage, disconnect };
}
