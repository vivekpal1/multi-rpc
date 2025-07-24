import { NextRequest, NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

// Generate a secure API key
function generateApiKey(): string {
  return `sk_${crypto.randomBytes(32).toString("hex")}`;
}

// CREATE new API key
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

    const { name } = await request.json();
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const apiKey = generateApiKey();

    // Mock implementation - in production, save to database
    const newKey = {
      id: crypto.randomUUID(),
      name: name.trim(),
      key: apiKey,
      active: true,
      createdAt: new Date(),
      lastUsedAt: null,
      userId: claims.userId,
    };

    // In production, you would save this to the database:
    // const newKey = await prisma.apiKey.create({
    //   data: {
    //     name: name.trim(),
    //     key: apiKey,
    //     userId: claims.userId,
    //   },
    // });

    return NextResponse.json(newKey);
  } catch (error) {
    console.error("Error creating API key:", error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}

// DELETE API key
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
    const keyId = searchParams.get("id");
    
    if (!keyId) {
      return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
    }

    // Mock implementation - in production, delete from database
    // await prisma.apiKey.delete({
    //   where: {
    //     id: keyId,
    //     userId: claims.userId,
    //   },
    // });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting API key:", error);
    return NextResponse.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    );
  }
}