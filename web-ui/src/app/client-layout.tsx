"use client";

import { useEffect } from "react";
import { registerServiceWorker, setupOfflineDetection } from "@/lib/register-sw";
import { reportWebVitals } from "@/hooks/use-performance";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Register service worker
    registerServiceWorker();
    setupOfflineDetection();

    // Monitor web vitals
    if (typeof window !== 'undefined' && 'web-vital' in window) {
      import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
        getCLS(reportWebVitals);
        getFID(reportWebVitals);
        getFCP(reportWebVitals);
        getLCP(reportWebVitals);
        getTTFB(reportWebVitals);
      });
    }
  }, []);

  return <>{children}</>;
}