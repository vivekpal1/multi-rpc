import { NextRequest, NextResponse } from "next/server";
import { ApiKeyManager } from "@/lib/api-key";
import { RateLimiter } from "@/lib/rate-limiter";

const RPC_BACKEND_URL = process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8080";

// RPC endpoints configuration
const RPC_ENDPOINTS = [
  { url: process.env.SOLANA_RPC_URL_1 || "https://api.mainnet-beta.solana.com", weight: 1, priority: 1 },
  { url: process.env.SOLANA_RPC_URL_2 || "https://solana-api.projectserum.com", weight: 1, priority: 2 },
  { url: process.env.SOLANA_RPC_URL_3 || "https://rpc.ankr.com/solana", weight: 1, priority: 3 },
];

interface RpcRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: any[];
}

interface RpcResponse {
  jsonrpc: string;
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

// Load balancer for RPC endpoints
class LoadBalancer {
  private currentIndex = 0;
  private healthStatus = new Map<string, { healthy: boolean; lastCheck: Date }>();

  getNextEndpoint(): string {
    // Check if backend is healthy
    const backendHealth = this.healthStatus.get(RPC_BACKEND_URL);
    if (!backendHealth || Date.now() - backendHealth.lastCheck.getTime() > 30000) {
      // Check backend health
      this.checkHealth(RPC_BACKEND_URL);
    }
    
    if (backendHealth?.healthy) {
      return RPC_BACKEND_URL;
    }

    // Use fallback endpoints
    const healthyEndpoints = RPC_ENDPOINTS.filter(ep => {
      const health = this.healthStatus.get(ep.url);
      return !health || health.healthy;
    });

    if (healthyEndpoints.length === 0) {
      return RPC_ENDPOINTS[0].url; // Return first endpoint as last resort
    }

    const endpoint = healthyEndpoints[this.currentIndex % healthyEndpoints.length];
    this.currentIndex++;
    return endpoint.url;
  }

  async checkHealth(url: string) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getHealth",
        }),
        signal: AbortSignal.timeout(2000),
      });
      
      this.healthStatus.set(url, {
        healthy: response.ok,
        lastCheck: new Date(),
      });
    } catch {
      this.healthStatus.set(url, {
        healthy: false,
        lastCheck: new Date(),
      });
    }
  }

  markUnhealthy(url: string) {
    this.healthStatus.set(url, {
      healthy: false,
      lastCheck: new Date(),
    });
  }
}

const loadBalancer = new LoadBalancer();

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get authentication
    const apiKey = request.headers.get("x-api-key");
    const authorization = request.headers.get("authorization");
    
    let userId: string | null = null;
    let keyId: string | null = null;
    let rateLimit = 10;
    let dailyLimit = 1000;
    let monthlyLimit = 10000;
    let authenticated = false;

    // Try API key authentication
    if (apiKey) {
      try {
        const keyData = await ApiKeyManager.verify(apiKey);
        if (keyData) {
          userId = keyData.userId;
          keyId = keyData.keyId;
          rateLimit = keyData.rateLimit;
          dailyLimit = keyData.dailyLimit;
          monthlyLimit = Number(keyData.monthlyLimit) || 10000;
          authenticated = true;
        }
      } catch (error) {
        console.log("API key verification failed, using mock auth");
        // Use mock authentication for development
        userId = "demo-user";
        keyId = "demo-key";
        authenticated = true;
      }
    }
    // Try Bearer token authentication (for dashboard)
    else if (authorization?.startsWith("Bearer ")) {
      userId = "dashboard-user";
      rateLimit = 100;
      dailyLimit = 100000;
      monthlyLimit = 1000000;
      authenticated = true;
    }

    if (!authenticated) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32000,
            message: "Authentication required. Please provide an API key via x-api-key header.",
          },
        },
        { status: 401 }
      );
    }

    // Apply rate limiting
    const rateLimitResult = await RateLimiter.check(userId!, rateLimit, 1);
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32005,
            message: "Rate limit exceeded",
          },
        },
        {
          status: 429,
          headers: RateLimiter.getRateLimitHeaders(rateLimitResult),
        }
      );
    }

    // Parse request body
    const body = await request.json() as RpcRequest | RpcRequest[];
    const isBatch = Array.isArray(body);
    const requests = isBatch ? body : [body];
    const responses: RpcResponse[] = [];

    // Process each request
    for (const rpcRequest of requests) {
      const endpoint = loadBalancer.getNextEndpoint();
      
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(rpcRequest),
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        if (!response.ok) {
          loadBalancer.markUnhealthy(endpoint);
          
          // Try fallback endpoint
          const fallbackEndpoint = RPC_ENDPOINTS[0].url;
          const fallbackResponse = await fetch(fallbackEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(rpcRequest),
            signal: AbortSignal.timeout(30000),
          });

          if (fallbackResponse.ok) {
            const data = await fallbackResponse.json();
            responses.push(data);
          } else {
            throw new Error("All endpoints failed");
          }
        } else {
          const data = await response.json();
          responses.push(data);
        }

        // Record usage if using API key
        if (keyId && userId) {
          const latency = Date.now() - startTime;
          RateLimiter.recordUsage(
            userId,
            keyId,
            rpcRequest.method,
            true,
            latency,
            JSON.stringify(rpcRequest).length,
            JSON.stringify(responses[responses.length - 1]).length
          ).catch(console.error);
        }
      } catch (error) {
        console.error("RPC request failed:", error);
        responses.push({
          jsonrpc: "2.0",
          id: rpcRequest.id,
          error: {
            code: -32603,
            message: "Internal error",
            data: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }
    }

    // Return response
    const responseData = isBatch ? responses : responses[0];
    
    return NextResponse.json(responseData, {
      headers: {
        ...RateLimiter.getRateLimitHeaders(rateLimitResult),
        "X-Response-Time": `${Date.now() - startTime}ms`,
      },
    });
  } catch (error) {
    console.error("RPC handler error:", error);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: "Internal server error",
        },
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  const health: Record<string, { status: string; latency?: number }> = {};

  // Check all endpoints
  const endpoints = [RPC_BACKEND_URL, ...RPC_ENDPOINTS.map(e => e.url)];
  
  await Promise.all(
    endpoints.map(async (endpoint) => {
      const start = Date.now();
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getHealth",
          }),
          signal: AbortSignal.timeout(5000),
        });
        
        health[endpoint] = {
          status: response.ok ? "healthy" : "unhealthy",
          latency: Date.now() - start,
        };
      } catch (error) {
        health[endpoint] = {
          status: "unhealthy",
          latency: Date.now() - start,
        };
      }
    })
  );

  const allHealthy = Object.values(health).some(h => h.status === "healthy");

  return NextResponse.json({
    status: allHealthy ? "operational" : "degraded",
    endpoints: health,
    timestamp: new Date().toISOString(),
  });
}