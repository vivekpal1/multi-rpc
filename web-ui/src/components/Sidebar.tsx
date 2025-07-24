'use client'

import { 
  HomeIcon, 
  ServerIcon, 
  KeyIcon, 
  ChartBarIcon, 
  UserIcon, 
  CreditCardIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'

interface SidebarProps {
  activeSection: string
  setActiveSection: (section: string) => void
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
  { id: 'rpc', label: 'RPC Management', icon: ServerIcon },
  { id: 'api-keys', label: 'API Keys', icon: KeyIcon },
  { id: 'metrics', label: 'Metrics', icon: ChartBarIcon },
  { id: 'profile', label: 'Profile', icon: UserIcon },
  { id: 'billing', label: 'Billing', icon: CreditCardIcon },
]

export default function Sidebar({ activeSection, setActiveSection }: SidebarProps) {
  return (
    <aside className="w-64 glass-dark border-r border-white/10 p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gradient">Multi-RPC</h1>
        <p className="text-sm text-white/60 mt-1">Enterprise Dashboard</p>
      </div>

      <nav className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'glass bg-white/10 border border-white/20' 
                  : 'hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon className="w-5 h-5 text-white/80" />
              <span className={isActive ? 'text-white' : 'text-white/80'}>
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>

      <div className="absolute bottom-6 left-6 right-6">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-all duration-200">
          <Cog6ToothIcon className="w-5 h-5 text-white/80" />
          <span className="text-white/80">Settings</span>
        </button>
      </div>
    </aside>
  )
}