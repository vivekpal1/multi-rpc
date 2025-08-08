"use client";

import { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const ChartSection = memo(({ usage }: any) => {
  const stats = useMemo(() => ({
    monthlyRequests: usage.monthly?.requests?.toLocaleString() || "0",
    successRate: usage.monthly?.requests > 0 
      ? ((usage.monthly.successCount / usage.monthly.requests) * 100).toFixed(2)
      : "100.00",
    errors: usage.monthly?.errorCount?.toLocaleString() || "0",
    dataIn: ((usage.monthly?.bytesIn || 0) / 1024 / 1024).toFixed(1),
    dataOut: ((usage.monthly?.bytesOut || 0) / 1024 / 1024).toFixed(1),
  }), [usage]);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Usage Overview</CardTitle>
        <CardDescription>Your API usage statistics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-sm text-gray-500">Monthly Requests</p>
            <p className="text-2xl font-bold">{stats.monthlyRequests}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Success Rate</p>
            <p className="text-2xl font-bold">{stats.successRate}%</p>
            <Progress value={parseFloat(stats.successRate)} className="h-1.5 mt-1" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Errors</p>
            <p className="text-2xl font-bold">{stats.errors}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Data In</p>
            <p className="text-2xl font-bold">{stats.dataIn} MB</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Data Out</p>
            <p className="text-2xl font-bold">{stats.dataOut} MB</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ChartSection.displayName = "ChartSection";

export default ChartSection;