"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAuth } from "@/hooks/use-auth";
import {
  CreditCard,
  TrendingUp,
  Calendar,
  Download,
  AlertCircle,
  CheckCircle,
  Zap,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Subscription {
  plan: string;
  status: string;
  currentPeriodEnd: Date;
  price: number;
}

interface Usage {
  requests: number;
  bandwidth: number;
  storage: number;
}

interface Invoice {
  id: string;
  date: Date;
  amount: number;
  status: string;
  downloadUrl: string;
}

export default function BillingPage() {
  const { getAccessToken } = usePrivy();
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBillingData = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const [subRes, usageRes, invoicesRes] = await Promise.all([
        fetch("/api/user/subscription", {
          headers: { "Authorization": `Bearer ${token}` },
        }),
        fetch("/api/user/usage", {
          headers: { "Authorization": `Bearer ${token}` },
        }),
        fetch("/api/user/invoices", {
          headers: { "Authorization": `Bearer ${token}` },
        }),
      ]);

      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData.subscription);
      }

      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsage(usageData.usage);
      }

      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json();
        setInvoices(invoicesData.invoices || []);
      }
    } catch (error) {
      console.error("Error fetching billing data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const handleUpgrade = (plan: string) => {
    console.log("Upgrade to plan:", plan);
    // TODO: Implement Stripe integration
    alert("Stripe integration coming soon!");
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const plans = [
    {
      name: "Free",
      price: 0,
      features: [
        "100K requests/month",
        "10 requests/second",
        "Community support",
        "Basic analytics",
      ],
      limits: {
        requests: 100000,
        rps: 10,
      },
    },
    {
      name: "Starter",
      price: 29,
      features: [
        "1M requests/month",
        "50 requests/second",
        "Email support",
        "Advanced analytics",
        "Custom endpoints",
      ],
      limits: {
        requests: 1000000,
        rps: 50,
      },
    },
    {
      name: "Pro",
      price: 99,
      features: [
        "10M requests/month",
        "100 requests/second",
        "Priority support",
        "Advanced analytics",
        "Custom endpoints",
        "SLA guarantee",
      ],
      limits: {
        requests: 10000000,
        rps: 100,
      },
    },
    {
      name: "Enterprise",
      price: 299,
      features: [
        "Unlimited requests",
        "1000 requests/second",
        "24/7 phone support",
        "Custom SLA",
        "Dedicated endpoints",
        "White-label options",
      ],
      limits: {
        requests: -1, // Unlimited
        rps: 1000,
      },
    },
  ];

  const currentPlan = plans.find(p => p.name === (subscription?.plan || "Free")) || plans[0];
  const usagePercentage = usage ? (usage.requests / currentPlan.limits.requests) * 100 : 0;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="rounded-2xl glass border-0 p-8 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gradient-animate flex items-center gap-3">
                <CreditCard className="w-10 h-10 text-purple-400 animate-pulse-glow" />
                Billing & Usage
              </h1>
              <p className="text-muted-foreground mt-2">Manage your subscription and monitor usage</p>
            </div>
          </div>
        </div>

        {/* Current Plan */}
        <div className="rounded-2xl glass border-0 p-8 animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">Current Plan</h2>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl glass-subtle">
                  <Shield className="h-6 w-6 text-purple-400" />
                </div>
                <span className="text-3xl font-bold text-foreground">{currentPlan.name}</span>
                {subscription?.status === "active" && (
                  <Badge className="bg-green-500/10 text-green-400 border border-green-500/20">Active</Badge>
                )}
              </div>
            </div>
          {currentPlan.price > 0 && (
            <div className="text-right">
              <p className="text-2xl font-bold">${currentPlan.price}/mo</p>
              {subscription?.currentPeriodEnd && (
                <p className="text-sm text-gray-500">
                  Renews on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </div>

          {currentPlan.name === "Free" && (
            <div className="mb-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-purple-400" />
                <p className="text-sm text-purple-300">
                  Upgrade to a paid plan for higher limits and premium features.
                </p>
              </div>
            </div>
          )}

        <div className="space-y-2 mb-4">
          {currentPlan.features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>{feature}</span>
            </div>
          ))}
        </div>

          {currentPlan.name !== "Enterprise" && (
            <button 
              onClick={() => handleUpgrade(plans[plans.indexOf(currentPlan) + 1].name)}
              className="btn-primary w-full mt-6"
            >
              Upgrade Plan
            </button>
          )}
        </div>

        {/* Usage Overview */}
        <div className="rounded-2xl glass border-0 p-8 animate-fade-in">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Current Usage</h2>
        
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">API Requests</span>
              <span className="text-sm text-gray-500">
                {formatNumber(usage?.requests || 0)} / {formatNumber(currentPlan.limits.requests)} 
                ({usagePercentage.toFixed(1)}%)
              </span>
            </div>
            <Progress value={usagePercentage} className="h-2" />
            {usagePercentage > 80 && (
              <p className="text-xs text-yellow-600 mt-1 flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                You&apos;re approaching your monthly limit
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-600">This Month</p>
              <p className="text-xl font-bold">{formatNumber(usage?.requests || 0)}</p>
              <p className="text-xs text-gray-500">requests</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-600">Rate Limit</p>
              <p className="text-xl font-bold">{currentPlan.limits.rps}</p>
              <p className="text-xs text-gray-500">requests/second</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-600">Data Transfer</p>
              <p className="text-xl font-bold">{formatBytes(usage?.bandwidth || 0)}</p>
              <p className="text-xs text-gray-500">this month</p>
            </div>
          </div>
        </div>
      </div>

        {/* Pricing Plans */}
        <div>
          <h2 className="text-2xl font-semibold mb-6 text-foreground">Available Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {plans.map((plan, index) => (
              <div
                key={plan.name}
                className={`group relative overflow-hidden rounded-2xl p-8 transition-all duration-300 hover:scale-[1.02] animate-scale-in stagger-${index + 1} ${
                  plan.name === currentPlan.name 
                    ? 'glass border-2 border-purple-500' 
                    : 'glass-subtle border-0 hover:border hover:border-white/10'
                }`}
              >
                {plan.name === currentPlan.name && (
                  <Badge className="absolute top-4 right-4 bg-purple-500/20 text-purple-400 border-purple-500/30">Current</Badge>
                )}
                <h3 className="text-xl font-bold text-foreground mb-4">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gradient">${plan.price}</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <ul className="space-y-3 mb-8 text-sm">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full interactive ${
                    plan.name === currentPlan.name 
                      ? 'btn-secondary opacity-50 cursor-not-allowed' 
                      : 'btn-primary'
                  }`}
                  onClick={() => handleUpgrade(plan.name)}
                  disabled={plan.name === currentPlan.name}
                >
                  {plan.name === currentPlan.name ? "Current Plan" : "Upgrade"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Billing History */}
        {invoices.length > 0 && (
          <div className="rounded-2xl glass border-0 p-8 animate-fade-in">
            <h2 className="text-2xl font-semibold text-foreground mb-6">Billing History</h2>
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-6 rounded-xl glass-subtle hover-lift transition-all">
                  <div>
                    <p className="font-medium text-foreground">
                      Invoice #{invoice.id.slice(-8)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(invoice.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className={invoice.status === "paid" 
                      ? "bg-green-500/10 text-green-400 border-green-500/20" 
                      : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                    }>
                      {invoice.status}
                    </Badge>
                    <span className="font-medium text-foreground">${invoice.amount}</span>
                    <button className="btn-ghost p-2">
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment Method */}
        <div className="rounded-2xl glass border-0 p-8 animate-fade-in">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Payment Method</h2>
          {currentPlan.price === 0 ? (
            <p className="text-muted-foreground">No payment method required for free plan</p>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl glass-subtle">
                  <CreditCard className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-foreground">•••• •••• •••• 4242</p>
                  <p className="text-sm text-muted-foreground">Expires 12/24</p>
                </div>
              </div>
              <button className="btn-secondary">Update</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}