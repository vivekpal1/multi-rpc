"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWebSocket } from '@/hooks/use-websocket';

interface RPCStats {
  current: {
    requests_per_second: number;
    active_connections: number;
    average_latency: number;
    error_rate: number;
  };
  endpoints_performance: any[];
  methods_breakdown: any[];
}

interface EndpointHealth {
  url: string;
  healthy: boolean;
  latency: number;
  success_rate: number;
  requests_total: number;
  region: string;
  error?: string;
}

interface WebSocketContextType {
  isConnected: boolean;
  stats: RPCStats | null;
  health: EndpointHealth[] | null;
  lastUpdate: Date | null;
  error: string | null;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  stats: null,
  health: null,
  lastUpdate: null,
  error: null,
});

export function useRPCWebSocket() {
  return useContext(WebSocketContext);
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { authenticated, getAccessToken } = usePrivy();
  const [stats, setStats] = useState<RPCStats | null>(null);
  const [health, setHealth] = useState<EndpointHealth[] | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [websocketUrl, setWebsocketUrl] = useState<string | null>(null);

  // Build WebSocket URL with authentication
  useEffect(() => {
    // Skip WebSocket for now if backend isn't configured
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
    if (!rpcUrl || rpcUrl === 'http://localhost:8080') {
      console.log('Multi-RPC backend not configured, skipping WebSocket connection');
      return;
    }

    if (authenticated) {
      getAccessToken().then(token => {
        if (token) {
          const wsUrl = rpcUrl.replace(/^http/, 'ws');
          setWebsocketUrl(`${wsUrl}/ws?token=${token}`);
        }
      });
    }
  }, [authenticated, getAccessToken]);

  const { isConnected, lastError } = useWebSocket({
    url: websocketUrl || '',
    onMessage: (message) => {
      setLastUpdate(new Date());
      
      switch (message.type) {
        case 'stats':
          setStats(message.data);
          break;
        case 'health':
          setHealth(message.data);
          break;
        case 'endpoints':
          // Update endpoint list if needed
          break;
        case 'metrics':
          // Process metrics if needed
          break;
      }
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    },
    onConnect: () => {
      console.log('WebSocket connected to Multi-RPC backend');
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected from Multi-RPC backend');
    },
  });

  return (
    <WebSocketContext.Provider 
      value={{ 
        isConnected: websocketUrl ? isConnected : false, 
        stats, 
        health, 
        lastUpdate,
        error: lastError,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}