"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { 
  Wallet, 
  Loader2, 
  ArrowRight, 
  Shield, 
  Zap, 
  Lock,
  CheckCircle,
  X,
  Cpu,
  Sparkles,
  Twitter,
  Mail
} from "lucide-react";

export default function AuthPage() {
  const { ready, authenticated, login, connectWallet } = usePrivy();
  const { wallets } = useWallets();
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && authenticated) {
      router.push("/dashboard");
    }
  }, [ready, authenticated, router]);

  const handleLogin = async (loginMethod?: string) => {
    setIsConnecting(true);
    setError(null);
    
    try {
      if (loginMethod === 'wallet') {
        // For wallet connection, use connectWallet
        await connectWallet();
      } else {
        // For social logins, use login
        await login();
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Failed to connect. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-900 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Panel - Auth Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-semibold">Multi-RPC</span>
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back
            </h1>
            <p className="text-gray-600">
              Connect your wallet to access your dashboard
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Auth Options */}
          <div className="space-y-4">
            {/* Primary Wallet Button */}
            <button
              onClick={() => handleLogin('wallet')}
              disabled={isConnecting}
              className="relative w-full btn-primary py-3 text-base group"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="w-5 h-5 mr-2" />
                  Connect Solana Wallet
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Social Login Options */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleLogin()}
                disabled={isConnecting}
                className="btn-secondary py-2.5 text-sm"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
              
              <button
                onClick={() => handleLogin()}
                disabled={isConnecting}
                className="btn-secondary py-2.5 text-sm"
              >
                <Twitter className="w-5 h-5 mr-2 text-blue-400" />
                Twitter
              </button>
            </div>

            <button
              onClick={() => handleLogin()}
              disabled={isConnecting}
              className="w-full btn-secondary py-2.5 text-sm"
            >
              <Mail className="w-5 h-5 mr-2" />
              Continue with Email
            </button>
          </div>

          {/* Benefits */}
          <div className="mt-8 space-y-3">
            {[
              { icon: Shield, text: "Secure authentication" },
              { icon: Zap, text: "Instant access to dashboard" },
              { icon: Lock, text: "Your keys, your control" },
            ].map((benefit, index) => (
              <div key={index} className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <benefit.icon className="w-4 h-4 text-gray-700" />
                </div>
                <span>{benefit.text}</span>
              </div>
            ))}
          </div>

          {/* Footer Links */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-xs text-center text-gray-500">
              By connecting, you agree to our{" "}
              <Link href="/terms" className="text-gray-700 hover:text-gray-900 underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-gray-700 hover:text-gray-900 underline">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Feature Showcase */}
      <div className="hidden lg:flex flex-1 bg-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
        
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="relative flex-1 flex items-center justify-center p-12">
          <div className="max-w-lg">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-gray-800 rounded-full px-4 py-1.5 mb-8">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-gray-300">Trusted by 10,000+ developers</span>
            </div>

            {/* Main Content */}
            <h2 className="text-4xl font-bold text-white mb-6">
              The most reliable RPC infrastructure for Solana
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Get instant access to 50+ global endpoints with 99.99% uptime guarantee. 
              No credit card required.
            </p>

            {/* Feature List */}
            <ul className="space-y-4 mb-12">
              {[
                "Automatic failover between endpoints",
                "Real-time performance analytics",
                "Enterprise-grade security",
                "24/7 dedicated support",
              ].map((feature, index) => (
                <li key={index} className="flex items-center gap-3 text-gray-300">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* Testimonial */}
            <div className="border-l-2 border-gray-700 pl-6">
              <p className="text-gray-300 italic mb-4">
                &quot;Multi-RPC saved us from countless outages. It&apos;s the backbone of our DeFi protocol.&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-700 rounded-full" />
                <div>
                  <p className="text-white font-medium">Sarah Chen</p>
                  <p className="text-sm text-gray-400">CTO at DeFi Protocol</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}