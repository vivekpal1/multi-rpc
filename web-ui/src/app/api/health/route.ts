import { NextResponse } from "next/server";
import { validateEnv } from "@/lib/env-validation";

export async function GET() {
  try {
    // Check environment variables
    try {
      validateEnv();
    } catch (error) {
      return NextResponse.json(
        {
          status: "unhealthy",
          error: "Missing environment variables",
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Check Multi-RPC backend connectivity
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8080";
    let backendHealthy = false;
    
    try {
      const response = await fetch(`${rpcUrl}/health`, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      backendHealthy = response.ok;
    } catch (error) {
      console.log("Multi-RPC backend health check failed:", error);
    }

    // Check database connectivity (optional)
    let databaseHealthy = true;
    if (process.env.DATABASE_URL) {
      try {
        const { prisma } = await import("@/lib/prisma");
        await prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        console.log("Database health check failed:", error);
        databaseHealthy = false;
      }
    }

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      services: {
        backend: backendHealthy ? "healthy" : "degraded",
        database: databaseHealthy ? "healthy" : "degraded",
      },
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        status: "unhealthy",
        error: "Internal server error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}