"use client";

import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Key,
  CheckCircle,
  Server,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

// Lazy load heavy components
const ChartSection = dynamic(() => import("./components/chart-section"), {
  loading: () => <Skeleton className="h-96 w-full" />,
  ssr: false,
});

const ApiKeysList = dynamic(() => import("./components/api-keys-list"), {
  loading: () => <Skeleton className="h-64 w-full" />,
  ssr: false,
});

// Memoized metric card
const MetricCard = memo(({ 
  icon: Icon, 
  iconColor, 
  title, 
  value, 
  subtitle, 
  trend 
}: any) => (
  <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${iconColor}`}>
          <Icon className="h-6 w-6" />
        </div>
        {trend && (
          <Badge variant="secondary" className={trend.className}>
            {trend.text}
          </Badge>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-3xl font-bold">{value}</p>
        {subtitle && (
          <p className="text-xs text-gray-400">{subtitle}</p>
        )}
      </div>
    </CardContent>
  </Card>
));

MetricCard.displayName = "MetricCard";

// Memoized quick action button
const QuickActionButton = memo(({ href, icon: Icon, label }: any) => (
  <Link href={href}>
    <Button className="w-full justify-start" variant="outline">
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </Button>
  </Link>
));

QuickActionButton.displayName = "QuickActionButton";

export default function OptimizedDashboard() {
  const { user: privyUser, getAccessToken } = usePrivy();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({});
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Memoized fetch function
  const fetchDashboardData = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      
      // Fetch only essential data initially
      const response = await fetch("/api/user/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const dashboardData = await response.json();
        setData(dashboardData);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  // Load data on mount
  useEffect(() => {
    if (privyUser) {
      fetchDashboardData();
    }
  }, [privyUser, fetchDashboardData]);

  // Auto-refresh with cleanup
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchDashboardData, 60000); // Every minute
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboardData]);

  // Memoized metrics calculation
  const metrics = useMemo(() => {
    const stats = data.stats || {};
    return {
      totalRequests: (stats.totalRequests || 0).toLocaleString(),
      successRate: stats.successRate || "100.00",
      activeKeys: stats.activeKeys || 0,
      totalKeys: stats.totalKeys || 0,
      activeEndpoints: stats.activeEndpoints || 0,
      totalEndpoints: stats.totalEndpoints || 0,
    };
  }, [data.stats]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
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
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back{data.user?.name ? `, ${data.user.name}` : ''}!
          </h1>
          <p className="text-gray-500 mt-1">
            Monitor your RPC infrastructure
          </p>
        </div>
        
        <Button
          variant={autoRefresh ? "default" : "outline"}
          size="sm"
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`} />
          {autoRefresh ? "Auto" : "Manual"}
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Activity}
          iconColor="bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
          title="Total Requests"
          value={metrics.totalRequests}
          subtitle="This month"
        />
        
        <MetricCard
          icon={CheckCircle}
          iconColor="bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400"
          title="Success Rate"
          value={`${metrics.successRate}%`}
          trend={{ text: "Excellent", className: "bg-green-100 text-green-700" }}
        />
        
        <MetricCard
          icon={Key}
          iconColor="bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
          title="API Keys"
          value={`${metrics.activeKeys}/${metrics.totalKeys}`}
          subtitle="Active/Total"
        />
        
        <MetricCard
          icon={Server}
          iconColor="bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
          title="Endpoints"
          value={`${metrics.activeEndpoints}/${metrics.totalEndpoints}`}
          subtitle="Healthy/Total"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* API Keys Section - Lazy loaded */}
        <div className="lg:col-span-2">
          <ApiKeysList apiKeys={data.apiKeys} />
        </div>

        {/* Quick Actions */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickActionButton href="/dashboard/keys" icon={Key} label="Generate API Key" />
            <QuickActionButton href="/dashboard/endpoints" icon={Server} label="View Endpoints" />
            <QuickActionButton href="/dashboard/analytics" icon={Activity} label="View Analytics" />
          </CardContent>
        </Card>
      </div>

      {/* Charts Section - Lazy loaded */}
      {data.usage && (
        <ChartSection usage={data.usage} />
      )}
    </div>
  );
}