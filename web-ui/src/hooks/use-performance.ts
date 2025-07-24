import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  pageLoadTime: number;
  timeToFirstByte: number;
  domContentLoaded: number;
  resourceLoadTime: number;
  requestCount: number;
}

export function usePerformanceMonitoring(componentName: string) {
  const renderCount = useRef(0);
  const renderStartTime = useRef<number>(0);

  useEffect(() => {
    renderCount.current++;
    renderStartTime.current = performance.now();

    // Log render performance
    return () => {
      const renderDuration = performance.now() - renderStartTime.current;
      if (renderDuration > 16.67) { // More than one frame (60fps)
        console.warn(`[Performance] ${componentName} render took ${renderDuration.toFixed(2)}ms`);
      }
    };
  });

  useEffect(() => {
    // Log component mount count
    if (renderCount.current > 10) {
      console.warn(`[Performance] ${componentName} has rendered ${renderCount.current} times`);
    }
  }, [componentName]);
}

export function getPerformanceMetrics(): PerformanceMetrics | null {
  if (typeof window === 'undefined' || !window.performance) {
    return null;
  }

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  
  if (!navigation) {
    return null;
  }

  return {
    pageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
    timeToFirstByte: navigation.responseStart - navigation.requestStart,
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
    resourceLoadTime: navigation.loadEventEnd - navigation.responseEnd,
    requestCount: performance.getEntriesByType('resource').length,
  };
}

export function logPerformanceMetrics() {
  const metrics = getPerformanceMetrics();
  
  if (metrics) {
    console.log('[Performance Metrics]', {
      'Page Load Time': `${metrics.pageLoadTime.toFixed(2)}ms`,
      'Time to First Byte': `${metrics.timeToFirstByte.toFixed(2)}ms`,
      'DOM Content Loaded': `${metrics.domContentLoaded.toFixed(2)}ms`,
      'Resource Load Time': `${metrics.resourceLoadTime.toFixed(2)}ms`,
      'Total Requests': metrics.requestCount,
    });

    // Send to analytics if needed
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'performance', {
        event_category: 'Web Vitals',
        page_load_time: Math.round(metrics.pageLoadTime),
        ttfb: Math.round(metrics.timeToFirstByte),
      });
    }
  }
}

// Web Vitals monitoring
export function reportWebVitals(metric: any) {
  const { name, value, id } = metric;
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Web Vital] ${name}:`, value.toFixed(2));
  }

  // Send to analytics
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', name, {
      event_category: 'Web Vitals',
      event_label: id,
      value: Math.round(value),
      non_interaction: true,
    });
  }
}