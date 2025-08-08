import { prisma } from './prisma';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

export class RateLimiter {
  private static cache = new Map<string, { count: number; resetAt: Date }>();

  /**
   * Check rate limit for a given key
   */
  static async check(
    identifier: string,
    limit: number,
    window: number = 1 // in seconds
  ): Promise<RateLimitResult> {
    const now = new Date();
    const resetAt = new Date(now.getTime() + window * 1000);
    const cacheKey = `${identifier}:${Math.floor(now.getTime() / (window * 1000))}`;

    // Check in-memory cache first
    let current = this.cache.get(cacheKey);
    
    if (!current) {
      current = { count: 0, resetAt };
      this.cache.set(cacheKey, current);
      
      // Clean up old entries
      this.cleanup();
    }

    current.count++;
    const allowed = current.count <= limit;
    const remaining = Math.max(0, limit - current.count);

    return {
      allowed,
      limit,
      remaining,
      reset: resetAt,
      retryAfter: allowed ? undefined : Math.ceil((resetAt.getTime() - now.getTime()) / 1000),
    };
  }

  /**
   * Check usage limits (daily/monthly)
   */
  static async checkUsage(
    userId: string,
    keyId: string,
    dailyLimit: number,
    monthlyLimit: number
  ): Promise<{ allowed: boolean; dailyUsage: number; monthlyUsage: number }> {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    try {
      // Get usage stats
      const [dailyUsage, monthlyUsage] = await Promise.all([
        prisma.usage.aggregate({
          where: {
            userId,
            apiKeyId: keyId,
            date: { gte: startOfDay },
          },
          _sum: { requests: true },
        }),
        prisma.usage.aggregate({
          where: {
            userId,
            apiKeyId: keyId,
            date: { gte: startOfMonth },
          },
          _sum: { requests: true },
        }),
      ]);

      const daily = Number(dailyUsage._sum.requests || 0);
      const monthly = Number(monthlyUsage._sum.requests || 0);

      return {
        allowed: daily < dailyLimit && monthly < monthlyLimit,
        dailyUsage: daily,
        monthlyUsage: monthly,
      };
    } catch (error) {
      console.error('Error checking usage limits:', error);
      // Allow request if database is unavailable
      return { allowed: true, dailyUsage: 0, monthlyUsage: 0 };
    }
  }

  /**
   * Record API usage
   */
  static async recordUsage(
    userId: string,
    keyId: string,
    method: string,
    success: boolean,
    latency: number,
    bytesIn: number = 0,
    bytesOut: number = 0
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      await prisma.usage.upsert({
        where: {
          userId_date: {
            userId,
            date: today,
          },
        },
        update: {
          requests: { increment: 1 },
          successCount: success ? { increment: 1 } : undefined,
          errorCount: !success ? { increment: 1 } : undefined,
          bytesIn: { increment: bytesIn },
          bytesOut: { increment: bytesOut },
        },
        create: {
          userId,
          apiKeyId: keyId,
          date: today,
          requests: 1,
          successCount: success ? 1 : 0,
          errorCount: !success ? 1 : 0,
          bytesIn,
          bytesOut,
        },
      });

      // Method stats could be tracked here if we add a MethodStat model
      // For now, we're just tracking overall usage
    } catch (error) {
      console.error('Error recording usage:', error);
    }
  }

  /**
   * Clean up old cache entries
   */
  private static cleanup() {
    const now = Date.now();
    this.cache.forEach((value, key) => {
      if (value.resetAt.getTime() < now) {
        this.cache.delete(key);
      }
    });
  }

  /**
   * Get rate limit headers
   */
  static getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    return {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.reset.toISOString(),
      ...(result.retryAfter && { 'Retry-After': result.retryAfter.toString() }),
    };
  }
}