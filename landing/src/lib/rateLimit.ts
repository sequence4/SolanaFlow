import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type LimitResult = { success: boolean; reset: number };

const isTest = process.env.NODE_ENV === 'test';

const inMemoryLimiter = {
  _hits: new Map<string, number>(),
  async limit(ip: string): Promise<LimitResult> {
    const now = Date.now();
    const reset = now + 60_000;
    const hits = this._hits.get(ip) ?? 0;

    if (hits >= 5) return { success: false, reset };
    this._hits.set(ip, hits + 1);
    return { success: true, reset };
  }
};

const hasUpstashCreds =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

export const waitlistLimit = isTest
  ? (inMemoryLimiter as unknown as Pick<Ratelimit, 'limit'>)
  : hasUpstashCreds
    ? new Ratelimit({
        redis: new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        }),
        limiter: Ratelimit.slidingWindow(20, '1 h'),
        analytics: true,
      })
    : {
        limit: async () => ({ success: true, reset: 0 }),
      } as const; 