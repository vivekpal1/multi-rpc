"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  Key,
  Plus,
  Copy,
  Trash2,
  CheckCircle,
  Loader2,
  Shield,
  Clock,
  Activity,
  Eye,
  EyeOff,
  Settings,
  AlertCircle,
  Filter,
  Search,
  Download,
  RefreshCw,
  MoreVertical,
  Edit,
  PauseCircle,
  PlayCircle,
  Code,
  Terminal,
  Globe,
  Zap,
  Lock,
  Unlock,
  Calendar,
  BarChart3,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ClientDate } from "@/components/client-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  active: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
  rateLimit: number;
  monthlyLimit?: bigint;
  usage?: {
    requests: number;
    errors: number;
    bytesIn: number;
    bytesOut: number;
  };
  permissions?: string[];
  expiresAt?: Date;
  environment?: 'production' | 'development' | 'staging';
  description?: string;
}

// Mock usage data for charts
const generateUsageData = () => {
  // Use a fixed date for initial render to avoid hydration issues
  const baseDate = typeof window !== 'undefined' ? new Date() : new Date('2024-01-01');
  return Array.from({ length: 7 }, (_, i) => ({
    date: format(subDays(baseDate, 6 - i), 'MMM dd'),
    requests: Math.floor(Math.random() * 10000) + 5000,
    errors: Math.floor(Math.random() * 100) + 10,
  }));
};

