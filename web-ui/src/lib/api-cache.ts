interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class APICache {
  private cache = new Map<string, CacheEntry>();
  private defaultTTL = 60000; // 1 minute default TTL

  set(key: string, data: any, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  clearExpired(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
export const apiCache = new APICache();

// Cached fetch wrapper
export async function cachedFetch(
  url: string,
  options?: RequestInit,
  ttl?: number
): Promise<any> {
  const cacheKey = `${url}-${JSON.stringify(options?.body || {})}`;
  
  // Check cache first
  const cached = apiCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch if not cached
  const response = await fetch(url, options);
  if (response.ok) {
    const data = await response.json();
    apiCache.set(cacheKey, data, ttl);
    return data;
  }
  
  throw new Error(`Failed to fetch: ${response.statusText}`);
}

// Clean expired entries periodically
if (typeof window !== 'undefined') {
  setInterval(() => {
    apiCache.clearExpired();
  }, 60000); // Clean every minute
}