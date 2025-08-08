import type { Metadata } from "next";
import "./globals.css";
import PrivyProviderWrapper from "@/providers/privy-provider";
import { WebSocketProvider } from "@/providers/websocket-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import ClientLayout from "./client-layout";

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
      <body className="min-h-screen antialiased font-sans" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PrivyProviderWrapper>
            <WebSocketProvider>
              <ClientLayout>
                <div className="relative min-h-screen">
                  {children}
                </div>
              </ClientLayout>
            </WebSocketProvider>
          </PrivyProviderWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}