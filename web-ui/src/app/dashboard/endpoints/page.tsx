"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  Globe,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Server,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

export default function EndpointsPage() {
  const { getAccessToken } = usePrivy();
  const [rpcHealth, setRpcHealth] = useState<any>(null);
  const [customEndpoints, setCustomEndpoints] = useState<any[]>([]);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEndpoint, setNewEndpoint] = useState({ url: "", name: "", region: "" });
  const [isAddingEndpoint, setIsAddingEndpoint] = useState(false);
  const [endpointError, setEndpointError] = useState("");

  useEffect(() => {
    fetchRpcHealth();
    fetchCustomEndpoints();
    
    const interval = setInterval(() => {
      fetchRpcHealth();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchRpcHealth = async () => {
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
  };

  const fetchCustomEndpoints = async () => {
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
  };

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
        setShowAddModal(false);
        setNewEndpoint({ url: "", name: "", region: "" });
        fetchRpcHealth();
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
        fetchRpcHealth();
      }
    } catch (error) {
      console.error("Error removing endpoint:", error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">RPC Endpoints</h1>
          <p className="text-gray-600 mt-1">Manage and monitor your RPC endpoints</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchRpcHealth}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Endpoint
          </Button>
        </div>
      </div>

      {/* Multi-RPC Network */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Multi-RPC Network</h2>
        <p className="text-sm text-gray-600 mb-4">
          These endpoints are managed by Multi-RPC and automatically load balanced.
        </p>
        
        {isLoadingHealth ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
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
                <div className="flex items-center gap-2">
                  <Badge variant={endpoint.healthy ? "default" : "destructive"}>
                    {endpoint.healthy ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Healthy
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Unhealthy
                      </>
                    )}
                  </Badge>
                  <a
                    href={endpoint.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No endpoints available</p>
        )}

        {rpcHealth && (
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
                {new Intl.NumberFormat().format(rpcHealth.overall_health.total_requests)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Uptime</p>
              <p className="text-lg font-semibold text-green-600">99.99%</p>
            </div>
          </div>
        )}
      </Card>

      {/* Custom Endpoints */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Custom Endpoints</h2>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCustomEndpoint(endpoint.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Server className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No custom endpoints added yet</p>
            <Button variant="outline" onClick={() => setShowAddModal(true)}>
              Add Your First Endpoint
            </Button>
          </div>
        )}
      </Card>

      {/* Add Endpoint Dialog */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom RPC Endpoint</DialogTitle>
            <DialogDescription>
              Add your own Solana RPC endpoint for private or specialized use cases.
            </DialogDescription>
          </DialogHeader>
          
          {endpointError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{endpointError}</p>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Endpoint Name</Label>
              <Input
                id="name"
                value={newEndpoint.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEndpoint({ ...newEndpoint, name: e.target.value })}
                placeholder="e.g., My Private RPC"
              />
            </div>

            <div>
              <Label htmlFor="url">RPC URL</Label>
              <Input
                id="url"
                type="url"
                value={newEndpoint.url}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEndpoint({ ...newEndpoint, url: e.target.value })}
                placeholder="https://your-rpc-endpoint.com"
              />
            </div>

            <div>
              <Label htmlFor="region">Region (Optional)</Label>
              <Input
                id="region"
                value={newEndpoint.region}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEndpoint({ ...newEndpoint, region: e.target.value })}
                placeholder="e.g., US East, Europe"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={addCustomEndpoint}
              disabled={!newEndpoint.url || !newEndpoint.name || isAddingEndpoint}
            >
              {isAddingEndpoint ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing & Adding...
                </>
              ) : (
                "Add Endpoint"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}