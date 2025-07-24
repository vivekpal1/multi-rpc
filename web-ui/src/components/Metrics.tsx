'use client'

import { useState, useEffect } from 'react'
import { ChartBarIcon } from '@heroicons/react/24/outline'

export default function Metrics() {
  const [timeRange, setTimeRange] = useState('24h')

  const metrics = {
    requestVolume: [
      { time: '00:00', value: 45000 },
      { time: '04:00', value: 38000 },
      { time: '08:00', value: 52000 },
      { time: '12:00', value: 68000 },
      { time: '16:00', value: 85000 },
      { time: '20:00', value: 72000 },
    ],
    latencyP99: 45,
    latencyP95: 38,
    latencyP50: 25,
    errorRate: 0.02,
    topMethods: [
      { method: 'getAccountInfo', count: 234567, percentage: 35 },
      { method: 'getBalance', count: 189234, percentage: 28 },
      { method: 'getTransaction', count: 156789, percentage: 23 },
      { method: 'sendTransaction', count: 98765, percentage: 14 },
    ],
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gradient mb-2">Metrics</h2>
          <p className="text-white/60">Performance analytics and insights</p>
        </div>
        <select 
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="input w-auto"
        >
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card noise">
          <h3 className="text-lg font-semibold mb-4">Latency Percentiles</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-white/60">P50</span>
                <span className="text-sm font-medium">{metrics.latencyP50}ms</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-400 rounded-full"
                  style={{ width: `${(metrics.latencyP50 / 100) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-white/60">P95</span>
                <span className="text-sm font-medium">{metrics.latencyP95}ms</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-400 rounded-full"
                  style={{ width: `${(metrics.latencyP95 / 100) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-white/60">P99</span>
                <span className="text-sm font-medium">{metrics.latencyP99}ms</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-400 rounded-full"
                  style={{ width: `${(metrics.latencyP99 / 100) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card noise">
          <h3 className="text-lg font-semibold mb-4">Error Rate</h3>
          <div className="text-center py-8">
            <p className="text-5xl font-bold mb-2">{(metrics.errorRate * 100).toFixed(2)}%</p>
            <p className="text-white/60">Last {timeRange}</p>
          </div>
        </div>

        <div className="card noise">
          <h3 className="text-lg font-semibold mb-4">Request Volume</h3>
          <div className="h-32 flex items-end justify-between gap-2">
            {metrics.requestVolume.map((data, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div 
                  className="w-full bg-gradient-to-t from-white/20 to-white/5 rounded-t"
                  style={{ height: `${(data.value / 100000) * 100}%` }}
                />
                <span className="text-xs text-white/40">{data.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card noise">
        <h3 className="text-lg font-semibold mb-4">Top RPC Methods</h3>
        <div className="space-y-3">
          {metrics.topMethods.map((method, i) => (
            <div key={i}>
              <div className="flex justify-between mb-2">
                <span className="font-medium">{method.method}</span>
                <span className="text-sm text-white/60">{method.count.toLocaleString()} calls</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-white/40 to-white/20 rounded-full"
                  style={{ width: `${method.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}