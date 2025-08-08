"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  XCircle,
  BarChart3,
  Users,
  Server,
  Cpu,
  HardDrive,
  Network,
  Shield,
  DollarSign,
  ArrowRight,
  Sparkles,
  Gauge,
  Timer,
  Database,
  RefreshCw,
  Info,
  Settings,
  Wallet,
  Link2,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Download,
  Upload,
  Layers,
  GitBranch,
  Package,
  Boxes,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useRPCWebSocket } from "@/providers/websocket-provider";
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Treemap,
} from 'recharts';
import { formatDistanceToNow, format } from "date-fns";

// Enhanced color palette
const COLORS = {
  primary: ['#3B82F6', '#2563EB', '#1D4ED8'],
  success: ['#10B981', '#059669', '#047857'],
  warning: ['#F59E0B', '#D97706', '#B45309'],
  danger: ['#EF4444', '#DC2626', '#B91C1C'],
  purple: ['#8B5CF6', '#7C3AED', '#6D28D9'],
  pink: ['#EC4899', '#DB2777', '#BE185D'],
  gradient: 'from-blue-600 to-purple-600',
};

// Mock data generators
const generateTimeSeriesData = (points: number = 24) => {
  return Array.from({ length: points }, (_, i) => ({
    time: i < 10 ? `0${i}:00` : `${i}:00`,
    requests: Math.floor(Math.random() * 10000) + 5000,
    errors: Math.floor(Math.random() * 100) + 10,
    latency: Math.floor(Math.random() * 30) + 15,
    success: Math.floor(Math.random() * 5) + 95,
  }));
};

const generateEndpointData = () => [
  { name: 'Quicknode US', health: 99.9, latency: 18, requests: 458234, region: 'us-east-1', status: 'healthy' },
  { name: 'Alchemy EU', health: 99.7, latency: 22, requests: 392847, region: 'eu-west-1', status: 'healthy' },
  { name: 'Helius Asia', health: 98.2, latency: 35, requests: 284729, region: 'ap-south-1', status: 'degraded' },
  { name: 'Triton US West', health: 99.8, latency: 20, requests: 372918, region: 'us-west-2', status: 'healthy' },
  { name: 'Ankr Global', health: 99.5, latency: 28, requests: 318492, region: 'global', status: 'healthy' },
];

const generateMethodData = () => [
  { method: 'getLatestBlockhash', count: 45234, percentage: 28, avgLatency: 15 },
  { method: 'getAccountInfo', count: 38421, percentage: 24, avgLatency: 18 },
  { method: 'sendTransaction', count: 29876, percentage: 18, avgLatency: 45 },
  { method: 'getSignatureStatuses', count: 24567, percentage: 15, avgLatency: 12 },
  { method: 'getBalance', count: 15234, percentage: 10, avgLatency: 10 },
  { method: 'getSlot', count: 8234, percentage: 5, avgLatency: 8 },
];

