'use client'

import { useState } from 'react'
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'

interface Endpoint {
  id: string
  name: string
  url: string
  weight: number
  priority: number
  region: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency: number
}

export default function RPCManagement() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([
    {
      id: '1',
      name: 'Solana Labs',
      url: 'https://api.mainnet-beta.solana.com',
      weight: 100,
      priority: 1,
      region: 'us-east',
      status: 'healthy',
      latency: 32,
    },
    {
      id: '2',
      name: 'Ankr',
      url: 'https://rpc.ankr.com/solana',
      weight: 85,
      priority: 3,
      region: 'global',
      status: 'degraded',
      latency: 156,
    },
  ])

  const [showAddModal, setShowAddModal] = useState(false)

  const statusColors = {
    healthy: 'bg-green-400',
    degraded: 'bg-yellow-400',
    unhealthy: 'bg-red-400',
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gradient mb-2">RPC Management</h2>
          <p className="text-white/60">Configure and monitor your RPC endpoints</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="button-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Add Endpoint
        </button>
      </div>

      <div className="card noise overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-4 px-4 text-white/60 font-medium">Status</th>
                <th className="text-left py-4 px-4 text-white/60 font-medium">Name</th>
                <th className="text-left py-4 px-4 text-white/60 font-medium">URL</th>
                <th className="text-left py-4 px-4 text-white/60 font-medium">Region</th>
                <th className="text-left py-4 px-4 text-white/60 font-medium">Weight</th>
                <th className="text-left py-4 px-4 text-white/60 font-medium">Priority</th>
                <th className="text-left py-4 px-4 text-white/60 font-medium">Latency</th>
                <th className="text-left py-4 px-4 text-white/60 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((endpoint) => (
                <tr key={endpoint.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusColors[endpoint.status]}`} />
                      <span className="text-sm capitalize">{endpoint.status}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-medium">{endpoint.name}</td>
                  <td className="py-4 px-4 text-white/60 text-sm">{endpoint.url}</td>
                  <td className="py-4 px-4">{endpoint.region}</td>
                  <td className="py-4 px-4">{endpoint.weight}</td>
                  <td className="py-4 px-4">{endpoint.priority}</td>
                  <td className="py-4 px-4">{endpoint.latency}ms</td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-red-400">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Add New Endpoint</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Name</label>
                <input type="text" className="input" placeholder="e.g., QuickNode" />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">URL</label>
                <input type="text" className="input" placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Weight</label>
                  <input type="number" className="input" placeholder="100" />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Priority</label>
                  <input type="number" className="input" placeholder="1" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Region</label>
                <select className="input">
                  <option value="us-east">US East</option>
                  <option value="us-west">US West</option>
                  <option value="eu">Europe</option>
                  <option value="asia">Asia</option>
                  <option value="global">Global</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="button-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="button-primary flex-1">
                  Add Endpoint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}