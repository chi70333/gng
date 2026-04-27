// 카테고리/상품 목록 페이지 — ISR 120s.
// 레거시: goods_list.php, _goods_list.php
// URL: /category/[slug]?page=1&sort=new
// 캐시: unstable_cache 120s (product-list:<slug> 태그)

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import BreadcrumbNav from '@/components/shop/BreadcrumbNav';
import CategoryNav from '@/components/shop/CategoryNav';
import ProductGrid from '@/components/shop/ProductGrid';
import Pagination from '@/components/shop/Pagination';
import SortSelect from '@/components/shop/SortSelect';
import { getCachedProductsByCategory } from '@/server/services/product.service';
import {
  getCachedCategoryBySlug,
  getCachedCategoryTree,
  getCachedCategoryAncestors,
} from '@/server/services/category.service';
import { auth } from '@/server/auth';
import { canViewMemberPrice } from '@/server/auth-utils';
import { formatNumber } from '@/lib/format';
import type { SortOption } from '@/server/repositories/product.repository';

export const revalidate = 120; // ISR 120s

// ── 정적 파라미터 사전 생성 (빌드 타임 ISR) ──
export async function generateStaticParams() {
  try {
    const categories = await getCachedCategoryTree();
    // 모든 depth의 카테고리 포함
    const flatten = (cats: typeof categories): { slug: string }[] =>
      cats.flatMap((c) => [{ slug: c.slug }, ...flatten(c.children)]);
    return flatten(categories);
  } catch {
    return [];
  }
}

// ── 메타데이터 ──
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const cat = await getCachedCategoryBySlug(params.slug);
  if (!cat) return {};
  return {
    title: cat.name,
    description: `${cat.name} 카테고리의 최신 상품을 만나보세요.`,
    openGraph: { title: cat.name },
  };
}

// ── 페이지 ──
interface PageProps {
  params: { slug: string };
  searchParams: { page?: string; sort?: string };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const sort = (['new', 'popular', 'price_asc', 'price_desc'].includes(
    searchParams.sort ?? '',
  )
    ? searchParams.sort
    : 'new') as SortOption;

  const [session, category, result, categoryTree, ancestors] = await Promise.all([
    auth(),
    getCachedCategoryBySlug(params.slug),
    getCachedProductsByCategory({ categorySlug: params.slug, page, sort }),
    getCachedCategoryTree(),
    getCachedCategoryAncestors(params.slug),
  ]);

  if (!category) notFound();
  const canShowPrice = canViewMemberPrice(session);

  // 같은 부모를 가진 형제 카테고리 (사이드 네비용)
  const parentId = category.parentId;
  const siblings = parentId
    ? categoryTree
        .flatMap((c) => (c.id === parentId ? c.children : []))
        .filter((c) => c.isActive)
    : categoryTree.filter((c) => c.depth === 0 && c.isActive);

  // breadcrumb
  const breadcrumbs = [
    ...ancestors.map((a) => ({ label: a.name, href: `/category/${a.slug}` })),
    { label: category.name },
  ];

  // URL base (sort 파라미터 없이 페이지네이션 href 구성)
  const baseHref = `/category/${params.slug}?sort=${sort}`;

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-4">
      <BreadcrumbNav items={breadcrumbs} />

      {/* 모바일: 카테고리 탭 */}
      <div className="mb-4 md:hidden">
        <CategoryNav
          categories={siblings}
          activeSlug={params.slug}
          parentName={ancestors[ancestors.length - 1]?.name}
        />
      </div>

      <div className="flex gap-6">
        {/* 데스크톱: 사이드 카테고리 */}
        <div className="hidden md:block">
          <CategoryNav
            categories={siblings}
            activeSlug={params.slug}
            parentName={ancestors[ancestors.length - 1]?.name}
          />
        </div>

        {/* 메인 콘텐츠 */}
        <div className="flex-1 min-w-0">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-neutral-900">{category.name}</h1>
              <p className="text-sm text-neutral-400 mt-0.5">
                {formatNumber(result.total)}개 상품
              </p>
            </div>
            <Suspense fallback={null}>
              <SortSelect currentSort={sort} />
            </Suspense>
          </div>

          {/* 상품 그리드 */}
          <ProductGrid
            products={result.items}
            priorityCount={4}
            canShowPrice={canShowPrice}
          />

          {/* 페이지네이션 */}
          <Pagination
            currentPage={result.page}
            totalPages={result.totalPages}
            baseHref={baseHref}
          />
        </div>
      </div>
    </div>
  );
}
