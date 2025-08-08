"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  Calendar,
  Download,
  Filter,
  AlertCircle,
  CheckCircle,
  XCircle,
  Zap,
  Globe,
  Server,
  Users,
  DollarSign,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  RefreshCw,
  Info,
  ChevronDown,
  Database,
  Cpu,
  Network,
  HardDrive,
  Shield,
  Target,
  Layers,
  GitBranch,
  Hash,
  FileText,
  PieChart,
  LineChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  AreaChart, 
  Area, 
  BarChart as RechartsBarChart, 
  Bar, 
  LineChart as RechartsLineChart, 
  Line,
  PieChart as RechartsPieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer, 
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Treemap,
  ComposedChart,
  ScatterChart,
  Scatter,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, subHours, subMonths } from "date-fns";

// Enhanced color palette
const CHART_COLORS = {
  primary: '#3B82F6',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#06B6D4',
  series: ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#84CC16'],
};

// Mock data generators
const generateTimeSeriesData = (points: number, range: string) => {
  const now = new Date();
  const data = [];
  
  for (let i = points - 1; i >= 0; i--) {
    let time;
    if (range === '1h') {
      time = format(subHours(now, i), 'HH:mm');
    } else if (range === '24h') {
      time = format(subHours(now, i), 'HH:00');
    } else if (range === '7d') {
      time = format(subDays(now, i), 'MMM dd');
    } else {
      time = format(subDays(now, i), 'MMM dd');
    }
    
    data.push({
      time,
      requests: Math.floor(Math.random() * 10000) + 5000,
      success: Math.floor(Math.random() * 9500) + 4800,
      errors: Math.floor(Math.random() * 500) + 50,
      latency: Math.floor(Math.random() * 30) + 15,
      p50: Math.floor(Math.random() * 20) + 10,
      p95: Math.floor(Math.random() * 40) + 25,
      p99: Math.floor(Math.random() * 60) + 40,
      throughput: Math.floor(Math.random() * 1000) + 500,
    });
  }
  
  return data;
};

const generateMethodData = () => [
  { name: 'getLatestBlockhash', count: 145234, percentage: 28, avgLatency: 15, errorRate: 0.1 },
  { name: 'getAccountInfo', count: 128421, percentage: 24, avgLatency: 18, errorRate: 0.2 },
  { name: 'sendTransaction', count: 89876, percentage: 18, avgLatency: 45, errorRate: 0.5 },
  { name: 'getSignatureStatuses', count: 74567, percentage: 15, avgLatency: 12, errorRate: 0.1 },
  { name: 'getBalance', count: 45234, percentage: 10, avgLatency: 10, errorRate: 0.05 },
  { name: 'getSlot', count: 28234, percentage: 5, avgLatency: 8, errorRate: 0.02 },
];

const generateEndpointPerformance = () => [
  { endpoint: 'Quicknode US', requests: 458234, latency: 18, successRate: 99.9, errorCount: 458 },
  { endpoint: 'Alchemy EU', requests: 392847, latency: 22, successRate: 99.7, errorCount: 1178 },
  { endpoint: 'Helius Asia', requests: 284729, latency: 35, successRate: 98.2, errorCount: 5125 },
  { endpoint: 'Triton West', requests: 372918, latency: 20, successRate: 99.8, errorCount: 746 },
  { endpoint: 'Ankr Global', requests: 318492, latency: 28, successRate: 99.5, errorCount: 1592 },
];

const generateGeographicData = () => [
  { region: 'North America', requests: 850000, percentage: 42 },
  { region: 'Europe', requests: 550000, percentage: 27 },
  { region: 'Asia Pacific', requests: 380000, percentage: 19 },
  { region: 'South America', requests: 140000, percentage: 7 },
  { region: 'Africa', requests: 60000, percentage: 3 },
  { region: 'Oceania', requests: 40000, percentage: 2 },
];

