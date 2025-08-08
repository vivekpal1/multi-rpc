import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get("timeRange") || "24h";

    // Return mock analytics data for development
    const mockData = {
      timeRange,
      totalRequests: 125432,
      successRate: 98.5,
      averageLatency: 45,
      errorRate: 1.5,
      requestsPerSecond: 15.2,
      topMethods: [
        { method: "getBalance", count: 45000, percentage: 35.9 },
        { method: "getTransaction", count: 32000, percentage: 25.5 },
        { method: "sendTransaction", count: 20000, percentage: 15.9 },
        { method: "getAccountInfo", count: 15000, percentage: 11.9 },
        { method: "getSlot", count: 13432, percentage: 10.7 },
      ],
      timeline: generateTimelineData(timeRange),
      endpoints: [
        {
          url: "https://api.mainnet-beta.solana.com",
          requests: 50000,
          successRate: 99.2,
          avgLatency: 42,
        },
        {
          url: "https://solana-api.projectserum.com",
          requests: 40000,
          successRate: 98.8,
          avgLatency: 45,
        },
        {
          url: "https://rpc.ankr.com/solana",
          requests: 35432,
          successRate: 97.5,
          avgLatency: 48,
        },
      ],
    };

    return NextResponse.json(mockData);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

function generateTimelineData(timeRange: string) {
  const points = timeRange === "24h" ? 24 : timeRange === "7d" ? 7 : 30;
  const data = [];
  
  for (let i = 0; i < points; i++) {
    data.push({
      time: new Date(Date.now() - (points - i) * 3600000).toISOString(),
      requests: Math.floor(Math.random() * 10000) + 5000,
      errors: Math.floor(Math.random() * 100),
      latency: Math.floor(Math.random() * 20) + 35,
    });
  }
  
  return data;
}