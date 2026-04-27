// 카테고리 서비스 레이어.
// Redis 캐시 → Next.js 데이터 캐시 → DB 순으로 조회.
// docs/07-traffic.md: 인기 데이터는 Redis 캐시 우선.

import { unstable_cache } from 'next/cache';
import { redis, keys } from '@/server/redis';
import { logger } from '@/lib/logger';
import { TTL, TAGS } from '@/lib/cache';
import {
  getAllActiveCategories,
  getCategoryBySlug,
  getCategoryByLegacyIndex,
  getCategoryAncestors,
  buildCategoryTree,
  type LegacyCategoryMapping,
  type SerializedCategory,
} from '@/server/repositories/category.repository';

/**
 * 카테고리 트리 (Redis 5m + Next 데이터 캐시 5m).
 * 인기 최상위 데이터 — double caching으로 DB 부하 최소화.
 */
export const getCachedCategoryTree = unstable_cache(
  async (): Promise<SerializedCategory[]> => {
    // 1차: Redis
    try {
      const hit = await redis.get<SerializedCategory[]>(keys.categoryTree());
      if (hit) return hit;
    } catch (err) {
      logger.warn({ err }, 'category-tree Redis get failed, falling back to DB');
    }

    // 2차: DB
    const flat = await getAllActiveCategories();
    const tree = buildCategoryTree(flat);

    // Redis 저장 (실패해도 계속 진행)
    redis
      .set(keys.categoryTree(), tree, { ex: TTL.CATEGORY_TREE })
      .catch((err: unknown) =>
        logger.warn({ err }, 'category-tree Redis set failed'),
      );

    return tree;
  },
  ['category-tree'],
  { revalidate: TTL.CATEGORY_TREE, tags: [TAGS.categoryTree] },
);

/** slug 기준 카테고리 단건 (ISR 캐싱, 건별 태그). */
export function getCachedCategoryBySlug(slug: string) {
  return unstable_cache(
    () => getCategoryBySlug(slug),
    [`category-slug:${slug}`],
    { revalidate: TTL.CATEGORY_TREE, tags: [TAGS.categoryTree] },
  )();
}

/** breadcrumb 용 조상 목록 (ISR 캐싱). */
/**
 * legacy goods_list.php Index 매핑 (Next cache 120s + Redis 5m).
 * /goods_list.php?Index=N 호환 라우트가 /category/[slug]로 리다이렉트할 때 사용한다.
 */
export function getCachedCategoryByLegacyIndex(
  legacyIndex: number,
): Promise<LegacyCategoryMapping | null> {
  return unstable_cache(
    async () => {
      const key = keys.categoryLegacyIndex(legacyIndex);

      try {
        const hit = await redis.get<LegacyCategoryMapping>(key);
        if (hit) return hit;
      } catch (err) {
        logger.warn({ err, legacyIndex }, 'category legacy Redis get failed');
      }

      const mapping = await getCategoryByLegacyIndex(legacyIndex);
      if (mapping) {
        redis
          .set(key, mapping, { ex: TTL.CATEGORY_TREE })
          .catch((err: unknown) =>
            logger.warn({ err, legacyIndex }, 'category legacy Redis set failed'),
          );
      }

      return mapping;
    },
    [`category-legacy-index:${legacyIndex}`],
    { revalidate: TTL.PRODUCT_LIST, tags: [TAGS.categoryTree] },
  )();
}

export function getCachedCategoryAncestors(slug: string) {
  return unstable_cache(
    () => getCategoryAncestors(slug),
    [`category-ancestors:${slug}`],
    { revalidate: TTL.CATEGORY_TREE, tags: [TAGS.categoryTree] },
  )();
}
