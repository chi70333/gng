// unstable_cache 래퍼 및 표준 TTL / 태그 상수.
// DB 직접 호출하는 모든 페이지·함수는 반드시 이 모듈을 통해 캐싱.
// docs/01-architecture.md, docs/07-traffic.md

import { unstable_cache } from 'next/cache';

/** 표준 캐시 TTL (초) — docs/07-traffic.md */
export const TTL = {
  PRODUCT_DETAIL: 60,   // 상품 상세 60s + tag 무효화
  PRODUCT_LIST: 120,    // 상품 목록 2m
  CATEGORY_TREE: 300,   // 카테고리 트리 5m
  BANNER: 300,          // 배너 5m
  BEST_PRODUCTS: 300,   // 베스트/신상 5m
  FILTER_FACETS: 60,    // 필터 패싯 60s
} as const;

/** 캐시 태그 헬퍼 — revalidateTag(TAGS.product('slug')) 으로 특정 항목 무효화 */
export const TAGS = {
  product: (idOrSlug: string) => `product:${idOrSlug}`,
  productLegacy: (legacyId: string) => `product:legacy:${legacyId}`,
  productList: (categorySlug: string) => `product-list:${categorySlug}`,
  categoryTree: 'category-tree' as const,
  bestProducts: 'best-products' as const,
  newProducts: 'new-products' as const,
  filterFacets: (categorySlug: string) => `filter:${categorySlug}`,
} as const;

type CacheOptions = {
  revalidate: number | false;
  tags?: string[];
};

/**
 * unstable_cache 래퍼.
 * 반환 타입은 직렬화 가능해야 함 (BigInt/Decimal은 string으로 변환 후 캐싱).
 */
export function withCache<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyParts: string[],
  options: CacheOptions,
): (...args: TArgs) => Promise<TResult> {
  return unstable_cache(fn, keyParts, options);
}
