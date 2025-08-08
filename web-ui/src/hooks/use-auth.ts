"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export interface User {
  id: string;
  privyId: string;
  email?: string;
  walletAddress?: string;
  name?: string;
}

// Create a no-op hook for when Privy is not available
const usePrivyFallback = () => ({
  ready: true,
  authenticated: false,
  user: null,
  logout: () => Promise.resolve(),
  getAccessToken: () => Promise.resolve(null),
});

// Conditionally import Privy at module level
let usePrivyHook: any = usePrivyFallback;
if (process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
  try {
    const privyAuth = require("@privy-io/react-auth");
    if (privyAuth?.usePrivy) {
      usePrivyHook = privyAuth.usePrivy;
    }
  } catch (error) {
    console.log("Privy not configured, running without authentication");
  }
}

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Always call the same hook
  const { 
    ready = true, 
    authenticated = false, 
    user: privyUser = null, 
    logout = () => {}, 
    getAccessToken = () => null 
  } = usePrivyHook();

  useEffect(() => {
    async function fetchUser() {
      // If Privy is not configured, create a mock user
      if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
        setUser({
          id: "demo-user",
          privyId: "demo-user",
          email: "demo@example.com",
          name: "Demo User",
        });
        setLoading(false);
        return;
      }

      if (!ready || !authenticated || !privyUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        console.log("Fetching user data, privyUser:", privyUser?.id);
        const token = await getAccessToken();
        
        const response = await fetch("/api/user/me", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        
        if (!response.ok) {
          console.error("User API error:", response.status, response.statusText);
          if (response.status === 401) {
            setUser(null);
            router.push("/auth");
          }
          setLoading(false);
          return;
        }
        
        const userData = await response.json();
        console.log("User data received:", userData);
        setUser(userData);
      } catch (error) {
        console.error("Error fetching user:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [ready, authenticated, privyUser, router, getAccessToken]);

  const signOut = async () => {
    if (logout) {
      await logout();
    }
    setUser(null);
    router.push("/");
  };

  return {
    user,
    loading: loading || !ready,
    isAuthenticated: authenticated || !process.env.NEXT_PUBLIC_PRIVY_APP_ID,
    signOut,
  };
}