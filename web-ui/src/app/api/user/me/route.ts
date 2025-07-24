import { NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

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

    // For development without database, return mock user data
    try {
      const user = await prisma.user.findUnique({
        where: { privyId: claims.userId },
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
          id: claims.userId,
          privyId: claims.userId,
          email: (claims as any).email || "user@example.com",
          walletAddress: (claims as any).walletAddress || null,
          name: null,
          createdAt: new Date(),
        });
      }

      return NextResponse.json(user);
    } catch (dbError) {
      console.error("Database error, using mock data:", dbError);
      // Return mock user if database connection fails
      return NextResponse.json({
        id: claims.userId,
        privyId: claims.userId,
        email: (claims as any).email || "user@example.com",
        walletAddress: (claims as any).walletAddress || null,
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