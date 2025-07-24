import { NextRequest, NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";
import { prisma } from "@/lib/prisma";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function PUT(request: NextRequest) {
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

    const { name } = await request.json();

    // Mock implementation - in production, update in database
    const updatedUser = {
      id: claims.userId,
      privyId: claims.userId,
      email: (claims as any).email || "user@example.com",
      name: name || null,
      walletAddress: (claims as any).walletAddress || null,
      updatedAt: new Date(),
    };

    // In production:
    // const updatedUser = await prisma.user.update({
    //   where: { privyId: claims.userId },
    //   data: { name },
    // });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}