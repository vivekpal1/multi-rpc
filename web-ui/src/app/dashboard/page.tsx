"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import DashboardClient from "./dashboard-client";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const { getAccessToken } = usePrivy();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/auth");
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user) {
        console.log("No user data available");
        setDataLoading(false);
        return;
      }

      try {
        console.log("Fetching dashboard data for user:", user.id);
        const token = await getAccessToken();
        
        const response = await fetch("/api/user/dashboard", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        
        if (!response.ok) {
          console.error("Dashboard API error:", response.status, response.statusText);
          setDataLoading(false);
          return;
        }
        
        const data = await response.json();
        console.log("Dashboard data received:", data);
        setDashboardData(data);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setDataLoading(false);
      }
    }

    fetchDashboardData();
  }, [user, getAccessToken]);

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">No user data available</h2>
          <p className="text-gray-500 mt-2">Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  // Provide default data if dashboardData is null
  const defaultDashboardData = {
    apiKeys: [],
    subscription: null,
    usage: {
      requests: 0,
      successCount: 0,
      errorCount: 0,
      bytesIn: 0,
      bytesOut: 0,
    },
    limits: {
      requests: 100000,
      rateLimit: 10,
    },
  };

  const data = dashboardData || defaultDashboardData;

  return (
    <DashboardClient
      user={{
        id: user.id,
        email: user.email!,
        name: user.name || null,
        walletAddress: user.walletAddress,
      }}
      apiKeys={data.apiKeys}
      subscription={data.subscription}
      usage={data.usage}
      limits={data.limits}
    />
  );
}