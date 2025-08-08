import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Return mock alerts data for development
    const mockAlerts = {
      alerts: [
        {
          id: "1",
          type: "warning",
          message: "High latency detected on endpoint",
          timestamp: new Date(Date.now() - 3600000),
          endpoint: "https://api.mainnet-beta.solana.com",
        },
        {
          id: "2",
          type: "info",
          message: "Endpoint recovered from degraded state",
          timestamp: new Date(Date.now() - 7200000),
          endpoint: "https://solana-api.projectserum.com",
        },
      ],
    };

    return NextResponse.json(mockAlerts);
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}