import { NextRequest, NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";
import { prisma } from "@/lib/prisma";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function GET(request: NextRequest) {
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

    // Get user with all related data
    const user = await prisma.user.findUnique({
      where: { privyId: claims.userId },
      include: {
        apiKeys: {
          select: {
            id: true,
            name: true,
            active: true,
            createdAt: true,
            lastUsedAt: true,
            rateLimit: true,
          },
        },
        subscription: true,
        linkedAccounts: true,
        _count: {
          select: {
            apiKeys: true,
            usage: true,
            invoices: true,
            webhooks: true,
          },
        },
      },
    });

    if (!user) {
      // Create user if doesn't exist
      const newUser = await prisma.user.create({
        data: {
          privyId: claims.userId,
          email: (claims as any).email || null,
          walletAddress: (claims as any).walletAddress || null,
        },
        include: {
          subscription: true,
          linkedAccounts: true,
          _count: {
            select: {
              apiKeys: true,
              usage: true,
              invoices: true,
              webhooks: true,
            },
          },
        },
      });
      
      return NextResponse.json({ user: newUser });
    }

    // Get usage statistics
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyUsage = await prisma.usage.aggregate({
      where: {
        userId: user.id,
        date: {
          gte: startOfMonth,
        },
      },
      _sum: {
        requests: true,
        successCount: true,
        errorCount: true,
        bytesIn: true,
        bytesOut: true,
      },
    });

    // Get today's usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayUsage = await prisma.usage.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: today,
        },
      },
    });

    return NextResponse.json({
      user: {
        ...user,
        stats: {
          totalApiKeys: user._count.apiKeys,
          totalInvoices: user._count.invoices,
          totalWebhooks: user._count.webhooks,
        },
        usage: {
          monthly: {
            requests: Number(monthlyUsage._sum.requests || 0),
            successCount: Number(monthlyUsage._sum.successCount || 0),
            errorCount: Number(monthlyUsage._sum.errorCount || 0),
            bytesIn: Number(monthlyUsage._sum.bytesIn || 0),
            bytesOut: Number(monthlyUsage._sum.bytesOut || 0),
          },
          today: todayUsage ? {
            requests: Number(todayUsage.requests || 0),
            successCount: Number(todayUsage.successCount || 0),
            errorCount: Number(todayUsage.errorCount || 0),
            bytesIn: Number(todayUsage.bytesIn || 0),
            bytesOut: Number(todayUsage.bytesOut || 0),
          } : null,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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

    const body = await request.json();
    const { name, email, image } = body;

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { privyId: claims.userId },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(image !== undefined && { image }),
      },
      include: {
        subscription: true,
        linkedAccounts: true,
        _count: {
          select: {
            apiKeys: true,
            usage: true,
            invoices: true,
            webhooks: true,
          },
        },
      },
    });

    return NextResponse.json({
      user: updatedUser,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}

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

    // Soft delete or deactivate user (you might want to keep data for compliance)
    await prisma.user.update({
      where: { privyId: claims.userId },
      data: {
        // Mark all API keys as inactive
        apiKeys: {
          updateMany: {
            where: { active: true },
            data: { active: false },
          },
        },
      },
    });

    // For hard delete (removes all data):
    // await prisma.user.delete({
    //   where: { privyId: claims.userId },
    // });

    return NextResponse.json({
      message: "Account deactivated successfully",
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}