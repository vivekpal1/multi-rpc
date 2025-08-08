import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiCache } from '@/lib/api-cache';

interface PrefetchOptions {
  delay?: number;
  priority?: 'high' | 'low';
}

export function usePrefetch() {
  const router = useRouter();
  const prefetchQueue = useRef<Set<string>>(new Set());

  const prefetchRoute = useCallback((href: string, options?: PrefetchOptions) => {
    const { delay = 0, priority = 'low' } = options || {};

    if (prefetchQueue.current.has(href)) return;
    prefetchQueue.current.add(href);

    const doPrefetch = () => {
      // Prefetch the route
      router.prefetch(href);

      // Also prefetch API data if it's a dashboard route
      if (href.startsWith('/dashboard')) {
        prefetchDashboardData(href);
      }
    };

    if (priority === 'high') {
      requestIdleCallback(doPrefetch, { timeout: 1000 });
    } else {
      setTimeout(() => {
        requestIdleCallback(doPrefetch);
      }, delay);
    }
  }, [router]);

  return { prefetchRoute };
}

// Prefetch data for dashboard routes
async function prefetchDashboardData(route: string) {
  const token = localStorage.getItem('access_token');
  if (!token) return;

  const headers = { Authorization: `Bearer ${token}` };

  switch (route) {
    case '/dashboard':
      // Prefetch dashboard data
      fetch('/api/user/dashboard', { headers })
        .then(res => res.json())
        .then(data => apiCache.set('/api/user/dashboard', data, 300000));
      break;
    
    case '/dashboard/keys':
      // Prefetch API keys
      fetch('/api/keys', { headers })
        .then(res => res.json())
        .then(data => apiCache.set('/api/keys', data, 60000));
      break;
    
    case '/dashboard/analytics':
      // Prefetch analytics data
      fetch('/api/rpc/analytics?range=7d', { headers })
        .then(res => res.json())
        .then(data => apiCache.set('/api/rpc/analytics?range=7d', data, 300000));
      break;
  }
}

// Hook to prefetch on hover
export function usePrefetchOnHover(href: string, enabled = true) {
  const { prefetchRoute } = usePrefetch();
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleMouseEnter = useCallback(() => {
    if (!enabled) return;
    
    timeoutRef.current = setTimeout(() => {
      prefetchRoute(href, { priority: 'high' });
    }, 100);
  }, [href, enabled, prefetchRoute]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  };
}

// Hook to prefetch visible links
export function usePrefetchVisible() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const link = entry.target as HTMLAnchorElement;
            const href = link.getAttribute('href');
            if (href && href.startsWith('/dashboard')) {
              // Prefetch when link is visible
              requestIdleCallback(() => {
                router.prefetch(href);
                prefetchDashboardData(href);
              });
            }
          }
        });
      },
      {
        rootMargin: '50px',
      }
    );

    // Observe all dashboard links
    const links = document.querySelectorAll('a[href^="/dashboard"]');
    links.forEach(link => observer.observe(link));

    return () => observer.disconnect();
  }, []);
}