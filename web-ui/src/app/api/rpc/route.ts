import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const RPC_BACKEND_URL = process.env.RPC_BACKEND_URL || "http://localhost:8080";

export async function POST(req: Request) {
  try {
    // Get API key from header
    const apiKey = req.headers.get("X-API-Key");
    
    if (!apiKey) {
      return NextResponse.json(
        { jsonrpc: "2.0", error: { code: -32000, message: "Missing API key" } },
        { status: 401 }
      );
    }

    // Validate API key and get user
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { key: apiKey, active: true },
      include: {
        user: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!apiKeyRecord) {
      return NextResponse.json(
        { jsonrpc: "2.0", error: { code: -32000, message: "Invalid API key" } },
        { status: 401 }
      );
    }

    // Check rate limits based on subscription
    const planLimits = {
      FREE: 10,
      STARTER: 50,
      PRO: 100,
      ENTERPRISE: 1000,
    };

    const rateLimit = planLimits[apiKeyRecord.user.subscription?.plan || "FREE"];
    
    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() },
    });

    // Get request body
    const body = await req.json();
    const requestSize = new TextEncoder().encode(JSON.stringify(body)).length;

    // Forward request to backend
    const startTime = Date.now();
    const backendResponse = await fetch(RPC_BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.RPC_ADMIN_KEY || "",
        "X-User-ID": apiKeyRecord.userId,
        "X-Rate-Limit": rateLimit.toString(),
      },
      body: JSON.stringify(body),
    });

    const responseData = await backendResponse.json();
    const responseSize = new TextEncoder().encode(JSON.stringify(responseData)).length;
    const duration = Date.now() - startTime;

    // Record usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.usage.upsert({
      where: {
        userId_date: {
          userId: apiKeyRecord.userId,
          date: today,
        },
      },
      update: {
        requests: { increment: 1 },
        successCount: backendResponse.ok ? { increment: 1 } : undefined,
        errorCount: !backendResponse.ok ? { increment: 1 } : undefined,
        bytesIn: { increment: requestSize },
        bytesOut: { increment: responseSize },
      },
      create: {
        userId: apiKeyRecord.userId,
        apiKeyId: apiKeyRecord.id,
        date: today,
        requests: 1,
        successCount: backendResponse.ok ? 1 : 0,
        errorCount: backendResponse.ok ? 0 : 1,
        bytesIn: requestSize,
        bytesOut: responseSize,
      },
    });

    // Set response headers
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("X-RPC-Duration", duration.toString());
    headers.set("X-Rate-Limit", rateLimit.toString());

    return new NextResponse(JSON.stringify(responseData), {
      status: backendResponse.status,
      headers,
    });
  } catch (error) {
    console.error("RPC proxy error:", error);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
      },
      { status: 500 }
    );
  }
}

// Also support GET for some RPC methods
export async function GET(req: Request) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      error: { code: -32600, message: "Invalid request method. Use POST." },
    },
    { status: 405 }
  );
}