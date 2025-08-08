"use client";

import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from "react";
import dynamic from "next/dynamic";
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
  Clock,
  Database,
  Shield,
  BarChart3,
  Cpu,
  HardDrive,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { StatsCardSkeleton, EndpointCardSkeleton } from "@/components/loading-skeleton";

// Lazy load heavy components
const EndpointConfiguration = dynamic(
  () => import("@/components/endpoint-config").then(mod => ({ default: mod.EndpointConfiguration })),
  { ssr: false }
);

const RPCDebugger = dynamic(
  () => import("@/components/rpc-debugger").then(mod => ({ default: mod.RPCDebugger })),
  { ssr: false }
);

// Modern Stats Card
const StatsCard = memo(({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  loading = false,
  color = "purple"
}: {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  loading?: boolean;
  color?: "purple" | "blue" | "green" | "red";
}) => {
  if (loading) return <StatsCardSkeleton />;

  const colorClasses = {
    purple: "from-purple-500/20 to-purple-600/20 group-hover:from-purple-500/30 group-hover:to-purple-600/30",
    blue: "from-blue-500/20 to-blue-600/20 group-hover:from-blue-500/30 group-hover:to-blue-600/30",
    green: "from-green-500/20 to-green-600/20 group-hover:from-green-500/30 group-hover:to-green-600/30",
    red: "from-red-500/20 to-red-600/20 group-hover:from-red-500/30 group-hover:to-red-600/30",
  };

  const iconColors = {
    purple: "text-purple-400",
    blue: "text-blue-400",
    green: "text-green-400",
    red: "text-red-400",
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl glass-subtle border-0 p-6 transition-all duration-300 hover:scale-[1.02] card-hover">
      <div className="absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity duration-300 ${colorClasses[color]}" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-xl glass-subtle ${iconColors[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
          {change !== undefined && (
            <div className={`flex items-center gap-1 text-sm font-medium ${
              change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-400'
            }`}>
              {change !== 0 && (
                <div className={change > 0 ? '' : 'rotate-180'}>
                  <TrendingUp className="w-4 h-4" />
                </div>
              )}
              <span>{change > 0 ? '+' : ''}{change}%</span>
            </div>
          )}
        </div>
        
        <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
        <p className="text-3xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
});

StatsCard.displayName = 'StatsCard';

// Modern Endpoint Card
const EndpointCard = memo(({ endpoint }: { endpoint: any }) => {
  const healthPercentage = endpoint.success_rate || 0;
  const isHealthy = endpoint.healthy;
  
  const formatUrl = useCallback((url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return url;
    }
  }, []);

  return (
    <div className="group relative overflow-hidden rounded-2xl glass border-0 p-6 transition-all duration-300 hover:scale-[1.02] card-hover">
      {/* Animated gradient background */}
      <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${
        isHealthy ? 'from-green-500 to-emerald-600' : 'from-red-500 to-rose-600'
      }`} />
      
      {/* Health indicator line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800">
        <div 
          className={`h-full transition-all duration-500 ${
            healthPercentage >= 95 ? 'bg-gradient-to-r from-green-400 to-emerald-400' : 
            healthPercentage >= 80 ? 'bg-gradient-to-r from-yellow-400 to-amber-400' : 
            'bg-gradient-to-r from-red-400 to-rose-400'
          }`}
          style={{ width: `${healthPercentage}%` }}
        />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
              <Server className="w-4 h-4 text-muted-foreground" />
              {formatUrl(endpoint.url)}
            </h3>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {endpoint.region || 'Global'}
              </span>
              <span className={`font-medium ${
                isHealthy ? 'text-green-400' : 'text-red-400'
              }`}>
                {healthPercentage.toFixed(1)}% uptime
              </span>
            </div>
          </div>
          <div className={`p-3 rounded-xl ${
            isHealthy ? 'bg-green-500/10' : 'bg-red-500/10'
          }`}>
            {isHealthy ? (
              <CheckCircle className={`w-5 h-5 ${isHealthy ? 'text-green-400' : 'text-red-400'}`} />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6">
          {[
            { icon: Clock, label: "Latency", value: `${endpoint.latency}ms`, color: "text-blue-400" },
            { icon: Activity, label: "Requests", value: endpoint.requests_total >= 1000000 
              ? `${(endpoint.requests_total / 1000000).toFixed(1)}M`
              : endpoint.requests_total >= 1000
              ? `${(endpoint.requests_total / 1000).toFixed(1)}K`
              : endpoint.requests_total, color: "text-purple-400" },
            { icon: Database, label: "Weight", value: endpoint.weight || 1, color: "text-cyan-400" },
          ].map((stat, idx) => (
            <div key={idx} className="text-center p-3 rounded-xl glass-subtle">
              <stat.icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className="text-sm font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        {endpoint.error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400 font-medium">Error: {endpoint.error}</p>
          </div>
        )}
      </div>
    </div>
  );
});

EndpointCard.displayName = 'EndpointCard';

export function EnhancedDashboard() {
  const { getAccessToken } = usePrivy();
  const { isConnected: wsConnected, stats: wsStats, health: wsHealth, lastUpdate } = useRPCWebSocket();
  
  // State
  const [stats, setStats] = useState<any>(wsStats || null);
  const [health, setHealth] = useState<any>(wsHealth || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Refs
  const fetchIntervalRef = useRef<NodeJS.Timeout>();
  const lastFetchRef = useRef<number>(0);

  // Optimized WebSocket data sync
  useEffect(() => {
    if (wsStats) {
      setStats(wsStats);
      setError(null);
    }
    if (wsHealth) {
      setHealth(wsHealth);
      setError(null);
    }
  }, [wsStats, wsHealth]);

  // Fetch data
  const fetchData = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < 5000) return;
    lastFetchRef.current = now;

    if (wsConnected && lastUpdate && Date.now() - lastUpdate.getTime() < 5000) {
      setLoading(false);
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const fetchWithTimeout = (url: string) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        return fetch(url, { headers, signal: controller.signal })
          .finally(() => clearTimeout(timeout));
      };

      const [statsRes, healthRes] = await Promise.all([
        fetchWithTimeout('/api/rpc/stats'),
        fetchWithTimeout('/api/rpc/health'),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setHealth(healthData);
      }
      
      setError(null);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Dashboard fetch error:', error);
        setError('Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, wsConnected, lastUpdate]);

  // Polling
  useEffect(() => {
    fetchData();
    
    if (!wsConnected) {
      fetchIntervalRef.current = setInterval(fetchData, 30000);
      return () => {
        if (fetchIntervalRef.current) {
          clearInterval(fetchIntervalRef.current);
        }
      };
    }
  }, [fetchData, wsConnected]);

  // Handle endpoint config save
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
  const overallStats = useMemo(() => health?.overall_health || null, [health]);
  const methodsData = useMemo(() => stats?.methods_breakdown || [], [stats]);
  const healthyEndpoints = useMemo(() => {
    if (!health?.endpoints) return 0;
    return health.endpoints.filter((e: any) => e.healthy).length;
  }, [health]);
  const avgLatency = useMemo(() => {
    if (!health?.endpoints?.length) return 0;
    const sum = health.endpoints.reduce((acc: number, e: any) => acc + (e.latency || 0), 0);
    return Math.round(sum / health.endpoints.length);
  }, [health]);

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => <StatsCardSkeleton key={i} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <EndpointCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-2xl glass border-0 p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Error loading dashboard</h3>
            <p className="text-muted-foreground mb-6">{error}</p>
            <button
              onClick={fetchData}
              className="btn-primary"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="rounded-2xl glass border-0 p-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gradient-animate flex items-center gap-3 animate-slide-up">
                <Sparkles className="w-10 h-10 text-purple-400 animate-pulse-glow" />
                RPC Dashboard
              </h1>
              <p className="text-muted-foreground mt-2">
                Real-time monitoring and analytics for your Solana RPC endpoints
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
                wsConnected 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                  : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
              }`}>
                {wsConnected ? (
                  <>
                    <div className="status-dot status-dot-green rounded-full" />
                    <span className="text-sm font-medium">Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4" />
                    <span className="text-sm font-medium">Polling</span>
                  </>
                )}
              </div>
              
              {lastUpdate && (
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(lastUpdate, { addSuffix: true })}
                </span>
              )}

              <EndpointConfiguration
                endpoints={health?.endpoints || []}
                onSave={handleSaveEndpointConfig}
              />
              
              <button
                onClick={fetchData}
                className="btn-ghost"
                title="Refresh data"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Requests/sec"
            value={stats?.current?.requests_per_second?.toLocaleString() || '0'}
            change={stats?.trends?.rps_change}
            icon={Activity}
            color="purple"
            loading={loading}
          />
          <StatsCard
            title="Avg Latency"
            value={`${avgLatency}ms`}
            change={stats?.trends?.latency_change}
            icon={Clock}
            color="blue"
            loading={loading}
          />
          <StatsCard
            title="Healthy Endpoints"
            value={`${healthyEndpoints}/${health?.endpoints?.length || 0}`}
            icon={Shield}
            color="green"
            loading={loading}
          />
          <StatsCard
            title="Error Rate"
            value={`${(stats?.current?.error_rate || 0).toFixed(2)}%`}
            change={stats?.trends?.error_change}
            icon={AlertCircle}
            color="red"
            loading={loading}
          />
        </div>

        {/* Tabs */}
        <div className="rounded-2xl glass border-0 overflow-hidden">
          <div className="border-b border-gray-800">
            <nav className="-mb-px flex px-8" aria-label="Tabs">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'endpoints', label: 'Endpoints', icon: Server },
                { id: 'debugger', label: 'Debugger', icon: Activity },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    group inline-flex items-center py-4 px-6 border-b-2 font-medium text-sm transition-all
                    ${activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-700'
                    }
                  `}
                >
                  <tab.icon className={`mr-2 h-5 w-5 ${
                    activeTab === tab.id ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                  }`} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-8">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* System Health */}
                {overallStats && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-6 rounded-2xl glass-subtle">
                      <Cpu className="w-8 h-8 text-purple-400 mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground mb-2">System Health</p>
                      <div className="relative inline-flex items-center justify-center mb-4">
                        <svg className="w-32 h-32">
                          <circle
                            className="text-gray-800"
                            strokeWidth="8"
                            stroke="currentColor"
                            fill="transparent"
                            r="56"
                            cx="64"
                            cy="64"
                          />
                          <circle
                            className="text-purple-500"
                            strokeWidth="8"
                            strokeDasharray={`${(overallStats.healthy_endpoints / overallStats.total_endpoints) * 351.86} 351.86`}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r="56"
                            cx="64"
                            cy="64"
                            transform="rotate(-90 64 64)"
                          />
                        </svg>
                        <span className="absolute text-2xl font-bold text-foreground">
                          {Math.round((overallStats.healthy_endpoints / overallStats.total_endpoints) * 100)}%
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {overallStats.healthy_endpoints} of {overallStats.total_endpoints} healthy
                      </p>
                    </div>
                    
                    <div className="text-center p-6 rounded-2xl glass-subtle">
                      <HardDrive className="w-8 h-8 text-blue-400 mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground mb-2">Success Rate</p>
                      <p className="text-4xl font-bold text-foreground mb-4">{overallStats.success_rate}%</p>
                      <p className="text-sm text-muted-foreground">Last 24 hours</p>
                    </div>
                    
                    <div className="text-center p-6 rounded-2xl glass-subtle">
                      <Activity className="w-8 h-8 text-green-400 mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground mb-2">Total Requests</p>
                      <p className="text-4xl font-bold text-foreground mb-4">
                        {overallStats.total_requests >= 1000000000
                          ? `${(overallStats.total_requests / 1000000000).toFixed(2)}B`
                          : overallStats.total_requests >= 1000000
                          ? `${(overallStats.total_requests / 1000000).toFixed(2)}M`
                          : `${(overallStats.total_requests / 1000).toFixed(0)}K`
                        }
                      </p>
                      <p className="text-sm text-muted-foreground">Lifetime</p>
                    </div>
                  </div>
                )}

                {/* Method Breakdown */}
                {methodsData.length > 0 && (
                  <div className="rounded-2xl glass-subtle p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-6">RPC Method Usage</h3>
                    <div className="space-y-4">
                      {methodsData.slice(0, 5).map((method: any) => (
                        <div key={method.method} className="flex items-center">
                          <span className="text-sm font-medium text-foreground w-48">
                            {method.method}
                          </span>
                          <div className="flex-1 mx-4">
                            <div className="w-full bg-gray-800 rounded-full h-6 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-purple-500 to-purple-600 h-6 rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                                style={{ width: `${method.percentage}%` }}
                              >
                                <span className="text-xs text-white font-medium">
                                  {method.percentage}%
                                </span>
                              </div>
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground w-24 text-right">
                            {method.count?.toLocaleString() || 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'endpoints' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {health?.endpoints?.map((endpoint: any, index: number) => (
                  <EndpointCard key={`${endpoint.url}-${index}`} endpoint={endpoint} />
                ))}
                {(!health?.endpoints || health.endpoints.length === 0) && (
                  <div className="col-span-full text-center py-12">
                    <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No endpoints configured</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'debugger' && (
              <div className="min-h-[400px]">
                <RPCDebugger requests={[]} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}