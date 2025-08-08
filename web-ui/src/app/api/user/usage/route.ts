import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Return mock usage data for development
    const mockUsage = {
      usage: {
        requests: 45678,
        bandwidth: 1024 * 1024 * 512, // 512 MB
        storage: 1024 * 1024 * 100, // 100 MB
      },
    };

    return NextResponse.json(mockUsage);
  } catch (error) {
    console.error("Error fetching usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage" },
      { status: 500 }
    );
  }
}