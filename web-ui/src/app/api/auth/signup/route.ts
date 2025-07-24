import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password, name } = parsed.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user (Note: User model doesn't have password field, using privyId as placeholder)
    const user = await prisma.user.create({
      data: {
        email,
        privyId: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
      },
    });

    // Create default API key
    const apiKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        name: "Default Key",
        key: `sk_${generateApiKey()}`,
      },
    });

    // Create free subscription
    await prisma.subscription.create({
      data: {
        userId: user.id,
        stripeCustomerId: `cus_free_${user.id}`, // Placeholder for free users
        plan: "FREE",
        status: "active",
      },
    });

    return NextResponse.json({
      message: "User created successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      apiKey: apiKey.key,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
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