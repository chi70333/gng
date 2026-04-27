// Main page: ISR 60s. Product lists are cached in the service layer for traffic spikes.

import Link from 'next/link';
import ProductGrid from '@/components/shop/ProductGrid';
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
    <div className="mx-auto max-w-screen-xl space-y-12 px-4 py-6">
      <section
        className="relative min-h-[280px] overflow-hidden rounded-2xl bg-neutral-900 text-white"
        aria-label="메인 배너"
      >
        <div className="relative z-10 flex h-full flex-col justify-center px-8 py-12 md:px-16">
          <span className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">
            New Season
          </span>
          <h1 className="mb-4 text-3xl font-extrabold leading-tight md:text-5xl">
            새로운 상품을
            <br className="md:hidden" /> 만나보세요
          </h1>
          <p className="mb-6 max-w-sm text-sm text-neutral-300 md:text-base">
            지금 가장 인기 있는 스타일을 GNG에서 먼저 확인하세요.
          </p>
          <Link
            href={rootCategories[0] ? `/category/${rootCategories[0].slug}` : '/search'}
            className="inline-flex h-11 w-fit items-center justify-center rounded-xl bg-white px-6 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
          >
            쇼핑 시작하기
          </Link>
        </div>
      </section>

      {rootCategories.length > 0 && (
        <section aria-labelledby="category-heading">
          <h2 id="category-heading" className="mb-4 text-lg font-bold text-neutral-900">
            카테고리
          </h2>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {rootCategories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/category/${category.slug}`}
                  className="flex h-20 flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white px-2 text-center text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-900"
                >
                  {category.name}
                </Link>
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
        <ProductGrid
          products={bestProducts}
          priorityCount={4}
          canShowPrice={canShowPrice}
        />
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
        <ProductGrid
          products={newProducts}
          priorityCount={0}
          canShowPrice={canShowPrice}
        />
      </section>
    </div>
  );
}
