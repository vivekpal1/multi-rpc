"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRPCWebSocket } from "@/providers/websocket-provider";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Wifi,
  WifiOff,
  RefreshCw,
  Bell,
  TrendingUp,
  TrendingDown,
  Server,
} from "lucide-react";
import { ClientDate } from "@/components/client-date";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface HealthCheck {
  endpoint: string;
  status: "healthy" | "degraded" | "down";
  latency: number;
  lastCheck: Date;
  uptime: number;
  errors: number;
}

interface Alert {
  id: string;
  type: "error" | "warning" | "info";
  message: string;
  timestamp: Date;
  endpoint?: string;
}

export default function MonitoringPage() {
  const { getAccessToken } = usePrivy();
  const { isConnected: wsConnected, stats: wsStats, health: wsHealth } = useRPCWebSocket();
  
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [notifications, setNotifications] = useState(true);

  const fetchMonitoringData = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const [healthRes, alertsRes] = await Promise.all([
        fetch("/api/rpc/health", {
          headers: { "Authorization": `Bearer ${token}` },
        }),
        fetch("/api/rpc/alerts", {
          headers: { "Authorization": `Bearer ${token}` },
        }),
      ]);

      if (healthRes.ok) {
        const healthData = await healthRes.json();
        const checks: HealthCheck[] = healthData.endpoints.map((ep: any) => ({
          endpoint: ep.url,
          status: ep.healthy ? "healthy" : ep.latency > 500 ? "degraded" : "down",
          latency: ep.latency || 0,
          lastCheck: new Date(),
          uptime: ep.success_rate || 0,
          errors: ep.error_count || 0,
        }));
        setHealthChecks(checks);
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.alerts || []);
      }
    } catch (error) {
      console.error("Error fetching monitoring data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchMonitoringData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchMonitoringData, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchMonitoringData]);

  // Use WebSocket data if available
  useEffect(() => {
    if (wsConnected && wsHealth) {
      const checks: HealthCheck[] = wsHealth.map((ep: any) => ({
        endpoint: ep.url,
        status: ep.healthy ? "healthy" : ep.latency > 500 ? "degraded" : "down",
        latency: ep.latency || 0,
        lastCheck: new Date(),
        uptime: ep.success_rate || 0,
        errors: ep.error_count || 0,
      }));
      setHealthChecks(checks);
    }
  }, [wsConnected, wsHealth]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600 bg-green-50";
      case "degraded":
        return "text-yellow-600 bg-yellow-50";
      case "down":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4" />;
      case "degraded":
        return <AlertCircle className="h-4 w-4" />;
      case "down":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const healthyCount = healthChecks.filter(h => h.status === "healthy").length;
  const degradedCount = healthChecks.filter(h => h.status === "degraded").length;
  const downCount = healthChecks.filter(h => h.status === "down").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitoring</h1>
          <p className="text-gray-600 mt-1">Real-time health monitoring and alerts</p>
        </div>
        <div className="flex items-center gap-4">
          {/* WebSocket Status */}
          <div className="flex items-center gap-2">
            {wsConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500">Polling</span>
              </>
            )}
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-sm">Auto-refresh</Label>
          </div>
          
          <Button variant="outline" size="sm" onClick={fetchMonitoringData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">System Status</h3>
            <Activity className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold">
            {healthyCount === healthChecks.length ? "Operational" : "Degraded"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {healthyCount}/{healthChecks.length} endpoints healthy
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Healthy</h3>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600">{healthyCount}</p>
          <p className="text-xs text-gray-500 mt-1">endpoints</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Degraded</h3>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-yellow-600">{degradedCount}</p>
          <p className="text-xs text-gray-500 mt-1">endpoints</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Down</h3>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600">{downCount}</p>
          <p className="text-xs text-gray-500 mt-1">endpoints</p>
        </Card>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Active Alerts</h2>
          {alerts.slice(0, 5).map((alert) => (
            <Alert key={alert.id} variant={alert.type === "error" ? "destructive" : "default"}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{alert.message}</span>
                  {alert.endpoint && (
                    <span className="text-sm text-gray-500 ml-2">
                      ({new URL(alert.endpoint).hostname})
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-500">
                  <ClientDate date={alert.timestamp} />
                </span>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Endpoint Health Details */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Endpoint Health</h2>
          <div className="flex items-center gap-2">
            <Switch
              id="notifications"
              checked={notifications}
              onCheckedChange={setNotifications}
            />
            <Label htmlFor="notifications" className="text-sm">
              <Bell className="h-4 w-4 inline mr-1" />
              Notifications
            </Label>
          </div>
        </div>
        
        <div className="space-y-3">
          {healthChecks.map((check) => (
            <div
              key={check.endpoint}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${
                  check.status === "healthy" ? "bg-green-500" : 
                  check.status === "degraded" ? "bg-yellow-500" : "bg-red-500"
                }`} />
                <div>
                  <p className="font-medium">{new URL(check.endpoint).hostname}</p>
                  <p className="text-sm text-gray-500">
                    Last checked: <ClientDate date={check.lastCheck} />
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm font-medium">{check.latency}ms</p>
                  <p className="text-xs text-gray-500">Latency</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{check.uptime}%</p>
                  <p className="text-xs text-gray-500">Uptime</p>
                </div>
                <Badge className={getStatusColor(check.status)}>
                  {getStatusIcon(check.status)}
                  <span className="ml-1 capitalize">{check.status}</span>
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Performance Metrics */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Performance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Average Response Time</span>
              <TrendingDown className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold">
              {wsStats?.current?.average_latency || 0}ms
            </p>
            <div className="mt-2 h-2 bg-gray-200 rounded-full">
              <div 
                className="h-2 bg-green-500 rounded-full"
                style={{ width: `${Math.min((wsStats?.current?.average_latency || 0) / 10, 100)}%` }}
              />
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Request Success Rate</span>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold">
              {((1 - (wsStats?.current?.error_rate || 0) / 100) * 100).toFixed(1)}%
            </p>
            <div className="mt-2 h-2 bg-gray-200 rounded-full">
              <div 
                className="h-2 bg-green-500 rounded-full"
                style={{ width: `${(1 - (wsStats?.current?.error_rate || 0) / 100) * 100}%` }}
              />
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Active Connections</span>
              <Server className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">
              {wsStats?.current?.active_connections || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {wsStats?.current?.requests_per_second || 0} req/s
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}