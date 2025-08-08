"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getPerformanceMetrics } from '@/hooks/use-performance';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const updateMetrics = () => {
      const data = getPerformanceMetrics();
      setMetrics(data);
    };

    // Initial metrics
    setTimeout(updateMetrics, 1000);

    // Update periodically
    const interval = setInterval(updateMetrics, 5000);

    // Show monitor with keyboard shortcut (Ctrl+Shift+P)
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setVisible(v => !v);
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  if (!visible || !metrics) return null;

  const getScoreColor = (score: number) => {
    if (score < 50) return 'text-red-500';
    if (score < 90) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getScoreLabel = (score: number) => {
    if (score < 50) return 'Poor';
    if (score < 90) return 'Needs Improvement';
    return 'Good';
  };

  // Calculate performance score
  const performanceScore = Math.min(100, Math.max(0, 
    100 - (metrics.pageLoadTime / 50) - (metrics.timeToFirstByte / 10)
  ));

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      <Card className="shadow-2xl border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Performance Monitor</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setVisible(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Overall Score */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Performance Score</span>
              <Badge className={getScoreColor(performanceScore)}>
                {getScoreLabel(performanceScore)}
              </Badge>
            </div>
            <Progress value={performanceScore} className="h-2" />
            <span className="text-xs text-gray-500">{performanceScore.toFixed(0)}/100</span>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Page Load</span>
                <span className="font-mono">{metrics.pageLoadTime.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">TTFB</span>
                <span className="font-mono">{metrics.timeToFirstByte.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">DOM Ready</span>
                <span className="font-mono">{metrics.domContentLoaded.toFixed(0)}ms</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Resources</span>
                <span className="font-mono">{metrics.resourceLoadTime.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Requests</span>
                <span className="font-mono">{metrics.requestCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cache Hit</span>
                <span className="font-mono">
                  {localStorage.getItem('cache-hit-rate') || '0'}%
                </span>
              </div>
            </div>
          </div>

          {/* Memory Usage */}
          {(performance as any).memory && (
            <div className="pt-2 border-t">
              <span className="text-xs text-gray-500">Memory Usage</span>
              <div className="flex justify-between text-xs mt-1">
                <span>Used: {((performance as any).memory.usedJSHeapSize / 1048576).toFixed(1)}MB</span>
                <span>Total: {((performance as any).memory.totalJSHeapSize / 1048576).toFixed(1)}MB</span>
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="text-xs text-gray-500 pt-2 border-t">
            Press Ctrl+Shift+P to toggle this monitor
          </div>
        </CardContent>
      </Card>
    </div>
  );
}