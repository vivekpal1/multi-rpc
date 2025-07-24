import { NextRequest, NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

// GET current configuration
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

    // Fetch configuration from Multi-RPC backend
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8080";
    
    try {
      const response = await fetch(`${rpcUrl}/config`, {
        headers: {
          "X-API-Key": process.env.RPC_ADMIN_KEY || "",
        },
      });

      if (response.ok) {
        const config = await response.json();
        return NextResponse.json(config);
      }
    } catch (error) {
      console.log("Backend not available, returning default config");
    }

    // Return default configuration
    return NextResponse.json({
      endpoints: [
        {
          url: "https://api.mainnet-beta.solana.com",
          weight: 1,
          priority: 1,
          maxRetries: 3,
          timeout: 5000,
        },
        {
          url: "https://solana-api.projectserum.com",
          weight: 1,
          priority: 2,
          maxRetries: 3,
          timeout: 5000,
        },
      ],
      routing_strategy: "health_based",
      cache_ttl: 60,
      consensus_required: false,
    });
  } catch (error) {
    console.error("Error fetching config:", error);
    return NextResponse.json({ error: "Failed to fetch configuration" }, { status: 500 });
  }
}

// POST update configuration
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

    const config = await request.json();
    
    // Validate configuration
    if (!config.endpoints || !Array.isArray(config.endpoints)) {
      return NextResponse.json({ error: "Invalid configuration format" }, { status: 400 });
    }

    // Update configuration in Multi-RPC backend
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8080";
    
    try {
      const response = await fetch(`${rpcUrl}/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.RPC_ADMIN_KEY || "",
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        // Trigger config reload
        await fetch(`${rpcUrl}/config/reload`, {
          method: "POST",
          headers: {
            "X-API-Key": process.env.RPC_ADMIN_KEY || "",
          },
        });
        
        return NextResponse.json({ success: true, message: "Configuration updated" });
      }
    } catch (error) {
      console.log("Backend not available, configuration not persisted");
    }

    // Return success even if backend is not available
    return NextResponse.json({ 
      success: true, 
      message: "Configuration updated (local only)",
      warning: "Backend not available, changes are not persisted" 
    });
  } catch (error) {
    console.error("Error updating config:", error);
    return NextResponse.json({ error: "Failed to update configuration" }, { status: 500 });
  }
}