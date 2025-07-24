'use client'

import { useState, useEffect } from 'react'
import { ArrowUpIcon, ArrowDownIcon, ServerIcon, BoltIcon } from '@heroicons/react/24/outline'

interface Stats {
  totalRequests: number
  successRate: number
  avgLatency: number
  activeEndpoints: number
  healthyEndpoints: number
  totalEndpoints: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalRequests: 0,
    successRate: 0,
    avgLatency: 0,
    activeEndpoints: 0,
    healthyEndpoints: 0,
    totalEndpoints: 0,
  })

  useEffect(() => {
    // Simulated data - replace with actual API call
    setStats({
      totalRequests: 1234567,
      successRate: 99.8,
      avgLatency: 45,
      activeEndpoints: 12,
      healthyEndpoints: 11,
      totalEndpoints: 15,
    })
  }, [])

  const statCards = [
    {
      title: 'Total Requests',
      value: stats.totalRequests.toLocaleString(),
      change: '+12.5%',
      trend: 'up',
      icon: ServerIcon,
    },
    {
      title: 'Success Rate',
      value: `${stats.successRate}%`,
      change: '+0.3%',
      trend: 'up',
      icon: BoltIcon,
    },
    {
      title: 'Avg Latency',
      value: `${stats.avgLatency}ms`,
      change: '-5ms',
      trend: 'down',
      icon: BoltIcon,
    },
    {
      title: 'Healthy Endpoints',
      value: `${stats.healthyEndpoints}/${stats.totalEndpoints}`,
      change: `${((stats.healthyEndpoints / stats.totalEndpoints) * 100).toFixed(0)}%`,
      trend: 'up',
      icon: ServerIcon,
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gradient mb-2">Dashboard</h2>
        <p className="text-white/60">Monitor your RPC infrastructure in real-time</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          const TrendIcon = stat.trend === 'up' ? ArrowUpIcon : ArrowDownIcon
          const trendColor = stat.trend === 'up' ? 'text-green-400' : 'text-red-400'

          return (
            <div key={index} className="card noise">
              <div className="flex items-start justify-between mb-4">
                <Icon className="w-8 h-8 text-white/40" />
                <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
                  <TrendIcon className="w-4 h-4" />
                  <span>{stat.change}</span>
                </div>
              </div>
              <h3 className="text-white/60 text-sm mb-1">{stat.title}</h3>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card noise">
          <h3 className="text-xl font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
                <div>
                  <p className="font-medium">getAccountInfo</p>
                  <p className="text-sm text-white/60">Solana Labs • 23ms</p>
                </div>
                <span className="text-green-400 text-sm">Success</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card noise">
          <h3 className="text-xl font-semibold mb-4">Endpoint Health</h3>
          <div className="space-y-3">
            {[
              { name: 'Solana Labs', status: 'healthy', latency: 32 },
              { name: 'Ankr', status: 'degraded', latency: 156 },
              { name: 'QuickNode', status: 'healthy', latency: 45 },
              { name: 'Alchemy', status: 'healthy', latency: 38 },
            ].map((endpoint, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    endpoint.status === 'healthy' ? 'bg-green-400' : 'bg-yellow-400'
                  }`} />
                  <span className="font-medium">{endpoint.name}</span>
                </div>
                <span className="text-sm text-white/60">{endpoint.latency}ms</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}