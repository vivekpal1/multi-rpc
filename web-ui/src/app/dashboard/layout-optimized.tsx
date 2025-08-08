"use client";

import { Suspense, lazy, memo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Home,
  Key,
  Activity,
  Settings,
  CreditCard,
  Globe,
  Shield,
  User,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Skeleton } from "@/components/ui/skeleton";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "API Keys", href: "/dashboard/keys", icon: Key },
  { name: "Analytics", href: "/dashboard/analytics", icon: Activity },
  { name: "Endpoints", href: "/dashboard/endpoints", icon: Globe },
  { name: "Monitoring", href: "/dashboard/monitoring", icon: Shield },
  { name: "Billing", href: "/dashboard/billing", icon: CreditCard },
  { name: "Profile", href: "/dashboard/profile", icon: User },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

const NavItem = memo(({ item, pathname, onClick }: any) => (
  <Link
    href={item.href}
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
      pathname === item.href
        ? "bg-primary text-primary-foreground"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
    )}
  >
    <item.icon className="h-5 w-5" />
    {item.name}
  </Link>
));

NavItem.displayName = "NavItem";

const Sidebar = memo(({ pathname, onClose }: any) => (
  <div className="flex flex-col h-full">
    <div className="p-4 border-b">
      <h2 className="text-xl font-bold">Multi-RPC</h2>
    </div>
    <nav className="flex-1 p-4 space-y-1">
      {navigation.map((item) => (
        <NavItem key={item.name} item={item} pathname={pathname} onClick={onClose} />
      ))}
    </nav>
  </div>
));

Sidebar.displayName = "Sidebar";

export default function OptimizedDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { logout } = usePrivy();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r lg:bg-white dark:lg:bg-gray-950">
        <Sidebar pathname={pathname} />
      </div>

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          mobileMenuOpen ? "block" : "hidden"
        )}
      >
        <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
        <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-950">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-bold">Multi-RPC</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <Sidebar pathname={pathname} onClose={() => setMobileMenuOpen(false)} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white dark:bg-gray-950 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-4 ml-auto">
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Suspense
            fallback={
              <div className="p-6 space-y-6">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-96 w-full" />
              </div>
            }
          >
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}