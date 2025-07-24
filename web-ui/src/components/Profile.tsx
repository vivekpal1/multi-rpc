'use client'

import { useState } from 'react'
import { UserIcon, EnvelopeIcon, PhoneIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'

export default function Profile() {
  const [profile, setProfile] = useState({
    name: 'John Doe',
    email: 'john.doe@company.com',
    phone: '+1 (555) 123-4567',
    company: 'Acme Inc.',
    role: 'Admin',
    avatar: 'JD',
  })

  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gradient mb-2">Profile</h2>
        <p className="text-white/60">Manage your account settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card noise">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Personal Information</h3>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="button-secondary"
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            </div>

            <form className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    disabled={!isEditing}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    disabled={!isEditing}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    disabled={!isEditing}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Company</label>
                  <input
                    type="text"
                    value={profile.company}
                    onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                    disabled={!isEditing}
                    className="input"
                  />
                </div>
              </div>

              {isEditing && (
                <div className="flex gap-3 pt-4">
                  <button type="submit" className="button-primary">
                    Save Changes
                  </button>
                </div>
              )}
            </form>
          </div>

          <div className="card noise">
            <h3 className="text-xl font-semibold mb-6">Security</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Password</h4>
                <p className="text-sm text-white/60 mb-3">Last changed 30 days ago</p>
                <button className="button-secondary">Change Password</button>
              </div>
              <div>
                <h4 className="font-medium mb-2">Two-Factor Authentication</h4>
                <p className="text-sm text-white/60 mb-3">Add an extra layer of security to your account</p>
                <button className="button-primary">Enable 2FA</button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card noise text-center">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center text-2xl font-bold">
              {profile.avatar}
            </div>
            <h3 className="text-xl font-semibold">{profile.name}</h3>
            <p className="text-white/60">{profile.role}</p>
            <button className="button-secondary mt-4 w-full">
              Change Avatar
            </button>
          </div>

          <div className="card noise">
            <h3 className="text-lg font-semibold mb-4">Account Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-white/60">Account ID</p>
                <p className="font-mono text-sm">acc_1234567890</p>
              </div>
              <div>
                <p className="text-sm text-white/60">Created</p>
                <p className="text-sm">January 15, 2024</p>
              </div>
              <div>
                <p className="text-sm text-white/60">Status</p>
                <p className="text-sm text-green-400">Active</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}