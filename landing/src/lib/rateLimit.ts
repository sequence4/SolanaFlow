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

export const waitlistLimit = isTest
  ? (inMemoryLimiter as unknown as Pick<Ratelimit, 'limit'>) // eslint-disable-line @typescript-eslint/no-explicit-any
  : new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: false,
    }); 