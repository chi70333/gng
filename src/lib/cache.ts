// unstable_cache 래퍼 및 표준 TTL / 태그 상수.
// DB 직접 호출하는 모든 페이지·함수는 반드시 이 모듈을 통해 캐싱.
// docs/01-architecture.md, docs/07-traffic.md

import { unstable_cache } from 'next/cache';

/** 표준 캐시 TTL (초) — docs/07-traffic.md */
export const TTL = {
  PRODUCT_DETAIL: 60 * 60 * 6,   // 상품 상세 6h + tag 무효화
  PRODUCT_LIST: 60 * 60 * 6,     // 상품 목록 6h
  CATEGORY_TREE: 60 * 60 * 24,   // 카테고리 트리 24h
  BANNER: 60 * 60 * 6,           // 배너 6h
  BEST_PRODUCTS: 60 * 60 * 6,    // 베스트/신상 6h
  DASHBOARD_PRODUCTS: 60 * 60 * 6, // 메인 카테고리 섹션 6h
  FILTER_FACETS: 60 * 60 * 6,    // 필터 패싯 6h
  BOARD_LIST: 60 * 60 * 6,       // 공개 게시판 목록 6h
  STALE_READ: 60 * 60 * 24 * 30, // 읽기 캐시 stale 보관 30d
  REFRESH_LOCK: 30,              // 같은 캐시 키 DB 재생성 중복 방지 30s
} as const;

/** 캐시 태그 헬퍼 — revalidateTag(TAGS.product('slug')) 으로 특정 항목 무효화 */
export const TAGS = {
  product: (idOrSlug: string) => `product:${idOrSlug}`,
  productLegacy: (legacyId: string) => `product:legacy:${legacyId}`,
  productList: (categorySlug: string) => `product-list:${categorySlug}`,
  categoryTree: 'category-tree' as const,
  dashboardCategorySections: 'dashboard-category-sections' as const,
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
