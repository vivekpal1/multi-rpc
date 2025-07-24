import { NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";
import { prisma } from "@/lib/prisma";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function POST(req: Request) {
  try {
    const { privyId, email, wallet, linkedAccounts } = await req.json();

    // Extract wallet address
    const walletAddress = wallet?.address || 
      linkedAccounts?.find((acc: any) => acc.type === "wallet")?.address;

    // For demo purposes, create a mock user without database
    const user = {
      id: privyId,
      privyId,
      email: email || null,
      walletAddress,
      walletType: wallet?.walletClient || "unknown",
      name: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      // Try to verify with Privy if possible
      const privyUser = await privy.getUser(privyId);
      if (privyUser) {
        user.email = email || privyUser.email?.address || null;
        user.name = privyUser.google?.name || privyUser.twitter?.username || null;
      }
    } catch (privyError) {
      console.log("Privy verification skipped:", privyError);
    }

    // In production, this would interact with the database:
    /*
    const user = await prisma.user.upsert({
      where: { privyId },
      update: {
        email: email || privyUser.email?.address,
        walletAddress,
        walletType: wallet?.walletClient || "unknown",
        updatedAt: new Date(),
      },
      create: {
        privyId,
        email: email || privyUser.email?.address,
        walletAddress,
        walletType: wallet?.walletClient || "unknown",
        name: privyUser.google?.name || privyUser.twitter?.username,
      },
    });
    */

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
      },
    });
  } catch (error) {
    console.error("Privy auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}

function generateApiKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}