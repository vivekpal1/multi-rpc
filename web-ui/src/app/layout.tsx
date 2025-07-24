import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PrivyProviderWrapper from "@/providers/privy-provider";
import { WebSocketProvider } from "@/providers/websocket-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Multi-RPC - Enterprise Solana RPC Aggregation",
  description: "Maximize uptime and performance with intelligent load balancing across multiple RPC endpoints",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen antialiased`} suppressHydrationWarning>
        <PrivyProviderWrapper>
          <WebSocketProvider>
            <div className="relative min-h-screen">
              {children}
            </div>
          </WebSocketProvider>
        </PrivyProviderWrapper>
      </body>
    </html>
  );
}