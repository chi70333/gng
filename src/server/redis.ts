import { Redis } from '@upstash/redis';

// 세션/장바구니/캐시/rate-limit 의 1급 저장소. docs/07-traffic.md 참조.
export const isRedisConfigured =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

type MemoryEntry = {
  value: unknown;
  expiresAt: number | null;
};

const memoryStore = new Map<string, MemoryEntry>();

function isExpired(entry: MemoryEntry): boolean {
  return entry.expiresAt !== null && entry.expiresAt <= Date.now();
}

const memoryRedis = {
  get: async <T>(key: string): Promise<T | null> => {
    const entry = memoryStore.get(key);
    if (!entry) return null;
    if (isExpired(entry)) {
      memoryStore.delete(key);
      return null;
    }
    return entry.value as T;
  },
  set: async (
    key: string,
    value: unknown,
    options?: { ex?: number; nx?: boolean },
  ): Promise<'OK' | null> => {
    if (options?.nx && memoryStore.has(key)) {
      const entry = memoryStore.get(key);
      if (entry && !isExpired(entry)) return null;
    }

    memoryStore.set(key, {
      value,
      expiresAt: options?.ex ? Date.now() + options.ex * 1000 : null,
    });
    return 'OK';
  },
  del: async (key: string): Promise<number> => {
    const existed = memoryStore.delete(key);
    return existed ? 1 : 0;
  },
};

export const redis = isRedisConfigured
  ? Redis.fromEnv()
  : (memoryRedis as unknown as Redis);

/**
 * 런타임 네임스페이스 헬퍼. 어디서든 일관되게 키를 만든다.
 */
export const keys = {
  product: (id: bigint | number | string) => `product:${id}`,
  productLegacy: (legacyId: bigint | number | string) => `product:legacy:${legacyId}`,
  productList: (categorySlug: string, page: number, sort = 'new', limit = 20) =>
    `product:list:${categorySlug}:${page}:${sort}:${limit}`,
  bestProducts: (limit: number) => `product:best:${limit}`,
  newProducts: (limit: number) => `product:new:${limit}`,
  productView: (slug: string, visitorId: string) => `product:view:${slug}:${visitorId}`,
  categoryTree: () => 'category:tree',
  categoryLegacyIndex: (legacyIndex: number) => `category:legacy-index:${legacyIndex}`,
  bannerMain: () => 'banner:main',
  cartGuest: (cookieId: string) => `cart:guest:${cookieId}`,
  cartUser: (userId: bigint | number | string) => `cart:user:${userId}`,
  session: (sid: string) => `sess:${sid}`,
  skuLock: (skuId: bigint | number | string) => `lock:sku:${skuId}`,
  legacyRate: (tokenHash: string) => `rl:legacy:${tokenHash}`,
};
