// Main page: ISR 60s. Product lists are cached in the service layer for traffic spikes.

import Link from 'next/link';
import {
  ArrowRight,
  BadgePercent,
  Gift,
  Grid3X3,
  PackageSearch,
  Shirt,
  ShoppingBasket,
  Sparkles,
  Tag,
} from 'lucide-react';
import { Suspense } from 'react';
import Header, { HeaderShell } from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductGrid from '@/components/shop/ProductGrid';
import type { SerializedCategory } from '@/server/repositories/category.repository';
import { getCachedBestProducts, getCachedNewProducts } from '@/server/services/product.service';
import { getCachedCategoryTree } from '@/server/services/category.service';
import { auth } from '@/server/auth';
import { canViewMemberPrice } from '@/server/auth-utils';
import { logger } from '@/lib/logger';

export const revalidate = 60; // ISR 60s

export default async function HomePage() {
  const [session, bestProducts, newProducts, categories] = await Promise.all([
    auth(),
    getCachedBestProducts(8).catch((err: unknown) => {
      logger.error({ err }, 'HomePage: getBestProducts failed');
      return [];
    }),
    getCachedNewProducts(8).catch((err: unknown) => {
      logger.error({ err }, 'HomePage: getNewProducts failed');
      return [];
    }),
    getCachedCategoryTree().catch((err: unknown) => {
      logger.error({ err }, 'HomePage: getCategoryTree failed');
      return [];
    }),
  ]);

  const canShowPrice = canViewMemberPrice(session);
  const rootCategories = categories.filter((category) => category.depth === 0);

  return (
    <>
      <Suspense fallback={<HeaderShell categories={[]} isAuthenticated={false} />}>
        <Header />
      </Suspense>
      <main className="flex-1">
        <div className="mx-auto max-w-screen-xl space-y-12 px-4 py-6">
          {rootCategories.length > 0 && (
            <section aria-labelledby="category-heading" className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-neutral-500">빠른 쇼핑</p>
                  <h2
                    id="category-heading"
                    className="mt-1 text-xl font-extrabold text-neutral-950"
                  >
                    카테고리 둘러보기
                  </h2>
                </div>
                <Link
                  href="/search"
                  className="inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-neutral-600 transition-colors hover:text-neutral-950"
                >
                  상품 검색
                  <ArrowRight aria-hidden="true" size={15} />
                </Link>
              </div>

              <ul className="flex snap-x gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-4">
                {rootCategories.map((category, index) => (
                  <li key={category.id} className="min-w-[154px] snap-start md:min-w-0">
                    <CategoryCard category={category} index={index} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="best-heading">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="best-heading" className="text-lg font-bold text-neutral-900">
                베스트
              </h2>
              <Link
                href="/best"
                className="text-sm text-neutral-500 transition-colors hover:text-neutral-800"
              >
                전체보기
              </Link>
            </div>
            <ProductGrid products={bestProducts} priorityCount={4} canShowPrice={canShowPrice} />
          </section>

          <section aria-labelledby="new-heading">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="new-heading" className="text-lg font-bold text-neutral-900">
                신상품
              </h2>
              <Link
                href="/new"
                className="text-sm text-neutral-500 transition-colors hover:text-neutral-800"
              >
                전체보기
              </Link>
            </div>
            <ProductGrid products={newProducts} priorityCount={0} canShowPrice={canShowPrice} />
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

const categoryIcons = [
  Shirt,
  Sparkles,
  Gift,
  ShoppingBasket,
  BadgePercent,
  PackageSearch,
  Tag,
  Grid3X3,
] as const;

function CategoryCard({ category, index }: { category: SerializedCategory; index: number }) {
  const Icon = categoryIcons[index % categoryIcons.length] ?? Grid3X3;
  const previewChildren = category.children.slice(0, 2);
  const childCount = category.children.length;

  return (
    <Link
      href={`/category/${category.slug}`}
      aria-label={`${category.name} 카테고리로 이동`}
      className="group flex min-h-[132px] flex-col justify-between rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition-colors hover:border-neutral-400 hover:bg-neutral-50 active:bg-neutral-100 md:min-h-[150px] md:p-4"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 transition-colors group-hover:bg-neutral-900 group-hover:text-white">
          <Icon aria-hidden="true" size={21} strokeWidth={1.8} />
        </span>
        <ArrowRight
          aria-hidden="true"
          size={17}
          className="mt-1 text-neutral-300 transition-colors group-hover:text-neutral-900"
        />
      </span>

      <span className="mt-5 block">
        <span className="line-clamp-2 min-h-10 text-base font-bold leading-5 text-neutral-950">
          {category.name}
        </span>
        <span className="mt-2 flex min-h-6 flex-wrap gap-1 overflow-hidden">
          {previewChildren.length > 0 ? (
            previewChildren.map((child) => (
              <span
                key={child.id}
                className="max-w-full truncate rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600"
              >
                {child.name}
              </span>
            ))
          ) : (
            <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-500">
              추천 상품
            </span>
          )}
        </span>
        <span className="mt-2 block text-xs font-medium text-neutral-500">
          {childCount > 0 ? `하위 카테고리 ${childCount}개` : '바로 쇼핑하기'}
        </span>
      </span>
    </Link>
  );
}
