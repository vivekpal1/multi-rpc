"use client";

import { useEffect } from "react";
import { registerServiceWorker, setupOfflineDetection } from "@/lib/register-sw";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Register service worker
    registerServiceWorker();
    setupOfflineDetection();

    // Monitor web vitals
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
        onCLS?.(console.log);
        onINP?.(console.log);
        onFCP?.(console.log);
        onLCP?.(console.log);
        onTTFB?.(console.log);
      }).catch(() => {
        // Web vitals not available
      });
    }
  }, []);

  return <>{children}</>;
}