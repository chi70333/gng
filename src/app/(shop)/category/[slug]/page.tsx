// 카테고리/상품 목록 페이지 — ISR 120s.
// 레거시: goods_list.php, _goods_list.php
// URL: /category/[slug]?page=1&sort=new
// 캐시: unstable_cache 120s (product-list:<slug> 태그)

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ChevronRight } from 'lucide-react';
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
import { cn } from '@/lib/cn';
import type { SortOption } from '@/server/repositories/product.repository';
import type { SerializedCategory } from '@/server/repositories/category.repository';

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

function findCategoryInTree(
  categories: SerializedCategory[],
  categoryId: string | null,
): SerializedCategory | null {
  if (!categoryId) return null;

  for (const category of categories) {
    if (category.id === categoryId) return category;
    const child = findCategoryInTree(category.children, categoryId);
    if (child) return child;
  }

  return null;
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const sort = (
    ['new', 'popular', 'price_asc', 'price_desc'].includes(searchParams.sort ?? '')
      ? searchParams.sort
      : 'new'
  ) as SortOption;

  const [session, category, result, categoryTree, ancestors] = await Promise.all([
    auth(),
    getCachedCategoryBySlug(params.slug),
    getCachedProductsByCategory({ categorySlug: params.slug, page, sort }),
    getCachedCategoryTree(),
    getCachedCategoryAncestors(params.slug),
  ]);

  if (!category || !category.isActive) notFound();
  const canShowPrice = canViewMemberPrice(session);

  // 같은 부모를 가진 형제 카테고리 (사이드 네비용)
  const currentTreeCategory = findCategoryInTree(categoryTree, category.id);
  const parentTreeCategory = findCategoryInTree(categoryTree, category.parentId);
  const siblings = parentTreeCategory
    ? parentTreeCategory.children.filter((c) => c.isActive)
    : categoryTree.filter((c) => c.depth === 0 && c.isActive);
  const rootCategories = categoryTree.filter((c) => c.depth === 0 && c.isActive);
  const activeAncestorSlugs = ancestors.map((ancestor) => ancestor.slug);
  const mobileCategories =
    currentTreeCategory && currentTreeCategory.children.length > 0
      ? currentTreeCategory.children.filter((c) => c.isActive)
      : siblings;

  // breadcrumb
  const breadcrumbs = [
    ...ancestors.map((a) => ({ label: a.name, href: `/category/${a.slug}` })),
    { label: category.name },
  ];
  const parentCategory = ancestors[ancestors.length - 1];

  // URL base (sort 파라미터 없이 페이지네이션 href 구성)
  const baseHref = `/category/${params.slug}?sort=${sort}`;

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-4">
      <BreadcrumbNav items={breadcrumbs} />

      {/* 모바일: 카테고리 탭 */}
      <div className="mb-4 md:hidden">
        <CategoryNav
          categories={mobileCategories}
          activeSlug={params.slug}
          parentName={
            currentTreeCategory?.children.length
              ? category.name
              : ancestors[ancestors.length - 1]?.name
          }
        />
      </div>

      <div className="flex gap-6">
        {/* 데스크톱: 사이드 카테고리 */}
        <div className="hidden md:block">
          <CategoryNav
            categories={rootCategories}
            activeSlug={params.slug}
            activeAncestorSlugs={activeAncestorSlugs}
          />
        </div>

        {/* 메인 콘텐츠 */}
        <div className="min-w-0 flex-1">
          {/* 헤더 */}
          <div className="mb-5 flex flex-col gap-3 border-b border-neutral-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              {parentCategory && (
                <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
                  <Link
                    href={`/category/${parentCategory.slug}`}
                    aria-label={`${parentCategory.name} 상위 카테고리로 이동`}
                    className="inline-flex min-h-11 max-w-full items-center font-bold text-neutral-950 transition-colors hover:text-neutral-600"
                  >
                    <span className="truncate text-2xl md:text-3xl">{parentCategory.name}</span>
                  </Link>
                  <ChevronRight
                    size={18}
                    className="shrink-0 text-neutral-300"
                    aria-hidden="true"
                  />
                  <span className="inline-flex min-h-8 items-center rounded-full bg-neutral-100 px-2.5 text-xs font-semibold text-neutral-600">
                    하위 카테고리
                  </span>
                </div>
              )}
              <h1
                className={cn(
                  'truncate font-bold text-neutral-950',
                  parentCategory ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl',
                )}
              >
                {category.name}
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                {parentCategory ? `${parentCategory.name}의 하위 카테고리 · ` : ''}
                {formatNumber(result.total)}개 상품
              </p>
            </div>
            <Suspense fallback={null}>
              <SortSelect currentSort={sort} />
            </Suspense>
          </div>

          {/* 상품 그리드 */}
          <ProductGrid products={result.items} priorityCount={4} canShowPrice={canShowPrice} />

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
