import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: 'health' | 'stats' | 'endpoints' | 'metrics';
  data: any;
}

interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket({
  url,
  onMessage,
  onError,
  onConnect,
  onDisconnect,
  reconnectInterval = 5000,
  maxReconnectAttempts = 5,
}: UseWebSocketOptions) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout>();
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const connect = useCallback(() => {
    try {
      // Clean up existing connection
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.close();
      }

      console.log('Connecting to WebSocket:', url);
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setLastError(null);
        reconnectAttempts.current = 0;
        onConnect?.();

        // Subscribe to updates
        ws.current?.send(JSON.stringify({
          type: 'subscribe',
          channels: ['health', 'stats', 'endpoints', 'metrics']
        }));
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setLastError('Connection error');
        onError?.(error);
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        onDisconnect?.();

        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          console.log(`Reconnecting in ${reconnectInterval}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else {
          setLastError('Max reconnection attempts reached');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setLastError('Failed to connect');
    }
  }, [url, onMessage, onError, onConnect, onDisconnect, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    reconnectAttempts.current = maxReconnectAttempts; // Prevent reconnection
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, [maxReconnectAttempts]);

  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    lastError,
    sendMessage,
    reconnect: connect,
    disconnect,
  };
}