export default function EnhancedApiKeysPage() {
  const { getAccessToken } = usePrivy();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterEnvironment, setFilterEnvironment] = useState<'all' | 'production' | 'development' | 'staging'>('all');
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});
  const [usageData, setUsageData] = useState<any[]>([]);

  // Generate usage data after mount to avoid hydration issues
  useEffect(() => {
    setUsageData(generateUsageData());
  }, []);

  // Form states for creating/editing keys
  const [keyForm, setKeyForm] = useState({
    name: "",
    description: "",
    environment: "development" as 'production' | 'development' | 'staging',
    rateLimit: 100,
    monthlyLimit: "",
    permissions: [] as string[],
    expiresIn: "never" as 'never' | '30days' | '60days' | '90days' | 'custom',
    customExpiry: "",
  });

  const availablePermissions = [
    { id: 'read', label: 'Read', icon: Eye },
    { id: 'write', label: 'Write', icon: Edit },
    { id: 'delete', label: 'Delete', icon: Trash2 },
    { id: 'admin', label: 'Admin', icon: Shield },
  ];

  const fetchApiKeys = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/keys", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        // Process keys with safe defaults
        const enhancedKeys = (data.keys || []).map((key: ApiKey) => ({
          ...key,
          environment: key.environment || 'development',
          usage: key.usage || {
            requests: 0,
            errors: 0,
            bytesIn: 0,
            bytesOut: 0,
          },
          permissions: key.permissions || [],
        }));
        setApiKeys(enhancedKeys);
      }
    } catch (error) {
      console.error("Error fetching API keys:", error);
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleKeyVisibility = (keyId: string) => {
    setShowSecrets(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const createApiKey = async () => {
    if (!keyForm.name.trim()) return;

    setIsCreatingKey(true);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(keyForm),
      });

      if (response.ok) {
        const data = await response.json();
        await fetchApiKeys();
        setShowCreateModal(false);
        resetKeyForm();
      }
    } catch (error) {
      console.error("Error creating API key:", error);
    } finally {
      setIsCreatingKey(false);
    }
  };

  const deleteApiKey = async (keyId: string) => {
    setIsDeleting(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/keys/${keyId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await fetchApiKeys();
        setShowDeleteModal(false);
        setKeyToDelete(null);
      }
    } catch (error) {
      console.error("Error deleting API key:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleKeyStatus = async (keyId: string, active: boolean) => {
    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/keys/${keyId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ active }),
      });

      if (response.ok) {
        await fetchApiKeys();
      }
    } catch (error) {
      console.error("Error toggling API key status:", error);
    }
  };

  const resetKeyForm = () => {
    setKeyForm({
      name: "",
      description: "",
      environment: "development",
      rateLimit: 100,
      monthlyLimit: "",
      permissions: [],
      expiresIn: "never",
      customExpiry: "",
    });
  };

  const filteredKeys = apiKeys.filter(key => {
    const matchesSearch = key.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         key.key.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && key.active) ||
                         (filterStatus === 'inactive' && !key.active);
    const matchesEnvironment = filterEnvironment === 'all' || key.environment === filterEnvironment;
    
    return matchesSearch && matchesStatus && matchesEnvironment;
  });

  // Calculate statistics
  const stats = {
    total: apiKeys.length,
    active: apiKeys.filter(k => k.active).length,
    totalRequests: apiKeys.reduce((acc, k) => acc + (k.usage?.requests || 0), 0),
    totalErrors: apiKeys.reduce((acc, k) => acc + (k.usage?.errors || 0), 0),
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
            <p className="text-gray-500 mt-1">
              Manage your API keys and monitor their usage
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={fetchApiKeys}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <Badge variant="secondary">{stats.total}</Badge>
              </div>
              <p className="text-sm text-gray-500">Total Keys</p>
              <p className="text-2xl font-bold">{stats.active} Active</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  +12%
                </Badge>
              </div>
              <p className="text-sm text-gray-500">Total Requests</p>
              <p className="text-2xl font-bold">{stats.totalRequests.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <Badge variant="secondary">Avg</Badge>
              </div>
              <p className="text-sm text-gray-500">Rate Limit</p>
              <p className="text-2xl font-bold">100 req/s</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <Badge variant="secondary" className="bg-red-100 text-red-700">
                  {((stats.totalErrors / stats.totalRequests) * 100).toFixed(2)}%
                </Badge>
              </div>
              <p className="text-sm text-gray-500">Error Rate</p>
              <p className="text-2xl font-bold">{stats.totalErrors.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="keys" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full lg:w-auto">
            <TabsTrigger value="keys">API Keys</TabsTrigger>
            <TabsTrigger value="usage">Usage Analytics</TabsTrigger>
            <TabsTrigger value="docs">Documentation</TabsTrigger>
          </TabsList>

          <TabsContent value="keys" className="space-y-4">
            {/* Filters and Search */}
            <Card className="border-0 shadow-lg">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search keys by name or value..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterEnvironment} onValueChange={(v: any) => setFilterEnvironment(v)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Environments</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="development">Development</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* API Keys Table */}
            <Card className="border-0 shadow-lg">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name & Environment</TableHead>
                      <TableHead>API Key</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredKeys.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          {searchQuery || filterStatus !== 'all' || filterEnvironment !== 'all' 
                            ? "No API keys found matching your filters" 
                            : "No API keys yet. Create your first key to get started."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredKeys.map((apiKey) => (
                        <TableRow key={apiKey.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                apiKey.environment === 'production' ? "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400" :
                                apiKey.environment === 'staging' ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400" :
                                "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                              }`}>
                                <Key className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-medium">{apiKey.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {apiKey.environment}
                                  </Badge>
                                  {apiKey.permissions?.map(perm => (
                                    <Badge key={perm} variant="secondary" className="text-xs">
                                      {perm}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                {showSecrets[apiKey.id] 
                                  ? apiKey.key 
                                  : `${apiKey.key.substring(0, 8)}...${apiKey.key.substring(apiKey.key.length - 4)}`}
                              </code>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => toggleKeyVisibility(apiKey.id)}
                                  >
                                    {showSecrets[apiKey.id] ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {showSecrets[apiKey.id] ? 'Hide' : 'Show'} key
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => copyToClipboard(apiKey.key)}
                                  >
                                    {copiedKey === apiKey.key ? (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy to clipboard</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={apiKey.active}
                                onCheckedChange={(checked) => toggleKeyStatus(apiKey.id, checked)}
                              />
                              <Badge variant={apiKey.active ? "default" : "secondary"}>
                                {apiKey.active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            {apiKey.usage && (
                              <div className="space-y-1">
                                <p className="text-sm font-medium">
                                  {apiKey.usage.requests.toLocaleString()} requests
                                </p>
                                <Progress 
                                  value={(apiKey.usage.requests / 100000) * 100} 
                                  className="h-1.5"
                                />
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">
                              <ClientDate date={apiKey.createdAt} />
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">
                              <ClientDate date={apiKey.lastUsedAt} fallback="Never" />
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => {
                                  setSelectedKey(apiKey);
                                  setShowDetailsModal(true);
                                }}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setSelectedKey(apiKey);
                                  setKeyForm({
                                    name: apiKey.name,
                                    description: apiKey.description || "",
                                    environment: apiKey.environment || "development",
                                    rateLimit: apiKey.rateLimit,
                                    monthlyLimit: apiKey.monthlyLimit?.toString() || "",
                                    permissions: apiKey.permissions || [],
                                    expiresIn: "never",
                                    customExpiry: "",
                                  });
                                  setShowEditModal(true);
                                }}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => copyToClipboard(apiKey.key)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copy Key
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-red-600"
                                  onClick={() => {
                                    setKeyToDelete(apiKey.id);
                                    setShowDeleteModal(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-4">
            {/* Usage Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Request Volume</CardTitle>
                  <CardDescription>API requests over the last 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={usageData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                      <YAxis stroke="#6B7280" fontSize={12} />
                      <ChartTooltip />
                      <Line 
                        type="monotone" 
                        dataKey="requests" 
                        stroke="#3B82F6" 
                        strokeWidth={2}
                        dot={{ fill: '#3B82F6', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Error Rate</CardTitle>
                  <CardDescription>Errors over the last 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={usageData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                      <YAxis stroke="#6B7280" fontSize={12} />
                      <ChartTooltip />
                      <Bar dataKey="errors" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Top Performing Keys */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Top Performing Keys</CardTitle>
                <CardDescription>Keys with highest usage this month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {apiKeys.slice(0, 5).map((key, index) => (
                    <div key={key.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-bold text-gray-400">#{index + 1}</div>
                        <div>
                          <p className="font-medium">{key.name}</p>
                          <p className="text-sm text-gray-500">{key.environment}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{key.usage?.requests.toLocaleString() || 0}</p>
                        <p className="text-sm text-gray-500">requests</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docs" className="space-y-4">
            {/* Documentation */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Quick Start Guide</CardTitle>
                <CardDescription>Learn how to use your API keys</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Using with cURL
                  </h3>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">
{`curl -X POST https://api.multirpc.com/v1/rpc \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"getLatestBlockhash"}'`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    JavaScript/TypeScript
                  </h3>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm">
{`const response = await fetch('https://api.multirpc.com/v1/rpc', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getLatestBlockhash'
  })
});

const data = await response.json();`}
                    </pre>
                  </div>
                </div>

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Security Note:</strong> Never expose your API keys in client-side code. 
                    Always use them in server-side applications or backend services.
                  </AlertDescription>
                </Alert>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3">Rate Limits</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <span>Development</span>
                      <Badge>100 req/s</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <span>Staging</span>
                      <Badge>500 req/s</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <span>Production</span>
                      <Badge>1000 req/s</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create API Key Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>
                Generate a new API key for accessing the Multi-RPC service
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Key Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Production App"
                    value={keyForm.name}
                    onChange={(e) => setKeyForm({ ...keyForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="environment">Environment</Label>
                  <Select 
                    value={keyForm.environment} 
                    onValueChange={(v: any) => setKeyForm({ ...keyForm, environment: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="staging">Staging</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="What will this key be used for?"
                  value={keyForm.description}
                  onChange={(e) => setKeyForm({ ...keyForm, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rateLimit">Rate Limit (req/s)</Label>
                  <Input
                    id="rateLimit"
                    type="number"
                    value={keyForm.rateLimit}
                    onChange={(e) => setKeyForm({ ...keyForm, rateLimit: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthlyLimit">Monthly Limit (Optional)</Label>
                  <Input
                    id="monthlyLimit"
                    type="number"
                    placeholder="Leave empty for unlimited"
                    value={keyForm.monthlyLimit}
                    onChange={(e) => setKeyForm({ ...keyForm, monthlyLimit: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="grid grid-cols-2 gap-2">
                  {availablePermissions.map((perm) => (
                    <div key={perm.id} className="flex items-center space-x-2">
                      <Switch
                        checked={keyForm.permissions.includes(perm.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setKeyForm({ ...keyForm, permissions: [...keyForm.permissions, perm.id] });
                          } else {
                            setKeyForm({ ...keyForm, permissions: keyForm.permissions.filter(p => p !== perm.id) });
                          }
                        }}
                      />
                      <Label className="flex items-center gap-2 cursor-pointer">
                        <perm.icon className="h-4 w-4" />
                        {perm.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiresIn">Expiration</Label>
                <Select 
                  value={keyForm.expiresIn} 
                  onValueChange={(v: any) => setKeyForm({ ...keyForm, expiresIn: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="30days">30 Days</SelectItem>
                    <SelectItem value="60days">60 Days</SelectItem>
                    <SelectItem value="90days">90 Days</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button onClick={createApiKey} disabled={isCreatingKey || !keyForm.name}>
                {isCreatingKey && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create API Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete API Key</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this API key? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => keyToDelete && deleteApiKey(keyToDelete)}
                disabled={isDeleting}
              >
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}