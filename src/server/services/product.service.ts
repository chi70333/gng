// 상품 서비스 레이어.
// unstable_cache 로 ISR 주기와 tag 기반 무효화를 관리.
// docs/07-traffic.md: 상품 목록 ISR 120s, 상세 ISR 60s + tag.

import { unstable_cache } from 'next/cache';
import { TTL, TAGS } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { keys, redis } from '@/server/redis';
import {
  getProductsByCategory,
  getProductBySlug,
  getProductMetadataBySlug,
  getProductRouteByLegacyId,
  incrementProductViewCountBySlug,
  getBestProducts,
  getNewProducts,
  getDashboardCategorySections,
  getProductSkusByProductId,
  getFilterFacets,
  type DashboardCategorySection,
  type ProductListParams,
  type ProductListResult,
  type ProductDetail,
  type ProductLegacyRoute,
  type ProductMetadata,
  type ProductSummary,
  type ProductSku,
} from '@/server/repositories/product.repository';

const PRODUCT_VIEW_DEDUPE_SECONDS = 60 * 30;

async function readThroughRedis<T>(
  key: string,
  ttl: number,
  load: () => Promise<T>,
): Promise<T> {
  try {
    const hit = await redis.get<T>(key);
    if (hit) return hit;
  } catch (err) {
    logger.warn({ err, key }, 'product Redis get failed, falling back to DB');
  }

  const value = await load();

  redis
    .set(key, value, { ex: ttl })
    .catch((err: unknown) => logger.warn({ err, key }, 'product Redis set failed'));

  return value;
}

/** 카테고리별 상품 목록 (ISR 120s, 카테고리 태그). */
export function getCachedProductsByCategory(
  params: ProductListParams,
): Promise<ProductListResult> {
  const { categorySlug, page = 1, sort = 'new', limit = 20 } = params;
  return unstable_cache(
    () =>
      readThroughRedis(
        keys.productList(categorySlug, page, sort, limit),
        TTL.PRODUCT_LIST,
        () => getProductsByCategory({ categorySlug, page, sort, limit }),
      ),
    [`product-list:${categorySlug}:${page}:${sort}:${limit}`],
    {
      revalidate: TTL.PRODUCT_LIST,
      tags: [TAGS.productList(categorySlug)],
    },
  )();
}

/** 상품 상세 (ISR 60s + 상품별 tag). */
export function getCachedProductBySlug(slug: string): Promise<ProductDetail | null> {
  return unstable_cache(
    () =>
      readThroughRedis(
        keys.product(slug),
        TTL.PRODUCT_DETAIL,
        () => getProductBySlug(slug),
      ),
    [`product-detail:${slug}`],
    {
      revalidate: TTL.PRODUCT_DETAIL,
      tags: [TAGS.product(slug)],
    },
  )();
}

/** Product view counter: no-store API mutation, Redis de-duped per visitor for 30m. */
export async function countProductView(
  slug: string,
  visitorId: string,
): Promise<{ counted: boolean; found: boolean }> {
  const dedupeKey = keys.productView(slug, visitorId);

  try {
    const reserved = await redis.set(dedupeKey, '1', {
      ex: PRODUCT_VIEW_DEDUPE_SECONDS,
      nx: true,
    });
    if (reserved !== 'OK') return { counted: false, found: true };
  } catch (err) {
    logger.warn({ err, slug }, 'product view Redis set failed, counting without de-dupe');
  }

  const found = await incrementProductViewCountBySlug(slug);
  if (!found) {
    redis
      .del(dedupeKey)
      .catch((err: unknown) => logger.warn({ err, slug }, 'product view Redis cleanup failed'));
    return { counted: false, found: false };
  }

  return { counted: true, found: true };
}

/** 베스트 상품 (ISR 5m). */
/** Product metadata only (ISR 60s + product tag). */
export function getCachedProductMetadataBySlug(
  slug: string,
): Promise<ProductMetadata | null> {
  return unstable_cache(
    () => getProductMetadataBySlug(slug),
    [`product-metadata:${slug}`],
    {
      revalidate: TTL.PRODUCT_DETAIL,
      tags: [TAGS.product(slug)],
    },
  )();
}

/** Legacy goodsIdx redirect lookup (ISR 60s + legacy tag). */
export function getCachedProductRouteByLegacyId(
  legacyId: number,
): Promise<ProductLegacyRoute | null> {
  const key = legacyId.toString();
  return unstable_cache(
    () =>
      readThroughRedis(
        keys.productLegacy(legacyId),
        TTL.PRODUCT_DETAIL,
        () => getProductRouteByLegacyId(legacyId),
      ),
    [`product-legacy-route:${key}`],
    {
      revalidate: TTL.PRODUCT_DETAIL,
      tags: [TAGS.productLegacy(key)],
    },
  )();
}

/** Best products (ISR 5m). */
export const getCachedBestProducts = unstable_cache(
  (limit = 8): Promise<ProductSummary[]> =>
    readThroughRedis(keys.bestProducts(limit), TTL.BEST_PRODUCTS, () =>
      getBestProducts(limit),
    ),
  ['best-products'],
  { revalidate: TTL.BEST_PRODUCTS, tags: [TAGS.bestProducts] },
);

/** 신상품 (ISR 5m). */
export const getCachedNewProducts = unstable_cache(
  (limit = 8): Promise<ProductSummary[]> =>
    readThroughRedis(keys.newProducts(limit), TTL.BEST_PRODUCTS, () =>
      getNewProducts(limit),
    ),
  ['new-products'],
  { revalidate: TTL.BEST_PRODUCTS, tags: [TAGS.newProducts] },
);

/** 메인 카테고리 섹션 (Redis 5m + ISR 5m). */
export const getCachedDashboardCategorySections = unstable_cache(
  (limitPerCategory = 8): Promise<DashboardCategorySection[]> =>
    readThroughRedis(
      keys.dashboardCategorySections(limitPerCategory),
      TTL.DASHBOARD_PRODUCTS,
      () => getDashboardCategorySections(limitPerCategory),
    ),
  ['dashboard-category-sections'],
  {
    revalidate: TTL.DASHBOARD_PRODUCTS,
    tags: [TAGS.dashboardCategorySections],
  },
);

/** SKU 목록 — options API 에서 Edge cache 30s. */
export function getCachedProductSkus(productId: string): Promise<ProductSku[]> {
  return unstable_cache(
    () => getProductSkusByProductId(productId),
    [`product-skus:${productId}`],
    { revalidate: 30, tags: [TAGS.product(productId)] },
  )();
}

/** 필터 패싯 (ISR 60s). */
export function getCachedFilterFacets(categorySlug: string) {
  return unstable_cache(
    () => getFilterFacets(categorySlug),
    [`filter-facets:${categorySlug}`],
    {
      revalidate: TTL.FILTER_FACETS,
      tags: [TAGS.filterFacets(categorySlug)],
    },
  )();
}
