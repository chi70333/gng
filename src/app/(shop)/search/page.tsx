// Legacy sources: search_result.php, search_post.php
// Cache: Meilisearch fetch uses next revalidate 30s + search:<query> tag.
// Compatibility: preserves searchstring, sortStr, detail, name, sty_num while normalizing q/sort.

import type { Metadata } from 'next';
import ProductGrid from '@/components/shop/ProductGrid';
import Pagination from '@/components/shop/Pagination';
import { formatNumber } from '@/lib/format';
import { auth } from '@/server/auth';
import { canViewMemberPrice } from '@/server/auth-utils';
import { searchProducts } from '@/server/services/search.service';
import { searchQuerySchema } from '@/schemas/search';

export const revalidate = 30;

export const metadata: Metadata = {
  title: '검색',
  description: '상품명과 운영 검색 파라미터를 지원하는 상품 검색 결과입니다.',
};

type SearchPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSearchParams(searchParams: SearchPageProps['searchParams']) {
  return Object.fromEntries(
    Object.entries(searchParams).map(([key, value]) => [key, firstParam(value)]),
  );
}

function buildSearchBaseHref(searchParams: SearchPageProps['searchParams']) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (key === 'page') return;
    const first = firstParam(value);
    if (first) params.set(key, first);
  });
  return `/search?${params.toString()}`;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const parsed = searchQuerySchema.safeParse({
    ...normalizeSearchParams(searchParams),
    page: firstParam(searchParams.page) ?? '1',
    limit: 20,
  });

  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-screen-xl px-4 py-8">
        <h1 className="text-xl font-bold text-neutral-900">검색</h1>
        <p className="mt-8 text-center text-sm text-neutral-400">
          상품을 찾으려면 검색어를 입력해 주세요.
        </p>
      </div>
    );
  }

  const [session, result] = await Promise.all([
    auth(),
    searchProducts(parsed.data),
  ]);
  const canShowPrice = canViewMemberPrice(session);
  const baseHref = buildSearchBaseHref(searchParams);

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-4">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-neutral-900">검색</h1>
        <p className="mt-1 text-sm text-neutral-500">
          &quot;{parsed.data.q}&quot; 검색 결과 {formatNumber(result.total)}개
        </p>
      </div>

      <ProductGrid
        products={result.items}
        priorityCount={4}
        canShowPrice={canShowPrice}
      />
      <Pagination
        currentPage={result.page}
        totalPages={result.totalPages}
        baseHref={baseHref}
      />
    </div>
  );
}
