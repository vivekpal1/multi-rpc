'use client'

import { useState } from 'react'
import { PlusIcon, ClipboardIcon, TrashIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

interface APIKey {
  id: string
  name: string
  key: string
  created: string
  lastUsed: string
  requests: number
  status: 'active' | 'inactive'
}

export default function APIKeys() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([
    {
      id: '1',
      name: 'Production App',
      key: 'sk_live_abcd1234efgh5678ijkl9012mnop3456',
      created: '2024-01-15',
      lastUsed: '2 hours ago',
      requests: 45678,
      status: 'active',
    },
    {
      id: '2',
      name: 'Development',
      key: 'sk_test_qrst5678uvwx9012yzab3456cdef7890',
      created: '2024-02-01',
      lastUsed: '5 minutes ago',
      requests: 12345,
      status: 'active',
    },
  ])

  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({})
  const [showCreateModal, setShowCreateModal] = useState(false)

  const toggleKeyVisibility = (id: string) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const maskKey = (key: string) => {
    return key.substring(0, 8) + '•'.repeat(20) + key.substring(key.length - 4)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gradient mb-2">API Keys</h2>
          <p className="text-white/60">Manage your API keys and access tokens</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="button-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Create API Key
        </button>
      </div>

      <div className="grid gap-4">
        {apiKeys.map((apiKey) => (
          <div key={apiKey.id} className="card noise">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold">{apiKey.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    apiKey.status === 'active' 
                      ? 'bg-green-400/20 text-green-400' 
                      : 'bg-red-400/20 text-red-400'
                  }`}>
                    {apiKey.status}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                  <code className="text-sm text-white/60 font-mono">
                    {showKeys[apiKey.id] ? apiKey.key : maskKey(apiKey.key)}
                  </code>
                  <button
                    onClick={() => toggleKeyVisibility(apiKey.id)}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    {showKeys[apiKey.id] ? (
                      <EyeSlashIcon className="w-4 h-4 text-white/60" />
                    ) : (
                      <EyeIcon className="w-4 h-4 text-white/60" />
                    )}
                  </button>
                  <button className="p-1 hover:bg-white/10 rounded transition-colors">
                    <ClipboardIcon className="w-4 h-4 text-white/60" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-white/60">Created</p>
                    <p className="font-medium">{apiKey.created}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Last Used</p>
                    <p className="font-medium">{apiKey.lastUsed}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Total Requests</p>
                    <p className="font-medium">{apiKey.requests.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-red-400">
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Create New API Key</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Name</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="e.g., Mobile App Production" 
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Permissions</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" defaultChecked />
                    <span>Read access</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" defaultChecked />
                    <span>Write access</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span>Admin access</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Rate Limit</label>
                <select className="input">
                  <option>100 requests/second</option>
                  <option>1,000 requests/second</option>
                  <option>10,000 requests/second</option>
                  <option>Unlimited</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="button-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="button-primary flex-1">
                  Create Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}