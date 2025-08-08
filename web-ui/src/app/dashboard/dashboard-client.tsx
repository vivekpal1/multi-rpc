"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useRPCWebSocket } from "@/providers/websocket-provider";
import {
  BarChart3,
  Key,
  CreditCard,
  User,
  LogOut,
  Copy,
  Plus,
  Trash2,
  Activity,
  Wallet,
  Loader2,
  CheckCircle,
  Server,
  Globe,
  Zap,
  AlertCircle,
  TrendingUp,
  Clock,
  RefreshCw,
  ExternalLink,
  Settings,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Modal from "@/components/modal";

interface DashboardClientProps {
  user: {
    id: string;
    email: string;
    name: string | null;
    walletAddress?: string | null;
  };
  apiKeys: Array<{
    id: string;
    name: string;
    key: string;
    active: boolean;
    createdAt: Date;
    lastUsedAt: Date | null;
  }>;
  subscription: any;
  usage: {
    requests: number;
    successCount: number;
    errorCount: number;
    bytesIn: number;
    bytesOut: number;
  };
  limits: {
    requests: number;
    rateLimit: number;
  };
}

export default function DashboardClient({
  user,
  apiKeys: initialApiKeys,
  subscription,
  usage,
  limits,
}: DashboardClientProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const { getAccessToken } = usePrivy();
  const [activeTab, setActiveTab] = useState("overview");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState(initialApiKeys);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [profileName, setProfileName] = useState(user.name || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // WebSocket integration
  const { isConnected: wsConnected, stats: wsStats, health: wsHealth, lastUpdate } = useRPCWebSocket();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  // RPC Health & Stats
  const [rpcHealth, setRpcHealth] = useState<any>(null);
  const [rpcStats, setRpcStats] = useState<any>(null);
  const [customEndpoints, setCustomEndpoints] = useState<any[]>([]);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);
  const [showAddEndpointModal, setShowAddEndpointModal] = useState(false);
  const [newEndpoint, setNewEndpoint] = useState({ url: "", name: "", region: "" });
  const [isAddingEndpoint, setIsAddingEndpoint] = useState(false);
  const [endpointError, setEndpointError] = useState("");

  const fetchRpcHealth = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/rpc/health", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setRpcHealth(data);
      }
    } catch (error) {
      console.error("Error fetching RPC health:", error);
    } finally {
      setIsLoadingHealth(false);
    }
  }, [getAccessToken]);

  const fetchRpcStats = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/rpc/stats", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setRpcStats(data);
      }
    } catch (error) {
      console.error("Error fetching RPC stats:", error);
    }
  }, [getAccessToken]);

  const fetchCustomEndpoints = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/rpc/endpoints", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setCustomEndpoints(data.endpoints || []);
      }
    } catch (error) {
      console.error("Error fetching custom endpoints:", error);
    }
  }, [getAccessToken]);

  // Fetch RPC health data
  useEffect(() => {
    fetchRpcHealth();
    fetchRpcStats();
    fetchCustomEndpoints();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchRpcHealth();
      fetchRpcStats();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchRpcHealth, fetchRpcStats, fetchCustomEndpoints]);

  const addCustomEndpoint = async () => {
    if (!newEndpoint.url || !newEndpoint.name) {
      setEndpointError("URL and name are required");
      return;
    }

    setIsAddingEndpoint(true);
    setEndpointError("");

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/rpc/endpoints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(newEndpoint),
      });

      const data = await response.json();
      
      if (response.ok) {
        setCustomEndpoints([...customEndpoints, data]);
        setShowAddEndpointModal(false);
        setNewEndpoint({ url: "", name: "", region: "" });
        fetchRpcHealth(); // Refresh health data
      } else {
        setEndpointError(data.error || "Failed to add endpoint");
      }
    } catch (error) {
      console.error("Error adding endpoint:", error);
      setEndpointError("Failed to add endpoint. Please try again.");
    } finally {
      setIsAddingEndpoint(false);
    }
  };

  const removeCustomEndpoint = async (endpointId: string) => {
    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/rpc/endpoints?id=${endpointId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setCustomEndpoints(customEndpoints.filter(ep => ep.id !== endpointId));
        fetchRpcHealth(); // Refresh health data
      }
    } catch (error) {
      console.error("Error removing endpoint:", error);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const successRate = usage.requests > 0
    ? ((usage.successCount / usage.requests) * 100).toFixed(1)
    : "0";

  const usagePercentage = limits.requests > 0
    ? Math.min((usage.requests / limits.requests) * 100, 100)
    : 0;

  const createApiKey = async () => {
    if (!keyName.trim()) return;

    setIsCreatingKey(true);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ name: keyName }),
      });

      if (response.ok) {
        const newKey = await response.json();
        setApiKeys([newKey, ...apiKeys]);
        setKeyName("");
        setShowCreateModal(false);
        setCopiedKey(newKey.key);
        setTimeout(() => setCopiedKey(null), 5000);
      }
    } catch (error) {
      console.error("Error creating API key:", error);
    } finally {
      setIsCreatingKey(false);
    }
  };

  const deleteApiKey = async () => {
    if (!keyToDelete) return;

    setIsDeleting(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/keys?id=${keyToDelete}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setApiKeys(apiKeys.filter(key => key.id !== keyToDelete));
        setShowDeleteModal(false);
        setKeyToDelete(null);
      }
    } catch (error) {
      console.error("Error deleting API key:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ name: profileName }),
      });

      if (response.ok) {
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      }
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpgrade = (plan: string) => {
    console.log("Upgrade to plan:", plan);
    alert("Stripe integration coming soon!");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Multi-RPC
          </h1>
          <div className="flex items-center gap-6">
            {user.walletAddress && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Wallet className="w-4 h-4" />
                <span className="font-mono">
                  {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="btn-ghost text-sm"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: "overview", label: "Overview", icon: BarChart3 },
              { id: "endpoints", label: "RPC Endpoints", icon: Server },
              { id: "keys", label: "API Keys", icon: Key },
              { id: "billing", label: "Billing", icon: CreditCard },
              { id: "profile", label: "Profile", icon: User },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === tab.id
                      ? "border-gray-900 text-gray-900"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Real-time Stats */}
            {rpcStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="card p-6 animate-fadeIn">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-500">Live RPS</h3>
                    <Activity className="w-4 h-4 text-green-500" />
                  </div>
                  <p className="text-3xl font-bold">{rpcStats.current.requests_per_second}</p>
                  <p className="text-xs text-gray-500 mt-1">requests/second</p>
                </div>

                <div className="card p-6 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-500">Active Connections</h3>
                    <Server className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-3xl font-bold">{rpcStats.current.active_connections}</p>
                  <p className="text-xs text-gray-500 mt-1">concurrent</p>
                </div>

                <div className="card p-6 animate-fadeIn" style={{ animationDelay: '0.2s' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-500">Avg Latency</h3>
                    <Clock className="w-4 h-4 text-orange-500" />
                  </div>
                  <p className="text-3xl font-bold">{rpcStats.current.average_latency}ms</p>
                  <p className="text-xs text-gray-500 mt-1">last 5 min</p>
                </div>

                <div className="card p-6 animate-fadeIn" style={{ animationDelay: '0.3s' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-500">Error Rate</h3>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  </div>
                  <p className="text-3xl font-bold">{rpcStats.current.error_rate.toFixed(2)}%</p>
                  <p className="text-xs text-gray-500 mt-1">last hour</p>
                </div>
              </div>
            )}

            {/* RPC Health Overview */}
            {rpcHealth && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">RPC Endpoint Health</h2>
                  <button
                    onClick={fetchRpcHealth}
                    className="btn-ghost text-sm"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rpcHealth.endpoints.map((endpoint: any, index: number) => (
                    <div
                      key={endpoint.url}
                      className={`border rounded-lg p-4 ${
                        endpoint.healthy 
                          ? "border-green-200 bg-green-50" 
                          : "border-red-200 bg-red-50"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-medium text-sm truncate">
                            {new URL(endpoint.url).hostname}
                          </h3>
                          <p className="text-xs text-gray-500">{endpoint.region}</p>
                        </div>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ml-2 ${
                          endpoint.healthy ? "bg-green-500" : "bg-red-500"
                        }`} />
                      </div>
                      
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Latency:</span>
                          <span className="font-medium">
                            {endpoint.healthy ? `${endpoint.latency}ms` : "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Success:</span>
                          <span className="font-medium">
                            {endpoint.healthy ? `${endpoint.success_rate}%` : "0%"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Requests:</span>
                          <span className="font-medium">
                            {formatNumber(endpoint.requests_total)}
                          </span>
                        </div>
                      </div>
                      
                      {endpoint.error && (
                        <p className="text-xs text-red-600 mt-2">{endpoint.error}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-500">Healthy Endpoints</p>
                    <p className="text-lg font-semibold text-green-600">
                      {rpcHealth.overall_health.healthy_endpoints}/{rpcHealth.overall_health.total_endpoints}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg Latency</p>
                    <p className="text-lg font-semibold">
                      {rpcHealth.overall_health.average_latency}ms
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Success Rate</p>
                    <p className="text-lg font-semibold">
                      {rpcHealth.overall_health.success_rate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Requests</p>
                    <p className="text-lg font-semibold">
                      {formatNumber(rpcHealth.overall_health.total_requests)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Uptime</p>
                    <p className="text-lg font-semibold text-green-600">99.99%</p>
                  </div>
                </div>
              </div>
            )}

            {/* Method Breakdown */}
            {rpcStats && rpcStats.methods_breakdown && (
              <div className="card p-6">
                <h2 className="text-lg font-semibold mb-4">RPC Method Usage</h2>
                <div className="space-y-3">
                  {rpcStats.methods_breakdown.map((method: any) => (
                    <div key={method.method} className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium">{method.method}</span>
                          <span className="text-sm text-gray-500">
                            {formatNumber(method.count)} ({method.percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gray-900 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${method.percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Start */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Start</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-2">1. Use your API key with Multi-RPC</h3>
                  <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-x-auto">
                    {`curl -X POST ${process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8080"} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'`}
                  </pre>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">2. JavaScript/TypeScript</h3>
                  <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-x-auto">
                    {`const connection = new Connection(
  "${process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8080"}",
  {
    httpHeaders: {
      "X-API-Key": "YOUR_API_KEY"
    }
  }
);`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "endpoints" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">RPC Endpoints</h2>
              <button 
                className="btn-primary"
                onClick={() => setShowAddEndpointModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Endpoint
              </button>
            </div>

            {/* Default Endpoints */}
            <div className="card p-6">
              <h3 className="font-medium mb-4">Multi-RPC Network</h3>
              <p className="text-sm text-gray-600 mb-4">
                These endpoints are managed by Multi-RPC and automatically load balanced.
              </p>
              
              {isLoadingHealth ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : rpcHealth ? (
                <div className="space-y-3">
                  {rpcHealth.endpoints.map((endpoint: any) => (
                    <div
                      key={endpoint.url}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${
                          endpoint.healthy ? "bg-green-500" : "bg-red-500"
                        }`} />
                        <div>
                          <p className="font-medium">{new URL(endpoint.url).hostname}</p>
                          <p className="text-sm text-gray-500">
                            {endpoint.region} • {endpoint.latency}ms latency • {endpoint.success_rate}% success
                          </p>
                        </div>
                      </div>
                      <a
                        href={endpoint.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No endpoints available</p>
              )}
            </div>

            {/* Custom Endpoints */}
            <div className="card p-6">
              <h3 className="font-medium mb-4">Custom Endpoints</h3>
              <p className="text-sm text-gray-600 mb-4">
                Add your own RPC endpoints for private or specialized use cases.
              </p>
              
              {customEndpoints.length > 0 ? (
                <div className="space-y-3">
                  {customEndpoints.map((endpoint) => (
                    <div
                      key={endpoint.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${
                          endpoint.healthy ? "bg-green-500" : "bg-red-500"
                        }`} />
                        <div>
                          <p className="font-medium">{endpoint.name}</p>
                          <p className="text-sm text-gray-500">
                            {endpoint.region || "Custom"} • {endpoint.url}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeCustomEndpoint(endpoint.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Server className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">No custom endpoints added yet</p>
                  <button
                    onClick={() => setShowAddEndpointModal(true)}
                    className="btn-secondary"
                  >
                    Add Your First Endpoint
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "keys" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">API Keys</h2>
              <button 
                className="btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Key
              </button>
            </div>

            {apiKeys.length === 0 ? (
              <div className="card p-12 text-center">
                <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No API keys yet</h3>
                <p className="text-gray-500 mb-4">Create your first API key to start using Multi-RPC</p>
                <button 
                  className="btn-primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create API Key
                </button>
              </div>
            ) : (
              <div className="card overflow-hidden animate-fadeIn">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Key
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Used
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {apiKeys.map((key) => (
                      <tr key={key.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {key.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center gap-2">
                            <code className="font-mono">{key.key.substring(0, 20)}...</code>
                            <button
                              onClick={() => copyToClipboard(key.key)}
                              className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              {copiedKey === key.key ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`badge ${
                              key.active
                                ? "badge-secondary"
                                : "badge-destructive"
                            }`}
                          >
                            {key.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {key.lastUsedAt
                            ? formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })
                            : "Never"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button 
                            className="text-red-600 hover:text-red-700 transition-colors"
                            onClick={() => {
                              setKeyToDelete(key.id);
                              setShowDeleteModal(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "billing" && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Billing & Subscription</h2>
            
            <div className="card p-6 animate-fadeIn">
              <h3 className="text-lg font-medium mb-4">Current Plan: {subscription?.plan || "FREE"}</h3>
              <p className="text-gray-600 mb-6">
                {subscription?.status === "active" 
                  ? "Your subscription is active."
                  : "Start with our free tier or upgrade for more features."}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {["STARTER", "PRO", "ENTERPRISE"].map((plan) => (
                  <div
                    key={plan}
                    className="card p-6 hover:shadow-md transition-all cursor-pointer hover:border-gray-900"
                  >
                    <h4 className="font-semibold text-lg">{plan}</h4>
                    <p className="text-2xl font-bold my-2">
                      ${plan === "STARTER" ? "29" : plan === "PRO" ? "99" : "299"}/mo
                    </p>
                    <ul className="text-sm text-gray-600 space-y-2 mb-4">
                      <li>
                        {plan === "STARTER" ? "1M" : plan === "PRO" ? "10M" : "Unlimited"} requests/mo
                      </li>
                      <li>
                        {plan === "STARTER" ? "50" : plan === "PRO" ? "100" : "1000"} req/s
                      </li>
                      <li>Email support</li>
                      {plan !== "STARTER" && <li>Priority support</li>}
                      {plan === "ENTERPRISE" && <li>Custom SLA</li>}
                    </ul>
                    <button 
                      className={`w-full ${subscription?.plan === plan ? "btn-secondary" : "btn-primary"}`}
                      onClick={() => handleUpgrade(plan)}
                      disabled={subscription?.plan === plan}
                    >
                      {subscription?.plan === plan ? "Current Plan" : "Upgrade"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Profile Settings</h2>
            
            <div className="card p-6 animate-fadeIn">
              <form className="space-y-4" onSubmit={updateProfile}>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="input bg-gray-100 cursor-not-allowed"
                  />
                </div>

                {user.walletAddress && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Wallet Address
                    </label>
                    <input
                      type="text"
                      value={user.walletAddress}
                      disabled
                      className="input bg-gray-100 cursor-not-allowed font-mono text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">
                    User ID
                  </label>
                  <input
                    type="text"
                    value={user.id}
                    disabled
                    className="input bg-gray-100 cursor-not-allowed font-mono text-sm"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Update Profile"
                    )}
                  </button>
                  {showSuccessMessage && (
                    <span className="text-green-600 text-sm flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Profile updated successfully
                    </span>
                  )}
                </div>
              </form>
            </div>

            <div className="card p-6 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
              <h3 className="text-lg font-medium mb-4 text-red-600">Danger Zone</h3>
              <p className="text-sm text-gray-600 mb-4">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <button className="btn-primary bg-red-600 hover:bg-red-700">
                Delete Account
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create API Key Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setKeyName("");
        }}
        title="Create New API Key"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Key Name
            </label>
            <input
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="e.g., Production Key"
              className="input"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Give your API key a descriptive name
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={createApiKey}
              disabled={!keyName.trim() || isCreatingKey}
              className="btn-primary flex-1"
            >
              {isCreatingKey ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Key"
              )}
            </button>
            <button
              onClick={() => {
                setShowCreateModal(false);
                setKeyName("");
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setKeyToDelete(null);
        }}
        title="Delete API Key"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete this API key? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={deleteApiKey}
              disabled={isDeleting}
              className="btn-primary bg-red-600 hover:bg-red-700 flex-1"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Key"
              )}
            </button>
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setKeyToDelete(null);
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Custom Endpoint Modal */}
      <Modal
        isOpen={showAddEndpointModal}
        onClose={() => {
          setShowAddEndpointModal(false);
          setNewEndpoint({ url: "", name: "", region: "" });
          setEndpointError("");
        }}
        title="Add Custom RPC Endpoint"
      >
        <div className="space-y-4">
          {endpointError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{endpointError}</p>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Endpoint Name
            </label>
            <input
              type="text"
              value={newEndpoint.name}
              onChange={(e) => setNewEndpoint({ ...newEndpoint, name: e.target.value })}
              placeholder="e.g., My Private RPC"
              className="input"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              RPC URL
            </label>
            <input
              type="url"
              value={newEndpoint.url}
              onChange={(e) => setNewEndpoint({ ...newEndpoint, url: e.target.value })}
              placeholder="https://your-rpc-endpoint.com"
              className="input"
            />
            <p className="text-xs text-gray-500 mt-1">
              Must be a valid Solana RPC endpoint
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Region (Optional)
            </label>
            <input
              type="text"
              value={newEndpoint.region}
              onChange={(e) => setNewEndpoint({ ...newEndpoint, region: e.target.value })}
              placeholder="e.g., US East, Europe"
              className="input"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={addCustomEndpoint}
              disabled={!newEndpoint.url || !newEndpoint.name || isAddingEndpoint}
              className="btn-primary flex-1"
            >
              {isAddingEndpoint ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing & Adding...
                </>
              ) : (
                "Add Endpoint"
              )}
            </button>
            <button
              onClick={() => {
                setShowAddEndpointModal(false);
                setNewEndpoint({ url: "", name: "", region: "" });
                setEndpointError("");
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}