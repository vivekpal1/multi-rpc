"use client";

import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useRPCWebSocket } from "@/providers/websocket-provider";
import { usePrivy } from "@privy-io/react-auth";
import {
  Activity,
  Zap,
  Globe,
  Server,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Wifi,
  WifiOff,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { StatsCardSkeleton, EndpointCardSkeleton } from "@/components/loading-skeleton";
import { EndpointConfiguration } from "@/components/endpoint-config";
import { RPCDebugger } from "@/components/rpc-debugger";
import ErrorBoundary from "@/components/error-boundary";

// Memoized Stats Card Component
const StatsCard = memo(({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  loading = false 
}: {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  loading?: boolean;
}) => {
  if (loading) return <StatsCardSkeleton />;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {change !== undefined && (
        <div className="flex items-center mt-2">
          {change > 0 ? (
            <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
          )}
          <span className={`text-sm ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {Math.abs(change)}%
          </span>
          <span className="text-xs text-gray-500 ml-1">vs last hour</span>
        </div>
      )}
    </div>
  );
});

StatsCard.displayName = 'StatsCard';

// Memoized Endpoint Card Component
const EndpointCard = memo(({ endpoint }: { endpoint: any }) => {
  const getStatusColor = (healthy: boolean) => 
    healthy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-900 break-all">
            {endpoint.url}
          </h3>
          <p className="text-xs text-gray-500 mt-1">{endpoint.region}</p>
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(endpoint.healthy)}`}>
          {endpoint.healthy ? (
            <>
              <CheckCircle className="w-3 h-3 mr-1" />
              Healthy
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3 mr-1" />
              Unhealthy
            </>
          )}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500">Latency</p>
          <p className="text-sm font-medium text-gray-900">{endpoint.latency}ms</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Success Rate</p>
          <p className="text-sm font-medium text-gray-900">{endpoint.success_rate}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Requests</p>
          <p className="text-sm font-medium text-gray-900">
            {(endpoint.requests_total / 1000).toFixed(1)}k
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Weight</p>
          <p className="text-sm font-medium text-gray-900">{endpoint.weight || 1}</p>
        </div>
      </div>

      {endpoint.error && (
        <div className="mt-3 p-2 bg-red-50 rounded text-xs text-red-700">
          {endpoint.error}
        </div>
      )}
    </div>
  );
});

EndpointCard.displayName = 'EndpointCard';

export function EnhancedDashboard() {
  const { getAccessToken } = usePrivy();
  const { isConnected: wsConnected, stats: wsStats, health: wsHealth, lastUpdate } = useRPCWebSocket();
  
  // State
  const [stats, setStats] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [customEndpoints, setCustomEndpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [debugRequests, setDebugRequests] = useState<any[]>([]);
  const [showDebugger, setShowDebugger] = useState(false);

  // Use WebSocket data if available, otherwise fetch
  useEffect(() => {
    if (wsConnected && wsStats) {
      setStats(wsStats);
    }
    if (wsConnected && wsHealth) {
      setHealth(wsHealth);
    }
  }, [wsConnected, wsStats, wsHealth]);

  // Fetch data if WebSocket is not connected
  const fetchData = useCallback(async () => {
    if (wsConnected) return; // Skip if WebSocket is providing data

    try {
      const token = await getAccessToken();
      if (!token) return;

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      // Fetch all data in parallel
      const [statsRes, healthRes, endpointsRes] = await Promise.all([
        fetch('/api/rpc/stats', { headers }),
        fetch('/api/rpc/health', { headers }),
        fetch('/api/rpc/endpoints', { headers }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (healthRes.ok) setHealth(await healthRes.json());
      if (endpointsRes.ok) {
        const data = await endpointsRes.json();
        setCustomEndpoints(data.endpoints || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, wsConnected]);

  useEffect(() => {
    fetchData();
    if (!wsConnected) {
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchData, wsConnected]);

  // Handle endpoint configuration save
  const handleSaveEndpointConfig = async (endpoints: any[]) => {
    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch('/api/rpc/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ endpoints }),
    });

    if (!response.ok) {
      throw new Error('Failed to save configuration');
    }
  };

  // Memoized calculations
  const overallStats = useMemo(() => {
    if (!health?.overall_health) return null;
    return health.overall_health;
  }, [health]);

  const methodsData = useMemo(() => {
    if (!stats?.methods_breakdown) return [];
    return stats.methods_breakdown;
  }, [stats]);

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">RPC Dashboard</h2>
            <p className="text-sm text-gray-600 mt-1">
              Real-time monitoring and analytics
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* WebSocket Connection Status */}
            <div className="flex items-center space-x-2">
              {wsConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500">Polling</span>
                </>
              )}
            </div>
            
            {/* Last Update */}
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}
              </span>
            )}

            {/* Configuration Button */}
            <EndpointConfiguration
              endpoints={health?.endpoints || []}
              onSave={handleSaveEndpointConfig}
            />

            {/* Refresh Button */}
            {!wsConnected && (
              <button
                onClick={fetchData}
                className="p-2 text-gray-500 hover:text-gray-700"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Requests/sec"
            value={stats?.current?.requests_per_second || 0}
            change={12}
            icon={Activity}
            loading={loading}
          />
          <StatsCard
            title="Active Connections"
            value={stats?.current?.active_connections || 0}
            change={-3}
            icon={Globe}
            loading={loading}
          />
          <StatsCard
            title="Avg Latency"
            value={`${stats?.current?.average_latency || 0}ms`}
            change={-8}
            icon={Zap}
            loading={loading}
          />
          <StatsCard
            title="Error Rate"
            value={`${(stats?.current?.error_rate || 0).toFixed(2)}%`}
            change={0}
            icon={AlertCircle}
            loading={loading}
          />
        </div>

        {/* System Health */}
        {overallStats && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium mb-4">System Health</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600">Healthy Endpoints</p>
                <p className="text-2xl font-bold text-gray-900">
                  {overallStats.healthy_endpoints} / {overallStats.total_endpoints}
                </p>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${(overallStats.healthy_endpoints / overallStats.total_endpoints) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">{overallStats.success_rate}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Requests</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(overallStats.total_requests / 1000000).toFixed(2)}M
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Endpoints Grid */}
        <div>
          <h3 className="text-lg font-medium mb-4">RPC Endpoints</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <>
                <EndpointCardSkeleton />
                <EndpointCardSkeleton />
                <EndpointCardSkeleton />
              </>
            ) : (
              health?.endpoints?.map((endpoint: any, index: number) => (
                <EndpointCard key={endpoint.url || index} endpoint={endpoint} />
              ))
            )}
          </div>
        </div>

        {/* Method Breakdown */}
        {methodsData.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium mb-4">Method Usage</h3>
            <div className="space-y-3">
              {methodsData.map((method: any) => (
                <div key={method.method} className="flex items-center">
                  <span className="text-sm font-medium text-gray-700 w-40">
                    {method.method}
                  </span>
                  <div className="flex-1 mx-4">
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-blue-500 h-4 rounded-full"
                        style={{ width: `${method.percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-gray-600 w-20 text-right">
                    {method.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Debug Panel */}
        {showDebugger && debugRequests.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-4">Request Debugger</h3>
            <RPCDebugger requests={debugRequests} />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}