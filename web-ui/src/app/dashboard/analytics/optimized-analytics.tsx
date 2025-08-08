"use client";

import { useState, useEffect, useMemo, memo, useCallback } from "react";
import dynamic from "next/dynamic";
import { usePrivy } from "@privy-io/react-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cachedFetch } from "@/lib/api-cache";

// Lazy load chart components
const LineChart = dynamic(
  () => import("recharts").then((mod) => mod.LineChart),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
);

const BarChart = dynamic(
  () => import("recharts").then((mod) => mod.BarChart),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
);

const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);

const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((mod) => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), { ssr: false });
const Line = dynamic(() => import("recharts").then((mod) => mod.Line), { ssr: false });
const Bar = dynamic(() => import("recharts").then((mod) => mod.Bar), { ssr: false });

// Memoized stat card
const StatCard = memo(({ title, value, change, trend }: any) => (
  <Card className="border-0 shadow-lg">
    <CardContent className="p-6">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {change && (
        <div className="flex items-center mt-2">
          <Badge variant={trend === 'up' ? 'default' : 'secondary'}>
            {change}
          </Badge>
        </div>
      )}
    </CardContent>
  </Card>
));

StatCard.displayName = "StatCard";

export default function OptimizedAnalytics() {
  const { getAccessToken } = usePrivy();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({});
  const [timeRange, setTimeRange] = useState("7d");
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalyticsData = useCallback(async (useCache = true) => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const fetchFn = useCache ? cachedFetch : fetch;
      const response = await fetchFn(
        `/api/rpc/analytics?range=${timeRange}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        300000 // 5 minutes cache
      );

      const analyticsData = useCache ? response : await response.json();
      setData(analyticsData);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAccessToken, timeRange]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnalyticsData(false); // Skip cache on manual refresh
  }, [fetchAnalyticsData]);

  // Memoized calculations
  const stats = useMemo(() => ({
    totalRequests: data.totalRequests?.toLocaleString() || "0",
    avgLatency: data.avgLatency?.toFixed(2) || "0",
    errorRate: data.errorRate?.toFixed(2) || "0",
    successRate: data.successRate?.toFixed(2) || "100",
  }), [data]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-gray-500 mt-1">Monitor your RPC usage and performance</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 Hours</SelectItem>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Requests" value={stats.totalRequests} change="+12%" trend="up" />
        <StatCard title="Avg Latency" value={`${stats.avgLatency}ms`} change="-5%" trend="down" />
        <StatCard title="Success Rate" value={`${stats.successRate}%`} />
        <StatCard title="Error Rate" value={`${stats.errorRate}%`} />
      </div>

      {/* Charts */}
      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="latency">Latency</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Request Volume</CardTitle>
              <CardDescription>Requests over time</CardDescription>
            </CardHeader>
            <CardContent>
              {data.requestsOverTime && (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.requestsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="requests" stroke="#3B82F6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="latency">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Latency Distribution</CardTitle>
              <CardDescription>Response times</CardDescription>
            </CardHeader>
            <CardContent>
              {data.latencyDistribution && (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.latencyDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10B981" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Error Rate</CardTitle>
              <CardDescription>Errors over time</CardDescription>
            </CardHeader>
            <CardContent>
              {data.errorsOverTime && (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.errorsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="errors" stroke="#EF4444" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}