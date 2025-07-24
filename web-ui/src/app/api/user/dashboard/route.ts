import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { PrivyClient } from "@privy-io/server-auth";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function GET() {
  try {
    const authorization = headers().get("authorization");
    if (!authorization) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract token from Bearer token
    const token = authorization.replace("Bearer ", "");
    
    // Verify the token with Privy
    const claims = await privy.verifyAuthToken(token);
    if (!claims) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get plan limits
    const planLimits = {
      FREE: { requests: 100000, rateLimit: 10 },
      STARTER: { requests: 1000000, rateLimit: 50 },
      PRO: { requests: 10000000, rateLimit: 100 },
      ENTERPRISE: { requests: -1, rateLimit: 1000 }, // -1 means unlimited
    };

    try {
      // Fetch user data including API keys and usage
      const user = await prisma.user.findUnique({
        where: { privyId: claims.userId },
        include: {
          apiKeys: {
            orderBy: { createdAt: "desc" },
          },
          subscription: true,
          usage: {
            where: {
              date: {
                gte: new Date(new Date().setDate(1)), // Start of current month
              },
            },
          },
        },
      });

      if (!user) {
        // Return mock data if user not found
        return NextResponse.json({
          apiKeys: [],
          subscription: null,
          usage: {
            requests: 0,
            successCount: 0,
            errorCount: 0,
            bytesIn: 0,
            bytesOut: 0,
          },
          limits: planLimits.FREE,
        });
      }

      // Calculate current month usage
      const currentMonthUsage = user.usage.reduce(
        (acc, usage) => ({
          requests: acc.requests + Number(usage.requests),
          successCount: acc.successCount + Number(usage.successCount),
          errorCount: acc.errorCount + Number(usage.errorCount),
          bytesIn: acc.bytesIn + Number(usage.bytesIn),
          bytesOut: acc.bytesOut + Number(usage.bytesOut),
        }),
        {
          requests: 0,
          successCount: 0,
          errorCount: 0,
          bytesIn: 0,
          bytesOut: 0,
        }
      );

      const currentPlan = user.subscription?.plan || "FREE";
      const limits = planLimits[currentPlan as keyof typeof planLimits];

      return NextResponse.json({
        apiKeys: user.apiKeys,
        subscription: user.subscription,
        usage: currentMonthUsage,
        limits,
      });
    } catch (dbError) {
      console.error("Database error, using mock data:", dbError);
      // Return mock data if database fails
      return NextResponse.json({
        apiKeys: [],
        subscription: null,
        usage: {
          requests: 0,
          successCount: 0,
          errorCount: 0,
          bytesIn: 0,
          bytesOut: 0,
        },
        limits: planLimits.FREE,
      });
    }
  } catch (error) {
    console.error("Dashboard data error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}