"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export interface User {
  id: string;
  privyId: string;
  email?: string;
  walletAddress?: string;
  name?: string;
}

export function useAuth() {
  const router = useRouter();
  const { ready, authenticated, user: privyUser, logout, getAccessToken } = usePrivy();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
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
    await logout();
    setUser(null);
    router.push("/");
  };

  return {
    user,
    loading: loading || !ready,
    isAuthenticated: authenticated,
    signOut,
  };
}