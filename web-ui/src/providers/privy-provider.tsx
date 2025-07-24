"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";

export default function PrivyProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["wallet", "google", "twitter"],
        appearance: {
          theme: "light",
          accentColor: "#3b82f6",
          logo: "/logo.png",
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
        defaultChain: {
          id: 101, // Solana Mainnet
          name: "Solana",
          network: "mainnet-beta",
          rpcUrls: {
            default: {
              http: [process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"],
            },
          },
        } as any,
        supportedChains: [
          {
            id: 101, // Solana Mainnet
            name: "Solana",
            network: "mainnet-beta",
            rpcUrls: {
              default: {
                http: [process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"],
              },
            },
          } as any,
        ],
      }}
      onSuccess={async (user) => {
        // Create or update user in database
        try {
          const response = await fetch("/api/auth/privy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              privyId: user.id,
              email: user.email?.address,
              wallet: user.wallet,
              linkedAccounts: user.linkedAccounts,
            }),
          });

          if (response.ok) {
            router.push("/dashboard");
          }
        } catch (error) {
          console.error("Error syncing user:", error);
        }
      }}
    >
      {children}
    </PrivyProvider>
  );
}