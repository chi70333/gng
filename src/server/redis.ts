import { Redis } from '@upstash/redis';

// Upstash Redis REST 클라이언트.
// 세션/장바구니/캐시/rate-limit 의 1급 저장소. docs/07-traffic.md 참조.
export const isRedisConfigured =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

const noopRedis = {
  get: async <T>(): Promise<T | null> => null,
  set: async (): Promise<'OK'> => 'OK',
  del: async (): Promise<number> => 0,
};

export const redis = isRedisConfigured
  ? Redis.fromEnv()
  : (noopRedis as unknown as Redis);

/**
 * 키 네임스페이스 헬퍼. 어디서든 일관되게 쓸 것.
 */
export const keys = {
  product: (id: bigint | number | string) => `product:${id}`,
  productLegacy: (legacyId: bigint | number | string) => `product:legacy:${legacyId}`,
  productList: (categorySlug: string, page: number, sort = 'new', limit = 20) =>
    `product:list:${categorySlug}:${page}:${sort}:${limit}`,
  bestProducts: (limit: number) => `product:best:${limit}`,
  newProducts: (limit: number) => `product:new:${limit}`,
  categoryTree: () => 'category:tree',
  categoryLegacyIndex: (legacyIndex: number) => `category:legacy-index:${legacyIndex}`,
  bannerMain: () => 'banner:main',
  cartGuest: (cookieId: string) => `cart:guest:${cookieId}`,
  cartUser: (userId: bigint | number | string) => `cart:user:${userId}`,
  session: (sid: string) => `sess:${sid}`,
  skuLock: (skuId: bigint | number | string) => `lock:sku:${skuId}`,
  legacyRate: (tokenHash: string) => `rl:legacy:${tokenHash}`,
};
