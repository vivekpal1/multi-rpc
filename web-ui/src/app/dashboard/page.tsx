"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load the dashboard to improve initial load time
const OptimizedDashboard = dynamic(() => import("./optimized-dashboard"), {
  loading: () => (
    <div className="p-6 space-y-6">
      <Skeleton className="h-32 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  ),
  ssr: false,
});

export default function DashboardPage() {
  return <OptimizedDashboard />;
}