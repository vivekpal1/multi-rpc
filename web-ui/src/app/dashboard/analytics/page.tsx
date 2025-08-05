"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Activity,
  Calendar,
  Download,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AnalyticsPage() {
  const { getAccessToken } = usePrivy();
  const [timeRange, setTimeRange] = useState("24h");
  const [stats, setStats] = useState<any>(null);
  const [methodBreakdown, setMethodBreakdown] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/rpc/analytics?timeRange=${timeRange}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setMethodBreakdown(data.methods || []);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous * 100).toFixed(1);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-gray-600 mt-1">Monitor your RPC usage and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Requests</h3>
            <Activity className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold">{formatNumber(stats?.totalRequests || 0)}</p>
          <p className="text-xs text-green-600 mt-1 flex items-center">
            <TrendingUp className="h-3 w-3 mr-1" />
            {calculatePercentageChange(stats?.totalRequests || 0, stats?.previousPeriod?.totalRequests || 0)}%
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Success Rate</h3>
            <BarChart3 className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold">{stats?.successRate || 0}%</p>
          <p className="text-xs text-gray-500 mt-1">
            {formatNumber(stats?.successfulRequests || 0)} successful
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Avg Response Time</h3>
            <Clock className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold">{stats?.avgResponseTime || 0}ms</p>
          <p className="text-xs text-gray-500 mt-1">
            P95: {stats?.p95ResponseTime || 0}ms
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Active Users</h3>
            <Calendar className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold">{stats?.activeUsers || 0}</p>
          <p className="text-xs text-gray-500 mt-1">
            In selected period
          </p>
        </Card>
      </div>

      <Tabs defaultValue="methods" className="space-y-4">
        <TabsList>
          <TabsTrigger value="methods">Method Usage</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="errors">Error Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="methods" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">RPC Method Breakdown</h2>
            <div className="space-y-4">
              {methodBreakdown.map((method) => (
                <div key={method.name} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{method.name}</span>
                    <span className="text-gray-500">
                      {formatNumber(method.count)} calls ({method.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${method.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Request Timeline</h2>
            <div className="h-64 flex items-center justify-center text-gray-500">
              <p>Timeline chart visualization would go here</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Error Analysis</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Total Errors</h3>
                  <p className="text-xl font-bold text-red-600">
                    {formatNumber(stats?.totalErrors || 0)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {((stats?.totalErrors || 0) / (stats?.totalRequests || 1) * 100).toFixed(2)}% error rate
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Most Common Error</h3>
                  <p className="text-sm font-medium">Rate Limit Exceeded</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatNumber(1234)} occurrences
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Failed Endpoints</h3>
                  <p className="text-xl font-bold">2</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Out of 10 total
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Usage by Endpoint */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Usage by Endpoint</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">api.mainnet-beta.solana.com</p>
              <p className="text-sm text-gray-500">Primary endpoint</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{formatNumber(234567)}</p>
              <p className="text-sm text-gray-500">requests</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">rpc.ankr.com/solana</p>
              <p className="text-sm text-gray-500">Secondary endpoint</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{formatNumber(123456)}</p>
              <p className="text-sm text-gray-500">requests</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}