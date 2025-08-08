import { NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export const dynamic = 'force-dynamic';

const privy = process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET
  ? new PrivyClient(
      process.env.NEXT_PUBLIC_PRIVY_APP_ID,
      process.env.PRIVY_APP_SECRET
    )
  : null;

export async function GET() {
  try {
    const headersList = await headers();
    const authorization = headersList.get("authorization");
    if (!authorization) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract token from Bearer token
    const token = authorization.replace("Bearer ", "");
    
    // Verify the token with Privy if configured
    let userId = "demo-user";
    if (privy) {
      const claims = await privy.verifyAuthToken(token);
      if (!claims) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      userId = claims.userId;
    }

    // For development without database, return mock user data
    try {
      const user = await prisma.user.findUnique({
        where: { privyId: userId },
        select: {
          id: true,
          privyId: true,
          email: true,
          walletAddress: true,
          name: true,
          createdAt: true,
        },
      });

      if (!user) {
        // Return mock user if database is not available
        return NextResponse.json({
          id: userId,
          privyId: userId,
          email: "user@example.com",
          walletAddress: null,
          name: null,
          createdAt: new Date(),
        });
      }

      return NextResponse.json(user);
    } catch (dbError) {
      console.error("Database error, using mock data:", dbError);
      // Return mock user if database connection fails
      return NextResponse.json({
        id: userId,
        privyId: userId,
        email: "user@example.com",
        walletAddress: null,
        name: null,
        createdAt: new Date(),
      });
    }
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}