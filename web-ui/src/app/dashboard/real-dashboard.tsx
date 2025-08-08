"use client";

import React, { useState, useEffect, useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Activity,
  Zap,
  Globe,
  Key,
  Clock,
  AlertCircle,
  CheckCircle,
  Server,
  Shield,
  DollarSign,
  ArrowRight,
  Sparkles,
  Gauge,
  Database,
  RefreshCw,
  Settings,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRPCWebSocket } from "@/providers/websocket-provider";
import { ClientDate } from "@/components/client-date";

interface DashboardData {
  user?: any;
  stats?: any;
  usage?: any;
  apiKeys?: any[];
  endpoints?: any[];
  recentActivity?: any[];
}

export default function RealDashboard() {
  const { user: privyUser, getAccessToken } = usePrivy();
  const { isConnected, stats: wsStats, health: wsHealth } = useRPCWebSocket();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({});
  const [timeRange, setTimeRange] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      
      // Fetch all data in parallel
      const [userRes, dashboardRes, keysRes, endpointsRes] = await Promise.all([
        fetch("/api/user/profile", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/user/dashboard", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/keys", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/rpc/endpoints", {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
      ]);

      const userData = userRes.ok ? await userRes.json() : null;
      const dashboardData = dashboardRes.ok ? await dashboardRes.json() : null;
      const keysData = keysRes.ok ? await keysRes.json() : null;
      const endpointsData = endpointsRes?.ok ? await endpointsRes.json() : null;

      setData({
        user: userData?.user,
        stats: dashboardData?.stats,
        usage: userData?.user?.usage,
        apiKeys: keysData?.keys || [],
        endpoints: endpointsData?.endpoints || [],
        recentActivity: dashboardData?.recentActivity || [],
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (privyUser) {
      fetchDashboardData();
    }
  }, [privyUser]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Calculate real metrics
  const metrics = useMemo(() => {
    const monthlyRequests = data.usage?.monthly?.requests || 0;
    const todayRequests = data.usage?.today?.requests || 0;
    const errorCount = data.usage?.monthly?.errorCount || 0;
    const successCount = data.usage?.monthly?.successCount || 0;
    const totalRequests = monthlyRequests;
    
    return {
      totalRequests: totalRequests.toLocaleString(),
      todayRequests: todayRequests.toLocaleString(),
      successRate: totalRequests > 0 ? ((successCount / totalRequests) * 100).toFixed(2) : "100.00",
      errorRate: totalRequests > 0 ? ((errorCount / totalRequests) * 100).toFixed(3) : "0.000",
      activeKeys: data.apiKeys?.filter(k => k.active).length || 0,
      totalKeys: data.apiKeys?.length || 0,
      activeEndpoints: wsHealth?.filter(e => e.healthy).length || 0,
      totalEndpoints: wsHealth?.length || 0,
      avgLatency: wsStats?.current?.average_latency || 0,
      currentRPS: wsStats?.current?.requests_per_second || 0,
    };
  }, [data, wsStats, wsHealth]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="border-0 shadow-lg">
              <CardContent className="p-6">
                <Skeleton className="h-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <Skeleton className="h-96" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back{data.user?.name ? `, ${data.user.name}` : ''}!
          </h1>
          <p className="text-gray-500 mt-1">
            Monitor your RPC infrastructure and usage
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant={isConnected ? "default" : "secondary"} className="px-3 py-1">
            <div className={cn(
              "h-2 w-2 rounded-full mr-2",
              isConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"
            )} />
            {isConnected ? "Live" : "Offline"}
          </Badge>
          
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={cn(
              "h-4 w-4 mr-2",
              autoRefresh ? "animate-spin" : ""
            )} />
            {autoRefresh ? "Auto" : "Manual"}
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              {metrics.todayRequests !== "0" && (
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  <ArrowUp className="mr-1 h-3 w-3" />
                  Active
                </Badge>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Total Requests (Month)</p>
              <p className="text-3xl font-bold">{metrics.totalRequests}</p>
              <p className="text-xs text-gray-400">Today: {metrics.todayRequests}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                Excellent
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Success Rate</p>
              <p className="text-3xl font-bold">{metrics.successRate}%</p>
              <Progress value={parseFloat(metrics.successRate)} className="h-2 mt-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Key className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">API Keys</p>
              <p className="text-3xl font-bold">{metrics.activeKeys}/{metrics.totalKeys}</p>
              <p className="text-xs text-gray-400">Active/Total</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <Server className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              {metrics.activeEndpoints === metrics.totalEndpoints && metrics.totalEndpoints > 0 && (
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  All Healthy
                </Badge>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">RPC Endpoints</p>
              <p className="text-3xl font-bold">
                {isConnected ? `${metrics.activeEndpoints}/${metrics.totalEndpoints}` : "N/A"}
              </p>
              <p className="text-xs text-gray-400">
                {isConnected ? `${metrics.avgLatency}ms avg` : "Backend offline"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* API Keys */}
        <Card className="border-0 shadow-lg lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Your active API keys</CardDescription>
              </div>
              <Link href="/dashboard/keys">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.apiKeys && data.apiKeys.length > 0 ? (
              <div className="space-y-3">
                {data.apiKeys.slice(0, 5).map((key) => (
                  <div key={key.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-center gap-3">
                      <Key className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="font-medium">{key.name}</p>
                        <p className="text-xs text-gray-500">
                          Created <ClientDate date={key.createdAt} />
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={key.active ? "default" : "secondary"}>
                        {key.active ? "Active" : "Inactive"}
                      </Badge>
                      {key.lastUsedAt && (
                        <span className="text-xs text-gray-400">
                          Used <ClientDate date={key.lastUsedAt} />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Key className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 mb-3">No API keys yet</p>
                <Link href="/dashboard/keys">
                  <Button>
                    <Key className="mr-2 h-4 w-4" />
                    Create API Key
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/dashboard/keys">
              <Button className="w-full justify-start" variant="outline">
                <Key className="mr-2 h-4 w-4" />
                Generate API Key
              </Button>
            </Link>
            <Link href="/dashboard/endpoints">
              <Button className="w-full justify-start" variant="outline">
                <Globe className="mr-2 h-4 w-4" />
                View Endpoints
              </Button>
            </Link>
            <Link href="/dashboard/analytics">
              <Button className="w-full justify-start" variant="outline">
                <Activity className="mr-2 h-4 w-4" />
                View Analytics
              </Button>
            </Link>
            <Link href="/dashboard/billing">
              <Button className="w-full justify-start" variant="outline">
                <DollarSign className="mr-2 h-4 w-4" />
                Manage Billing
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Usage Stats */}
      {data.usage && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Usage Overview</CardTitle>
            <CardDescription>Your API usage statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-gray-500">Monthly Requests</p>
                <p className="text-2xl font-bold">{data.usage.monthly?.requests?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Success Rate</p>
                <p className="text-2xl font-bold">{metrics.successRate}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Errors</p>
                <p className="text-2xl font-bold">{data.usage.monthly?.errorCount?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Data In</p>
                <p className="text-2xl font-bold">
                  {((data.usage.monthly?.bytesIn || 0) / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Data Out</p>
                <p className="text-2xl font-bold">
                  {((data.usage.monthly?.bytesOut || 0) / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upgrade CTA */}
      {data.user?.subscription?.plan !== 'PRO' && data.user?.subscription?.plan !== 'ENTERPRISE' && (
        <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">Need more power?</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Upgrade to Pro for unlimited requests, priority support, and advanced features.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/dashboard/billing">
                  <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Upgrade to Pro
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}