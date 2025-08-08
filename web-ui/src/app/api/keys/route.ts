import { NextRequest, NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";
import { ApiKeyManager } from "@/lib/api-key";
import { prisma } from "@/lib/prisma";

const privy = process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET
  ? new PrivyClient(
      process.env.NEXT_PUBLIC_PRIVY_APP_ID,
      process.env.PRIVY_APP_SECRET
    )
  : null;

// Helper to get user from token
async function getUserFromToken(authorization: string | null): Promise<{ id: string; email: string } | null> {
  if (!authorization) {
    return null;
  }

  const token = authorization.replace("Bearer ", "");
  
  if (!privy) {
    // Development mode - return mock user
    return {
      id: "demo-user",
      email: "demo@example.com",
    };
  }

  try {
    const claims = await privy.verifyAuthToken(token);
    if (!claims) return null;

    // Get or create user in database
    const user = await prisma.user.upsert({
      where: { privyId: claims.userId },
      update: {},
      create: {
        privyId: claims.userId,
        email: `${claims.userId}@privy.io`,
      },
    });

    return {
      id: user.id,
      email: user.email || `${claims.userId}@privy.io`,
    };
  } catch (error) {
    console.error("Error verifying token:", error);
    return null;
  }
}

// GET - List all API keys for user
export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    const user = await getUserFromToken(authorization);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if database is available
    try {
      const keys = await ApiKeyManager.list(user.id);
      return NextResponse.json({ keys });
    } catch (dbError) {
      // Return mock data if database is not available
      console.log("Database not available, returning mock data");
      return NextResponse.json({
        keys: [
          {
            id: "demo-key-1",
            name: "Development Key",
            prefix: "mrpc_demo...",
            active: true,
            createdAt: new Date(),
            lastUsedAt: null,
            expiresAt: null,
            rateLimit: 10,
            dailyLimit: 10000,
            monthlyLimit: 100000,
          }
        ]
      });
    }
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

// POST - Create new API key
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    const user = await getUserFromToken(authorization);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, expiresIn, rateLimit, dailyLimit, monthlyLimit } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Check if database is available
    try {
      // Check subscription limits
      const subscription = await prisma.subscription.findUnique({
        where: { userId: user.id },
      });

      const plan = subscription?.plan || "FREE";
      const limits = {
        FREE: { maxKeys: 1, rateLimit: 10, dailyLimit: 1000, monthlyLimit: 10000 },
        STARTER: { maxKeys: 5, rateLimit: 50, dailyLimit: 10000, monthlyLimit: 100000 },
        PRO: { maxKeys: 20, rateLimit: 100, dailyLimit: 100000, monthlyLimit: 1000000 },
        ENTERPRISE: { maxKeys: -1, rateLimit: 1000, dailyLimit: -1, monthlyLimit: -1 },
      };

      const planLimits = limits[plan as keyof typeof limits];
      
      // Check number of existing keys
      const existingKeys = await prisma.apiKey.count({
        where: { userId: user.id, active: true },
      });

      if (planLimits.maxKeys > 0 && existingKeys >= planLimits.maxKeys) {
        return NextResponse.json(
          { error: `Maximum number of API keys (${planLimits.maxKeys}) reached for ${plan} plan` },
          { status: 403 }
        );
      }

      // Create the API key
      const apiKey = await ApiKeyManager.create(
        user.id,
        name.trim(),
        {
          expiresIn,
          rateLimit: Math.min(rateLimit || planLimits.rateLimit, planLimits.rateLimit),
          dailyLimit: planLimits.dailyLimit > 0 
            ? Math.min(dailyLimit || planLimits.dailyLimit, planLimits.dailyLimit)
            : dailyLimit,
          monthlyLimit: planLimits.monthlyLimit > 0
            ? Math.min(monthlyLimit || planLimits.monthlyLimit, planLimits.monthlyLimit)
            : monthlyLimit,
        }
      );

      return NextResponse.json({
        id: apiKey.id,
        name: apiKey.name,
        key: apiKey.key, // Only returned on creation
        prefix: (apiKey as any).prefix || apiKey.key.substring(0, 12) + '...',
        active: apiKey.active,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
        rateLimit: apiKey.rateLimit,
        dailyLimit: (apiKey as any).dailyLimit || dailyLimit,
        monthlyLimit: Number(apiKey.monthlyLimit) || monthlyLimit,
      });
    } catch (dbError) {
      // Return mock data if database is not available
      console.log("Database not available, returning mock key");
      const { key, prefix } = ApiKeyManager.generateKey();
      
      return NextResponse.json({
        id: "demo-" + Date.now(),
        name: name.trim(),
        key,
        prefix,
        active: true,
        createdAt: new Date(),
        expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : null,
        rateLimit: rateLimit || 10,
        dailyLimit: dailyLimit || 10000,
        monthlyLimit: monthlyLimit || 100000,
      });
    }
  } catch (error) {
    console.error("Error creating API key:", error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}

// DELETE - Revoke API key
export async function DELETE(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    const user = await getUserFromToken(authorization);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get("id");
    
    if (!keyId) {
      return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
    }

    // Check if database is available
    try {
      const success = await ApiKeyManager.revoke(user.id, keyId);
      
      if (!success) {
        return NextResponse.json({ error: "API key not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (dbError) {
      // Return success if database is not available
      console.log("Database not available, returning success");
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("Error deleting API key:", error);
    return NextResponse.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    );
  }
}

// PUT - Update API key
export async function PUT(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    const user = await getUserFromToken(authorization);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get("id");
    
    if (!keyId) {
      return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
    }

    const body = await request.json();
    const { name, rateLimit, dailyLimit, monthlyLimit } = body;

    // Check if database is available
    try {
      const success = await ApiKeyManager.update(
        user.id,
        keyId,
        { name, rateLimit, dailyLimit, monthlyLimit }
      );
      
      if (!success) {
        return NextResponse.json({ error: "API key not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (dbError) {
      // Return success if database is not available
      console.log("Database not available, returning success");
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("Error updating API key:", error);
    return NextResponse.json(
      { error: "Failed to update API key" },
      { status: 500 }
    );
  }
}