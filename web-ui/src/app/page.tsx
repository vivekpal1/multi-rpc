"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { 
  Zap, Shield, BarChart3, Globe, 
  CheckCircle, ArrowRight, Code2,
  Activity, Users, Cpu, Server,
  Clock, TrendingUp, Lock, Sparkles
} from "lucide-react";

export default function HomePage() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold">Multi-RPC</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/docs"
                className="text-sm text-gray-600 hover:text-gray-900 hidden sm:block"
              >
                Documentation
              </Link>
              <Link
                href="#pricing"
                className="text-sm text-gray-600 hover:text-gray-900 hidden sm:block"
              >
                Pricing
              </Link>
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="btn-primary text-sm"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth"
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/auth"
                    className="btn-primary text-sm"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-4 py-1.5 mb-6">
              <Sparkles className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-600">Enterprise-grade RPC infrastructure</span>
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-gray-900 mb-6">
              Solana RPC that
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600">
                never goes down
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
              Intelligent load balancing across 50+ endpoints ensures your dApp stays online. 
              Built for developers who need reliability at scale.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth"
                className="btn-primary px-8 py-3 text-base"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <Link
                href="#features"
                className="btn-secondary px-8 py-3 text-base"
              >
                See How It Works
              </Link>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20">
            {[
              { label: "Uptime SLA", value: "99.99%", icon: Activity },
              { label: "Global Endpoints", value: "50+", icon: Globe },
              { label: "Daily Requests", value: "100M+", icon: TrendingUp },
              { label: "Response Time", value: "<50ms", icon: Clock },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className="text-center animate-fadeIn"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <stat.icon className="w-8 h-8 mx-auto text-gray-400 mb-3" />
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-600 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Why developers choose Multi-RPC
            </h2>
            <p className="text-xl text-gray-600">
              Everything you need to build reliable Solana applications
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: "Intelligent Routing",
                description: "Requests automatically route to the fastest available endpoint based on real-time latency monitoring.",
              },
              {
                icon: Shield,
                title: "Automatic Failover",
                description: "When an endpoint fails, traffic instantly switches to healthy alternatives with zero downtime.",
              },
              {
                icon: BarChart3,
                title: "Analytics Dashboard",
                description: "Track performance metrics, monitor usage patterns, and optimize your RPC strategy with detailed insights.",
              },
              {
                icon: Globe,
                title: "Global Coverage",
                description: "Endpoints strategically located worldwide ensure low-latency access from any geographic location.",
              },
              {
                icon: Lock,
                title: "Enterprise Security",
                description: "API key authentication, rate limiting, and DDoS protection keep your infrastructure secure.",
              },
              {
                icon: Server,
                title: "99.99% Uptime",
                description: "Redundant infrastructure and proactive monitoring deliver enterprise-grade reliability.",
              },
            ].map((feature, index) => (
              <div
                key={feature.title}
                className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow animate-fadeIn"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-gray-700" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Example Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                Drop-in replacement for any Solana RPC
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Works with your existing code. Just change your RPC endpoint and get instant reliability improvements.
              </p>
              <ul className="space-y-4">
                {[
                  "Compatible with all Solana SDKs",
                  "WebSocket subscriptions supported",
                  "Full JSON-RPC 2.0 compliance",
                  "No code changes required",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-3 h-3 text-green-600" />
                    </div>
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <pre className="text-sm text-gray-300 overflow-x-auto">
                <code>{`// Before: Single point of failure
const connection = new Connection(
  "https://api.mainnet-beta.solana.com"
);

// After: High availability
const connection = new Connection(
  "https://rpc.multirpc.com",
  {
    httpHeaders: {
      "X-API-Key": "your-api-key"
    }
  }
);

// That's it! Your app is now reliable`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-xl text-gray-600">
              Start free and scale as you grow
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: "Starter",
                price: "$0",
                description: "Perfect for side projects",
                features: [
                  "100,000 requests/month",
                  "10 requests/second",
                  "Basic analytics",
                  "Community support",
                  "99.9% uptime SLA",
                ],
                cta: "Start Free",
                highlighted: false,
              },
              {
                name: "Pro",
                price: "$99",
                description: "For production applications",
                features: [
                  "10M requests/month",
                  "100 requests/second",
                  "Advanced analytics",
                  "Priority support",
                  "Custom endpoints",
                  "99.99% uptime SLA",
                ],
                cta: "Start Trial",
                highlighted: true,
              },
              {
                name: "Enterprise",
                price: "Custom",
                description: "For teams at scale",
                features: [
                  "Unlimited requests",
                  "1000+ requests/second",
                  "White-label option",
                  "24/7 phone support",
                  "Private endpoints",
                  "100% uptime SLA",
                  "On-premise deployment",
                ],
                cta: "Contact Sales",
                highlighted: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 ${
                  plan.highlighted
                    ? "bg-gray-900 text-white ring-4 ring-gray-900 ring-offset-4"
                    : "bg-white border border-gray-200"
                }`}
              >
                {plan.highlighted && (
                  <p className="text-sm font-medium mb-4 text-gray-300">
                    Most Popular
                  </p>
                )}
                <h3 className={`text-2xl font-bold mb-2 ${
                  plan.highlighted ? "text-white" : "text-gray-900"
                }`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-6 ${
                  plan.highlighted ? "text-gray-300" : "text-gray-600"
                }`}>
                  {plan.description}
                </p>
                <div className="mb-6">
                  <span className={`text-4xl font-bold ${
                    plan.highlighted ? "text-white" : "text-gray-900"
                  }`}>
                    {plan.price}
                  </span>
                  {plan.price !== "Custom" && (
                    <span className={`text-sm ${
                      plan.highlighted ? "text-gray-300" : "text-gray-600"
                    }`}>
                      /month
                    </span>
                  )}
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <CheckCircle className={`w-5 h-5 flex-shrink-0 ${
                        plan.highlighted ? "text-gray-300" : "text-green-600"
                      }`} />
                      <span className={`text-sm ${
                        plan.highlighted ? "text-gray-300" : "text-gray-600"
                      }`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth"
                  className={`block w-full text-center py-3 px-4 rounded-lg font-medium transition-colors ${
                    plan.highlighted
                      ? "bg-white text-gray-900 hover:bg-gray-100"
                      : "bg-gray-900 text-white hover:bg-gray-800"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-16">
            Trusted by leading Solana teams
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                quote: "Multi-RPC eliminated our downtime issues. We haven't had a single RPC-related outage since switching.",
                author: "Sarah Chen",
                role: "CTO, DeFi Protocol",
              },
              {
                quote: "The analytics dashboard helped us optimize our RPC usage and cut costs by 40% while improving performance.",
                author: "Michael Rodriguez",
                role: "Lead Developer, NFT Marketplace",
              },
              {
                quote: "Setup took 5 minutes and our transaction success rate improved immediately. Wish we'd switched sooner.",
                author: "Alex Kim",
                role: "Founder, Web3 Startup",
              },
            ].map((testimonial, index) => (
              <div
                key={index}
                className="bg-gray-50 rounded-xl p-6 animate-fadeIn"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <p className="text-gray-700 mb-4 italic">
                  &quot;{testimonial.quote}&quot;
                </p>
                <div>
                  <p className="font-semibold text-gray-900">{testimonial.author}</p>
                  <p className="text-sm text-gray-600">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to make your Solana app bulletproof?
          </h2>
          <p className="text-xl text-gray-300 mb-10">
            Join thousands of developers using Multi-RPC for reliable blockchain infrastructure
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth"
              className="btn-primary bg-white text-gray-900 hover:bg-gray-100 px-8 py-3 text-base"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
            <Link
              href="/docs"
              className="btn-secondary border-gray-700 text-white hover:bg-gray-800 px-8 py-3 text-base"
            >
              Read Documentation
            </Link>
          </div>
          <p className="text-sm text-gray-400 mt-8">
            No credit card required • Free tier forever • 5-minute setup
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-semibold">Multi-RPC</span>
              </div>
              <p className="text-sm text-gray-600">
                Enterprise-grade Solana RPC infrastructure for reliable blockchain applications.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Product</h3>
              <ul className="space-y-2">
                <li><Link href="#features" className="text-sm text-gray-600 hover:text-gray-900">Features</Link></li>
                <li><Link href="#pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</Link></li>
                <li><Link href="/docs" className="text-sm text-gray-600 hover:text-gray-900">Documentation</Link></li>
                <li><Link href="/status" className="text-sm text-gray-600 hover:text-gray-900">Status</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Company</h3>
              <ul className="space-y-2">
                <li><Link href="/about" className="text-sm text-gray-600 hover:text-gray-900">About</Link></li>
                <li><Link href="/blog" className="text-sm text-gray-600 hover:text-gray-900">Blog</Link></li>
                <li><Link href="/careers" className="text-sm text-gray-600 hover:text-gray-900">Careers</Link></li>
                <li><Link href="/contact" className="text-sm text-gray-600 hover:text-gray-900">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><Link href="/privacy" className="text-sm text-gray-600 hover:text-gray-900">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-sm text-gray-600 hover:text-gray-900">Terms of Service</Link></li>
                <li><Link href="/sla" className="text-sm text-gray-600 hover:text-gray-900">SLA</Link></li>
                <li><Link href="/security" className="text-sm text-gray-600 hover:text-gray-900">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-600">
              © 2024 Multi-RPC. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link href="https://twitter.com" className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </Link>
              <Link href="https://github.com" className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}