'use client'

import { useState } from 'react'
import { CheckIcon, CreditCardIcon } from '@heroicons/react/24/outline'

interface Plan {
  id: string
  name: string
  price: number
  features: string[]
  recommended?: boolean
}

export default function Billing() {
  const [selectedPlan, setSelectedPlan] = useState('pro')
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')

  const plans: Plan[] = [
    {
      id: 'starter',
      name: 'Starter',
      price: billingPeriod === 'monthly' ? 29 : 290,
      features: [
        '100,000 requests/month',
        '2 RPC endpoints',
        'Basic analytics',
        'Email support',
        '99.9% uptime SLA',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: billingPeriod === 'monthly' ? 99 : 990,
      features: [
        '1,000,000 requests/month',
        '10 RPC endpoints',
        'Advanced analytics',
        'Priority support',
        '99.95% uptime SLA',
        'Custom domains',
        'Team collaboration',
      ],
      recommended: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: billingPeriod === 'monthly' ? 499 : 4990,
      features: [
        'Unlimited requests',
        'Unlimited endpoints',
        'Real-time analytics',
        '24/7 phone support',
        '99.99% uptime SLA',
        'Custom integrations',
        'Dedicated account manager',
        'On-premise deployment',
      ],
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gradient mb-2">Billing & Plans</h2>
        <p className="text-white/60">Choose the perfect plan for your needs</p>
      </div>

      <div className="flex items-center justify-center gap-4 mb-8">
        <span className={billingPeriod === 'monthly' ? 'text-white' : 'text-white/60'}>Monthly</span>
        <button
          onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
          className="relative w-14 h-7 rounded-full glass-dark transition-colors"
        >
          <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
            billingPeriod === 'yearly' ? 'translate-x-7' : 'translate-x-1'
          }`} />
        </button>
        <span className={billingPeriod === 'yearly' ? 'text-white' : 'text-white/60'}>
          Yearly <span className="text-green-400 text-sm">(Save 20%)</span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`card noise relative ${
              plan.recommended ? 'border-white/30' : ''
            } ${
              selectedPlan === plan.id ? 'ring-2 ring-white/40' : ''
            }`}
          >
            {plan.recommended && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-white/20 to-white/10 rounded-full text-xs font-medium">
                Recommended
              </div>
            )}

            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold">${plan.price}</span>
                <span className="text-white/60">/{billingPeriod === 'monthly' ? 'mo' : 'yr'}</span>
              </div>
            </div>

            <ul className="space-y-3 mb-6">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckIcon className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => setSelectedPlan(plan.id)}
              className={`w-full ${
                selectedPlan === plan.id ? 'button-primary' : 'button-secondary'
              }`}
            >
              {selectedPlan === plan.id ? 'Current Plan' : 'Select Plan'}
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card noise">
          <h3 className="text-xl font-semibold mb-4">Payment Method</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-lg border border-white/10">
              <div className="flex items-center gap-3">
                <CreditCardIcon className="w-8 h-8 text-white/60" />
                <div>
                  <p className="font-medium">•••• •••• •••• 4242</p>
                  <p className="text-sm text-white/60">Expires 12/25</p>
                </div>
              </div>
              <button className="button-secondary text-sm">Update</button>
            </div>
            <button className="w-full button-secondary">Add Payment Method</button>
          </div>
        </div>

        <div className="card noise">
          <h3 className="text-xl font-semibold mb-4">Billing History</h3>
          <div className="space-y-3">
            {[
              { date: 'Mar 1, 2024', amount: 99, status: 'Paid' },
              { date: 'Feb 1, 2024', amount: 99, status: 'Paid' },
              { date: 'Jan 1, 2024', amount: 99, status: 'Paid' },
            ].map((invoice, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
                <div>
                  <p className="font-medium">{invoice.date}</p>
                  <p className="text-sm text-white/60">${invoice.amount}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-green-400">{invoice.status}</span>
                  <button className="text-sm text-white/60 hover:text-white">Download</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}