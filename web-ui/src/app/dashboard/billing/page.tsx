"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
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
  };

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing & Usage</h1>
          <p className="text-gray-600 mt-1">Manage your subscription and monitor usage</p>
        </div>
      </div>

      {/* Current Plan */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Current Plan</h2>
            <div className="flex items-center gap-2 mt-1">
              <Shield className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold">{currentPlan.name}</span>
              {subscription?.status === "active" && (
                <Badge className="bg-green-100 text-green-800">Active</Badge>
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
          <Alert className="mb-4">
            <Zap className="h-4 w-4" />
            <AlertDescription>
              Upgrade to a paid plan for higher limits and premium features.
            </AlertDescription>
          </Alert>
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
          <Button 
            onClick={() => handleUpgrade(plans[plans.indexOf(currentPlan) + 1].name)}
            className="w-full"
          >
            Upgrade Plan
          </Button>
        )}
      </Card>

      {/* Usage Overview */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Current Usage</h2>
        
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
                You're approaching your monthly limit
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
      </Card>

      {/* Pricing Plans */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <Card 
              key={plan.name}
              className={`p-6 ${plan.name === currentPlan.name ? 'border-blue-600 border-2' : ''}`}
            >
              {plan.name === currentPlan.name && (
                <Badge className="mb-2">Current Plan</Badge>
              )}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="text-3xl font-bold my-2">
                ${plan.price}
                <span className="text-sm font-normal text-gray-500">/mo</span>
              </p>
              <ul className="space-y-2 mb-4 text-sm">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                variant={plan.name === currentPlan.name ? "outline" : "default"}
                className="w-full"
                onClick={() => handleUpgrade(plan.name)}
                disabled={plan.name === currentPlan.name}
              >
                {plan.name === currentPlan.name ? "Current Plan" : "Upgrade"}
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {/* Billing History */}
      {invoices.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Billing History</h2>
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">
                    Invoice #{invoice.id.slice(-8)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(invoice.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                    {invoice.status}
                  </Badge>
                  <span className="font-medium">${invoice.amount}</span>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Payment Method */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Payment Method</h2>
        {currentPlan.price === 0 ? (
          <p className="text-gray-500">No payment method required for free plan</p>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium">•••• •••• •••• 4242</p>
                <p className="text-sm text-gray-500">Expires 12/24</p>
              </div>
            </div>
            <Button variant="outline">Update</Button>
          </div>
        )}
      </Card>
    </div>
  );
}