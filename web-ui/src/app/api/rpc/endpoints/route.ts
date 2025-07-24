import { NextRequest, NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

// Mock storage for custom endpoints (in production, use database)
const customEndpoints = new Map<string, any[]>();

// GET custom endpoints for a user
export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authorization.replace("Bearer ", "");
    const claims = await privy.verifyAuthToken(token);
    if (!claims) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userEndpoints = customEndpoints.get(claims.userId) || [];
    return NextResponse.json({ endpoints: userEndpoints });
  } catch (error) {
    console.error("Error fetching endpoints:", error);
    return NextResponse.json({ error: "Failed to fetch endpoints" }, { status: 500 });
  }
}

// POST add a new custom endpoint
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authorization.replace("Bearer ", "");
    const claims = await privy.verifyAuthToken(token);
    if (!claims) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { url, name, region } = await request.json();
    
    if (!url || !name) {
      return NextResponse.json({ error: "URL and name are required" }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Test the endpoint
    const testResult = await testEndpoint(url);
    
    const endpoint = {
      id: crypto.randomUUID(),
      url,
      name,
      region: region || "Custom",
      healthy: testResult.healthy,
      latency: testResult.latency,
      addedAt: new Date(),
      custom: true,
    };

    // Store the endpoint
    const userEndpoints = customEndpoints.get(claims.userId) || [];
    userEndpoints.push(endpoint);
    customEndpoints.set(claims.userId, userEndpoints);

    // In production, you would also register this with the Multi-RPC backend
    // await registerEndpointWithBackend(url, claims.userId);

    return NextResponse.json(endpoint);
  } catch (error) {
    console.error("Error adding endpoint:", error);
    return NextResponse.json({ error: "Failed to add endpoint" }, { status: 500 });
  }
}

// DELETE remove a custom endpoint
export async function DELETE(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authorization.replace("Bearer ", "");
    const claims = await privy.verifyAuthToken(token);
    if (!claims) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const endpointId = searchParams.get("id");
    
    if (!endpointId) {
      return NextResponse.json({ error: "Endpoint ID is required" }, { status: 400 });
    }

    const userEndpoints = customEndpoints.get(claims.userId) || [];
    const filtered = userEndpoints.filter(ep => ep.id !== endpointId);
    customEndpoints.set(claims.userId, filtered);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting endpoint:", error);
    return NextResponse.json({ error: "Failed to delete endpoint" }, { status: 500 });
  }
}

// Test an RPC endpoint
async function testEndpoint(url: string): Promise<{ healthy: boolean; latency: number }> {
  try {
    const start = Date.now();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getHealth",
      }),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const latency = Date.now() - start;
    const healthy = response.ok;

    return { healthy, latency };
  } catch (error) {
    return { healthy: false, latency: 0 };
  }
}