const generateCostData = () => [
  { date: 'Jan', cost: 1250, requests: 2500000 },
  { date: 'Feb', cost: 1380, requests: 2760000 },
  { date: 'Mar', cost: 1520, requests: 3040000 },
  { date: 'Apr', cost: 1680, requests: 3360000 },
  { date: 'May', cost: 1850, requests: 3700000 },
  { date: 'Jun', cost: 2100, requests: 4200000 },
];

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  description?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  loading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  trend = 'neutral',
  icon: Icon,
  description,
  color = 'blue',
  loading = false,
}) => {
  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  const colorMap = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  };

  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-lg ${colorMap[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
          {change !== undefined && (
            <div className={cn(
              "flex items-center gap-1 text-sm font-medium",
              trend === 'up' ? "text-green-600" : 
              trend === 'down' ? "text-red-600" : 
              "text-gray-500"
            )}>
              {trend === 'up' && <ArrowUp className="h-3 w-3" />}
              {trend === 'down' && <ArrowDown className="h-3 w-3" />}
              <span>{Math.abs(change)}%</span>
            </div>
          )}
        </div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        {description && (
          <p className="text-xs text-gray-400 mt-2">{description}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default function EnhancedAnalyticsPage() {
  const { getAccessToken } = usePrivy();
  const [timeRange, setTimeRange] = useState("24h");
  const [selectedMetric, setSelectedMetric] = useState("requests");
  const [compareMode, setCompareMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // Data states
  const [timeSeriesData, setTimeSeriesData] = useState(() => generateTimeSeriesData(24, '24h'));
  const [methodData, setMethodData] = useState(generateMethodData());
  const [endpointData, setEndpointData] = useState(generateEndpointPerformance());
  const [geographicData, setGeographicData] = useState(generateGeographicData());
  const [costData, setCostData] = useState(generateCostData());

  // Update data when time range changes
  useEffect(() => {
    const points = timeRange === '1h' ? 60 : timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : 30;
    setTimeSeriesData(generateTimeSeriesData(points, timeRange));
  }, [timeRange]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      const points = timeRange === '1h' ? 60 : timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : 30;
      setTimeSeriesData(generateTimeSeriesData(points, timeRange));
      setMethodData(generateMethodData());
      setEndpointData(generateEndpointPerformance());
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, timeRange]);

  // Calculate aggregate metrics
  const metrics = useMemo(() => {
    const total = timeSeriesData.reduce((acc, d) => acc + d.requests, 0);
    const success = timeSeriesData.reduce((acc, d) => acc + d.success, 0);
    const errors = timeSeriesData.reduce((acc, d) => acc + d.errors, 0);
    const avgLatency = timeSeriesData.reduce((acc, d) => acc + d.latency, 0) / timeSeriesData.length;
    
    return {
      totalRequests: total,
      successRate: ((success / total) * 100).toFixed(2),
      errorRate: ((errors / total) * 100).toFixed(3),
      avgLatency: Math.round(avgLatency),
      p50Latency: Math.round(avgLatency * 0.8),
      p95Latency: Math.round(avgLatency * 1.8),
      p99Latency: Math.round(avgLatency * 2.5),
      avgThroughput: Math.round(total / timeSeriesData.length),
      peakThroughput: Math.max(...timeSeriesData.map(d => d.throughput)),
      totalCost: costData.reduce((acc, d) => acc + d.cost, 0),
      costPerRequest: (costData[costData.length - 1].cost / costData[costData.length - 1].requests * 1000).toFixed(3),
    };
  }, [timeSeriesData, costData]);

  const exportData = () => {
    const dataStr = JSON.stringify({ timeSeriesData, methodData, endpointData, metrics }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `analytics-${timeRange}-${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-gray-500 mt-1">
              Comprehensive insights into your RPC usage and performance
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", autoRefresh ? "animate-spin" : "")} />
              {autoRefresh ? "Live" : "Paused"}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportData}>
                  <FileText className="h-4 w-4 mr-2" />
                  JSON
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <FileText className="h-4 w-4 mr-2" />
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <FileText className="h-4 w-4 mr-2" />
                  PDF Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Requests"
            value={metrics.totalRequests.toLocaleString()}
            change={12.5}
            trend="up"
            icon={Activity}
            description={`~${metrics.avgThroughput.toLocaleString()} avg/hour`}
            color="blue"
          />
          <MetricCard
            title="Success Rate"
            value={`${metrics.successRate}%`}
            change={0.3}
            trend="up"
            icon={CheckCircle}
            description={`Error rate: ${metrics.errorRate}%`}
            color="green"
          />
          <MetricCard
            title="Avg Latency"
            value={`${metrics.avgLatency}ms`}
            change={8.2}
            trend="down"
            icon={Clock}
            description={`P50: ${metrics.p50Latency}ms | P95: ${metrics.p95Latency}ms`}
            color="purple"
          />
          <MetricCard
            title="Cost Efficiency"
            value={`$${metrics.costPerRequest}`}
            change={5.1}
            trend="down"
            icon={DollarSign}
            description={`Total: $${metrics.totalCost.toLocaleString()}`}
            color="orange"
          />
        </div>

        {/* Main Analytics Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid grid-cols-6 w-full lg:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="methods">Methods</TabsTrigger>
            <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
            <TabsTrigger value="geographic">Geographic</TabsTrigger>
            <TabsTrigger value="costs">Costs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Request Volume Chart */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Request Volume & Success Rate</CardTitle>
                    <CardDescription>
                      Request distribution and success metrics over time
                    </CardDescription>
                  </div>
                  <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="requests">Requests</SelectItem>
                      <SelectItem value="latency">Latency</SelectItem>
                      <SelectItem value="errors">Errors</SelectItem>
                      <SelectItem value="throughput">Throughput</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={timeSeriesData}>
                    <defs>
                      <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.3} />
                    <XAxis dataKey="time" stroke="#6B7280" fontSize={11} />
                    <YAxis yAxisId="left" stroke="#6B7280" fontSize={11} />
                    <YAxis yAxisId="right" orientation="right" stroke="#6B7280" fontSize={11} />
                    <ChartTooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(17, 24, 39, 0.95)', 
                        border: 'none', 
                        borderRadius: '8px',
                        backdropFilter: 'blur(10px)'
                      }}
                    />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="requests"
                      stroke={CHART_COLORS.primary}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRequests)"
                      name="Total Requests"
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="success"
                      stroke={CHART_COLORS.success}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorSuccess)"
                      name="Successful"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="errors"
                      stroke={CHART_COLORS.danger}
                      strokeWidth={2}
                      dot={false}
                      name="Errors"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Secondary Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Method Distribution */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Top RPC Methods</CardTitle>
                  <CardDescription>Most frequently used methods</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
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
                          <Cell key={`cell-${index}`} fill={CHART_COLORS.series[index % CHART_COLORS.series.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {methodData.slice(0, 6).map((method, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded" 
                          style={{ backgroundColor: CHART_COLORS.series[index % CHART_COLORS.series.length] }} 
                        />
                        <span className="text-xs text-gray-600 truncate">{method.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Endpoint Health */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Endpoint Performance</CardTitle>
                  <CardDescription>Success rates by endpoint</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {endpointData.map((endpoint, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "h-2 w-2 rounded-full",
                              endpoint.successRate > 99.5 ? "bg-green-500" :
                              endpoint.successRate > 98 ? "bg-yellow-500" :
                              "bg-red-500"
                            )} />
                            <span className="text-sm font-medium">{endpoint.endpoint}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-gray-500">{endpoint.latency}ms</span>
                            <Badge variant={endpoint.successRate > 99 ? "default" : "secondary"}>
                              {endpoint.successRate}%
                            </Badge>
                          </div>
                        </div>
                        <Progress value={endpoint.successRate} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            {/* Latency Analysis */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Latency Percentiles</CardTitle>
                <CardDescription>Response time distribution across percentiles</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <RechartsLineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.3} />
                    <XAxis dataKey="time" stroke="#6B7280" fontSize={11} />
                    <YAxis stroke="#6B7280" fontSize={11} />
                    <ChartTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="p50" stroke={CHART_COLORS.success} strokeWidth={2} name="P50" />
                    <Line type="monotone" dataKey="p95" stroke={CHART_COLORS.warning} strokeWidth={2} name="P95" />
                    <Line type="monotone" dataKey="p99" stroke={CHART_COLORS.danger} strokeWidth={2} name="P99" />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Throughput Analysis */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Throughput Analysis</CardTitle>
                <CardDescription>Requests per second over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={timeSeriesData}>
                    <defs>
                      <linearGradient id="colorThroughput" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.3} />
                    <XAxis dataKey="time" stroke="#6B7280" fontSize={11} />
                    <YAxis stroke="#6B7280" fontSize={11} />
                    <ChartTooltip />
                    <Area 
                      type="monotone" 
                      dataKey="throughput" 
                      stroke={CHART_COLORS.secondary}
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorThroughput)" 
                      name="Throughput (req/s)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="methods" className="space-y-6">
            {/* Method Performance Table */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Method Performance Breakdown</CardTitle>
                <CardDescription>Detailed metrics for each RPC method</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Method</th>
                        <th className="text-right py-3 px-4">Calls</th>
                        <th className="text-right py-3 px-4">Percentage</th>
                        <th className="text-right py-3 px-4">Avg Latency</th>
                        <th className="text-right py-3 px-4">Error Rate</th>
                        <th className="text-right py-3 px-4">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {methodData.map((method, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4 text-gray-400" />
                              <span className="font-medium">{method.name}</span>
                            </div>
                          </td>
                          <td className="text-right py-3 px-4">
                            {method.count.toLocaleString()}
                          </td>
                          <td className="text-right py-3 px-4">
                            <div className="flex items-center justify-end gap-2">
                              <Progress value={method.percentage} className="w-16 h-2" />
                              <span className="text-sm">{method.percentage}%</span>
                            </div>
                          </td>
                          <td className="text-right py-3 px-4">
                            <Badge variant="outline">{method.avgLatency}ms</Badge>
                          </td>
                          <td className="text-right py-3 px-4">
                            <Badge 
                              variant={method.errorRate < 0.1 ? "default" : method.errorRate < 0.5 ? "secondary" : "destructive"}
                            >
                              {method.errorRate}%
                            </Badge>
                          </td>
                          <td className="text-right py-3 px-4">
                            <div className="flex items-center justify-end gap-1">
                              {Math.random() > 0.5 ? (
                                <TrendingUp className="h-4 w-4 text-green-500" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-500" />
                              )}
                              <span className="text-sm">{Math.floor(Math.random() * 20) - 10}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="endpoints" className="space-y-6">
            {/* Endpoint Comparison */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Endpoint Request Distribution</CardTitle>
                <CardDescription>Request volume by endpoint</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <RechartsBarChart data={endpointData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.3} />
                    <XAxis dataKey="endpoint" stroke="#6B7280" fontSize={11} angle={-45} textAnchor="end" height={100} />
                    <YAxis stroke="#6B7280" fontSize={11} />
                    <ChartTooltip />
                    <Bar dataKey="requests" fill={CHART_COLORS.primary} radius={[8, 8, 0, 0]} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Endpoint Health Matrix */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Endpoint Health Matrix</CardTitle>
                <CardDescription>Success rate vs latency comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.3} />
                    <XAxis dataKey="latency" name="Latency (ms)" stroke="#6B7280" fontSize={11} />
                    <YAxis dataKey="successRate" name="Success Rate (%)" stroke="#6B7280" fontSize={11} />
                    <ChartTooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="Endpoints" data={endpointData} fill={CHART_COLORS.primary}>
                      {endpointData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={
                          entry.successRate > 99.5 ? CHART_COLORS.success :
                          entry.successRate > 98 ? CHART_COLORS.warning :
                          CHART_COLORS.danger
                        } />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="geographic" className="space-y-6">
            {/* Geographic Distribution */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Geographic Request Distribution</CardTitle>
                <CardDescription>Request origin by region</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={geographicData}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="percentage"
                          label={(entry) => entry.region}
                        >
                          {geographicData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS.series[index % CHART_COLORS.series.length]} />
                          ))}
                        </Pie>
                        <ChartTooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {geographicData.map((region, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <div className="flex items-center gap-3">
                          <div 
                            className="h-4 w-4 rounded" 
                            style={{ backgroundColor: CHART_COLORS.series[index % CHART_COLORS.series.length] }} 
                          />
                          <div>
                            <p className="font-medium">{region.region}</p>
                            <p className="text-sm text-gray-500">{region.requests.toLocaleString()} requests</p>
                          </div>
                        </div>
                        <Badge variant="outline">{region.percentage}%</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="costs" className="space-y-6">
            {/* Cost Analysis */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Cost Analysis</CardTitle>
                <CardDescription>Monthly cost trends and projections</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={costData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.3} />
                    <XAxis dataKey="date" stroke="#6B7280" fontSize={11} />
                    <YAxis yAxisId="left" stroke="#6B7280" fontSize={11} />
                    <YAxis yAxisId="right" orientation="right" stroke="#6B7280" fontSize={11} />
                    <ChartTooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="cost" fill={CHART_COLORS.primary} name="Cost ($)" />
                    <Line yAxisId="right" type="monotone" dataKey="requests" stroke={CHART_COLORS.secondary} strokeWidth={2} name="Requests" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cost Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Current Month</h3>
                    <DollarSign className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-3xl font-bold">${metrics.totalCost.toLocaleString()}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Projected: ${(metrics.totalCost * 1.15).toLocaleString()}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Cost per 1K Requests</h3>
                    <Target className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-3xl font-bold">${metrics.costPerRequest}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    15% below average
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Savings Opportunity</h3>
                    <Zap className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-3xl font-bold">$342</p>
                  <p className="text-sm text-gray-500 mt-2">
                    With endpoint optimization
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Insights Section */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              <CardTitle>AI-Powered Insights</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Performance Alert:</strong> Helius Asia endpoint showing 35ms latency, 
                  consider routing traffic to faster endpoints during peak hours.
                </AlertDescription>
              </Alert>
              <Alert>
                <TrendingUp className="h-4 w-4" />
                <AlertDescription>
                  <strong>Growth Trend:</strong> Request volume increased 12.5% this week. 
                  Consider upgrading your plan to handle future growth.
                </AlertDescription>
              </Alert>
              <Alert>
                <DollarSign className="h-4 w-4" />
                <AlertDescription>
                  <strong>Cost Optimization:</strong> Enable request caching to potentially 
                  save $342/month based on your usage patterns.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}