const generateNetworkData = () => [
  { subject: 'Throughput', A: 90, B: 85, fullMark: 100 },
  { subject: 'Latency', A: 95, B: 88, fullMark: 100 },
  { subject: 'Availability', A: 99, B: 96, fullMark: 100 },
  { subject: 'Error Rate', A: 92, B: 89, fullMark: 100 },
  { subject: 'Cache Hit', A: 88, B: 82, fullMark: 100 },
];

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  loading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  description,
  trend = 'neutral',
  color = 'blue',
  loading = false,
}) => {
  const colorMap = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-xl ${colorMap[color]} transition-transform group-hover:scale-110`}>
            <Icon className="h-6 w-6" />
          </div>
          {change !== undefined && (
            <Badge 
              variant="secondary" 
              className={cn(
                "font-semibold",
                trend === 'up' ? "bg-green-100 text-green-700" : 
                trend === 'down' ? "bg-red-100 text-red-700" : 
                "bg-gray-100 text-gray-700"
              )}
            >
              {trend === 'up' && <ArrowUp className="mr-1 h-3 w-3" />}
              {trend === 'down' && <ArrowDown className="mr-1 h-3 w-3" />}
              {Math.abs(change)}%
            </Badge>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {description && (
            <p className="text-xs text-gray-400 mt-1">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function ComprehensiveDashboard() {
  const { user } = useAuth();
  const { isConnected, stats, health, lastUpdate } = useRPCWebSocket();
  const [timeRange, setTimeRange] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState('all');
  
  // Data states
  const [timeSeriesData, setTimeSeriesData] = useState(generateTimeSeriesData());
  const [endpointData, setEndpointData] = useState(generateEndpointData());
  const [methodData, setMethodData] = useState(generateMethodData());
  const [networkData, setNetworkData] = useState(generateNetworkData());
  
  // Loading states
  const [loading, setLoading] = useState(false);

  // Auto-refresh simulation
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      setTimeSeriesData(generateTimeSeriesData());
      setEndpointData(generateEndpointData());
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Calculate aggregate metrics
  const metrics = useMemo(() => {
    const total = timeSeriesData.reduce((acc, d) => acc + d.requests, 0);
    const errors = timeSeriesData.reduce((acc, d) => acc + d.errors, 0);
    const avgLatency = timeSeriesData.reduce((acc, d) => acc + d.latency, 0) / timeSeriesData.length;
    const successRate = ((total - errors) / total * 100).toFixed(2);
    
    return {
      totalRequests: total.toLocaleString(),
      successRate: `${successRate}%`,
      avgLatency: `${Math.round(avgLatency)}ms`,
      activeEndpoints: endpointData.filter(e => e.status === 'healthy').length,
      totalEndpoints: endpointData.length,
      throughput: `${Math.round(total / 24)}`,
      errorRate: `${((errors / total) * 100).toFixed(3)}%`,
      p95Latency: `${Math.round(avgLatency * 1.8)}ms`,
      p99Latency: `${Math.round(avgLatency * 2.5)}ms`,
    };
  }, [timeSeriesData, endpointData]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            RPC Infrastructure Dashboard
          </h1>
          <p className="text-gray-500 mt-1">
            Monitor and manage your Solana RPC endpoints in real-time
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
          
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          
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

      {/* Alert Banner */}
      {!isConnected && (
        <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            <strong>Backend Connection:</strong> The Multi-RPC backend is not connected. Showing demo data. 
            Start the backend service to see live metrics.
          </AlertDescription>
        </Alert>
      )}

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Requests"
          value={metrics.totalRequests}
          change={12.5}
          trend="up"
          icon={Activity}
          description={`~${metrics.throughput} req/hour`}
          color="blue"
        />
        <MetricCard
          title="Success Rate"
          value={metrics.successRate}
          change={0.3}
          trend="up"
          icon={CheckCircle}
          description={`Error rate: ${metrics.errorRate}`}
          color="green"
        />
        <MetricCard
          title="Avg Latency"
          value={metrics.avgLatency}
          change={8.2}
          trend="down"
          icon={Gauge}
          description={`P95: ${metrics.p95Latency} | P99: ${metrics.p99Latency}`}
          color="purple"
        />
        <MetricCard
          title="Active Endpoints"
          value={`${metrics.activeEndpoints}/${metrics.totalEndpoints}`}
          icon={Server}
          description="All systems operational"
          color="orange"
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full lg:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="methods">Methods</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Request Volume Chart */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Request Volume & Performance</CardTitle>
                  <CardDescription>
                    Requests, errors, and latency over time
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={timeSeriesData}>
                  <defs>
                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.3} />
                  <XAxis dataKey="time" stroke="#6B7280" fontSize={12} />
                  <YAxis stroke="#6B7280" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(17, 24, 39, 0.95)', 
                      border: 'none', 
                      borderRadius: '8px',
                      backdropFilter: 'blur(10px)'
                    }}
                    labelStyle={{ color: '#F3F4F6' }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="requests" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorRequests)" 
                    name="Requests"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="errors" 
                    stroke="#EF4444" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorErrors)" 
                    name="Errors"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="latency" 
                    stroke="#8B5CF6" 
                    strokeWidth={2}
                    dot={false}
                    name="Latency (ms)"
                    yAxisId="right"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Secondary Metrics Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Stats */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Current infrastructure status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'CPU Usage', value: 42, status: 'healthy' },
                  { label: 'Memory Usage', value: 68, status: 'warning' },
                  { label: 'Network I/O', value: 35, status: 'healthy' },
                  { label: 'Disk Usage', value: 51, status: 'healthy' },
                  { label: 'Cache Hit Rate', value: 89, status: 'excellent' },
                ].map((metric, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{metric.label}</span>
                      <span className={cn(
                        "font-semibold",
                        metric.status === 'excellent' ? "text-blue-600" :
                        metric.status === 'healthy' ? "text-green-600" :
                        metric.status === 'warning' ? "text-yellow-600" :
                        "text-red-600"
                      )}>
                        {metric.value}%
                      </span>
                    </div>
                    <Progress 
                      value={metric.value} 
                      className={cn(
                        "h-2",
                        metric.status === 'excellent' ? "[&>div]:bg-blue-500" : "",
                        metric.status === 'warning' ? "[&>div]:bg-yellow-500" : ""
                      )}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="border-0 shadow-lg lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Events</CardTitle>
                    <CardDescription>Latest system activities</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { 
                      type: 'success', 
                      title: 'New API Key Generated', 
                      description: 'Production key for mainnet access', 
                      time: '2 minutes ago',
                      icon: Key 
                    },
                    { 
                      type: 'warning', 
                      title: 'High Latency Detected', 
                      description: 'Asia endpoint experiencing 150ms+ latency', 
                      time: '15 minutes ago',
                      icon: AlertCircle 
                    },
                    { 
                      type: 'info', 
                      title: 'Burst Traffic Handled', 
                      description: 'Successfully processed 10k req/s spike', 
                      time: '1 hour ago',
                      icon: Zap 
                    },
                    { 
                      type: 'success', 
                      title: 'Endpoint Recovery', 
                      description: 'EU endpoint back to normal operation', 
                      time: '2 hours ago',
                      icon: CheckCircle 
                    },
                    { 
                      type: 'info', 
                      title: 'Cache Purged', 
                      description: 'Automated cache cleanup completed', 
                      time: '3 hours ago',
                      icon: Database 
                    },
                  ].map((event, index) => (
                    <div 
                      key={index} 
                      className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className={cn(
                        "p-2 rounded-lg",
                        event.type === 'success' ? "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400" :
                        event.type === 'warning' ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400" :
                        event.type === 'error' ? "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400" :
                        "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                      )}>
                        <event.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{event.title}</p>
                        <p className="text-xs text-gray-500 truncate">{event.description}</p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{event.time}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Latency Distribution */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Latency Distribution</CardTitle>
                <CardDescription>Response time percentiles</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.3} />
                    <XAxis dataKey="time" stroke="#6B7280" fontSize={12} />
                    <YAxis stroke="#6B7280" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(17, 24, 39, 0.95)', 
                        border: 'none', 
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="latency" stroke="#10B981" strokeWidth={2} name="P50" />
                    <Line type="monotone" dataKey="success" stroke="#F59E0B" strokeWidth={2} name="P95" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Success Rate Trend */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Success Rate Trend</CardTitle>
                <CardDescription>Request success percentage over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={timeSeriesData}>
                    <defs>
                      <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.3} />
                    <XAxis dataKey="time" stroke="#6B7280" fontSize={12} />
                    <YAxis stroke="#6B7280" fontSize={12} domain={[90, 100]} />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="success" 
                      stroke="#10B981" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorSuccess)" 
                      name="Success Rate %"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>RPC Endpoints</CardTitle>
                  <CardDescription>Monitor and manage your endpoints</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Regions</SelectItem>
                      <SelectItem value="us">US</SelectItem>
                      <SelectItem value="eu">EU</SelectItem>
                      <SelectItem value="asia">Asia</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button>
                    <Globe className="h-4 w-4 mr-2" />
                    Add Endpoint
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {endpointData.map((endpoint, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "h-3 w-3 rounded-full",
                        endpoint.status === 'healthy' ? "bg-green-500 animate-pulse" :
                        endpoint.status === 'degraded' ? "bg-yellow-500" :
                        "bg-red-500"
                      )} />
                      <div>
                        <p className="font-medium">{endpoint.name}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-gray-500">
                            <Globe className="inline h-3 w-3 mr-1" />
                            {endpoint.region}
                          </span>
                          <span className="text-xs text-gray-500">
                            <Activity className="inline h-3 w-3 mr-1" />
                            {endpoint.requests.toLocaleString()} requests
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-medium">{endpoint.health}%</p>
                        <p className="text-xs text-gray-500">Health</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{endpoint.latency}ms</p>
                        <p className="text-xs text-gray-500">Latency</p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="methods" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Method Distribution */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Method Distribution</CardTitle>
                <CardDescription>Most frequently called RPC methods</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={methodData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.percentage}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="percentage"
                    >
                      {methodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS.primary[index % COLORS.primary.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {methodData.map((method, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="h-3 w-3 rounded" 
                        style={{ backgroundColor: COLORS.primary[index % COLORS.primary.length] }} 
                      />
                      <span className="text-xs text-gray-600 truncate">{method.method}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Method Performance */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Method Performance</CardTitle>
                <CardDescription>Average latency by method</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={methodData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.3} />
                    <XAxis type="number" stroke="#6B7280" fontSize={12} />
                    <YAxis dataKey="method" type="category" stroke="#6B7280" fontSize={10} width={120} />
                    <Tooltip />
                    <Bar dataKey="avgLatency" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="network" className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Network Performance Comparison</CardTitle>
              <CardDescription>Comparing performance across different metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={networkData}>
                  <PolarGrid stroke="#E5E7EB" />
                  <PolarAngleAxis dataKey="subject" stroke="#6B7280" fontSize={12} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#6B7280" fontSize={10} />
                  <Radar name="Current" dataKey="A" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                  <Radar name="Previous" dataKey="B" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
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
              <Button variant="outline">
                Learn More
              </Button>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                <Sparkles className="mr-2 h-4 w-4" />
                Upgrade to Pro
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}