// Legacy sources: search_result.php, search_post.php, suggest_search.php
// Search strategy: Meilisearch over HTTP, cached at the edge for 30s.

import { fetchJson } from '@/lib/http';
import { logger } from '@/lib/logger';
import type { SearchSortOption } from '@/schemas/search';
import type { ProductSummary } from '@/server/repositories/product.repository';

const SEARCH_REVALIDATE_SECONDS = 30;
const SEARCH_INDEX = process.env.MEILI_PRODUCT_INDEX ?? 'products';

type MeiliProductHit = {
  id: string | number;
  sku?: string;
  slug?: string;
  name?: string;
  summary?: string | null;
  price?: string | number;
  priceNumber?: number;
  salePrice?: string | number | null;
  status?: string;
  thumbnail?: string | null;
  soldCount?: number;
  viewCount?: number;
  reviewCount?: number;
  legacyId?: number | null;
  brand?: { id: string | number; name: string } | null;
};

type MeiliSearchResponse = {
  hits: MeiliProductHit[];
  estimatedTotalHits?: number;
  totalHits?: number;
};

export type ProductSearchResult = {
  items: ProductSummary[];
  total: number;
  page: number;
  totalPages: number;
  sort: SearchSortOption;
  legacy: {
    sortStr: string;
    sort: 'asc' | 'desc';
  };
};

export type ProductSuggestion = {
  label: string;
  href: string;
};

function meiliEndpoint(path: string): string | null {
  const host = process.env.MEILI_HOST?.replace(/\/$/, '');
  if (!host) return null;
  return `${host}${path}`;
}

function meiliHeaders(): HeadersInit {
  const key = process.env.MEILI_KEY;
  return key ? { Authorization: `Bearer ${key}` } : {};
}

function toProductSummary(hit: MeiliProductHit): ProductSummary | null {
  if (!hit.slug || !hit.name) return null;
  return {
    id: String(hit.id),
    sku: hit.sku ?? String(hit.id),
    slug: hit.slug,
    name: hit.name,
    summary: hit.summary ?? null,
    price: String(hit.price ?? 0),
    salePrice: hit.salePrice == null ? null : String(hit.salePrice),
    status: hit.status ?? 'active',
    thumbnail: hit.thumbnail ?? null,
    soldCount: hit.soldCount ?? 0,
    viewCount: hit.viewCount ?? 0,
    brand: hit.brand
      ? { id: String(hit.brand.id), name: hit.brand.name }
      : null,
  };
}

function toMeiliSort(sort: SearchSortOption): string[] | undefined {
  if (sort === 'new') return ['legacyId:desc', 'createdAt:desc'];
  if (sort === 'old') return ['legacyId:asc', 'createdAt:asc'];
  if (sort === 'popular') return ['viewCount:desc'];
  if (sort === 'price_asc') return ['priceNumber:asc'];
  if (sort === 'price_desc') return ['priceNumber:desc'];
  if (sort === 'sale_count') return ['soldCount:desc'];
  if (sort === 'review_count') return ['reviewCount:desc'];
  return undefined;
}

function toLegacySort(sort: SearchSortOption): ProductSearchResult['legacy'] {
  if (sort === 'new') return { sortStr: 'idx', sort: 'desc' };
  if (sort === 'old') return { sortStr: 'idx', sort: 'asc' };
  if (sort === 'popular') return { sortStr: 'readCnt', sort: 'desc' };
  if (sort === 'price_asc') return { sortStr: 'price', sort: 'asc' };
  if (sort === 'price_desc') return { sortStr: 'price', sort: 'desc' };
  if (sort === 'sale_count') return { sortStr: 'saleCount', sort: 'desc' };
  if (sort === 'review_count') return { sortStr: 'reviewCount', sort: 'desc' };
  return { sortStr: 'ranking', sort: 'asc' };
}

export async function searchProducts(params: {
  q: string;
  page: number;
  limit: number;
  sort: SearchSortOption;
}): Promise<ProductSearchResult> {
  const endpoint = meiliEndpoint(`/indexes/${SEARCH_INDEX}/search`);
  const legacySort = toLegacySort(params.sort);
  if (!endpoint) {
    logger.warn('MEILI_HOST is not configured; returning empty search result');
    return {
      items: [],
      total: 0,
      page: params.page,
      totalPages: 0,
      sort: params.sort,
      legacy: legacySort,
    };
  }

  const offset = (params.page - 1) * params.limit;
  const sort = toMeiliSort(params.sort);

  try {
    const result = await fetchJson<MeiliSearchResponse>(endpoint, {
      method: 'POST',
      headers: meiliHeaders(),
      body: {
        q: params.q,
        limit: params.limit,
        offset,
        filter: 'status = "active"',
        ...(sort ? { sort } : {}),
      },
      next: {
        revalidate: SEARCH_REVALIDATE_SECONDS,
        tags: [`search:${params.q}`, `search-sort:${params.sort}`],
      },
    });

    const total = result.estimatedTotalHits ?? result.totalHits ?? result.hits.length;
    return {
      items: result.hits.map(toProductSummary).filter((p): p is ProductSummary => p !== null),
      total,
      page: params.page,
      totalPages: Math.ceil(total / params.limit),
      sort: params.sort,
      legacy: legacySort,
    };
  } catch (err) {
    logger.error({ err, q: params.q }, 'Meilisearch product search failed');
    return {
      items: [],
      total: 0,
      page: params.page,
      totalPages: 0,
      sort: params.sort,
      legacy: legacySort,
    };
  }
}

export async function suggestProducts(params: {
  q: string;
  limit: number;
}): Promise<ProductSuggestion[]> {
  const result = await searchProducts({
    q: params.q,
    page: 1,
    limit: params.limit,
    sort: 'relevance',
  });
  return result.items.map((product) => ({
    label: product.name,
    href: `/goods/${product.slug}`,
  }));
}
