import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/server/redis';

// 사전 정의된 rate-limit 프로필. docs/07-traffic.md 참조.
export const rateLimiters = {
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    prefix: 'rl:auth',
  }),
  search: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    prefix: 'rl:search',
  }),
  cart: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    prefix: 'rl:cart',
  }),
  legacy: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    prefix: 'rl:legacy',
  }),
};

export type RateLimiterKey = keyof typeof rateLimiters;
