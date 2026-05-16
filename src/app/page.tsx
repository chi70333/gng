// Main page: ISR 60s. Product lists are cached in the service layer for traffic spikes.

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Suspense } from 'react';
import Header, { HeaderShell } from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductGrid from '@/components/shop/ProductGrid';
import RegistrationNotice from '@/components/shop/RegistrationNotice';
import type { SerializedCategory } from '@/server/repositories/category.repository';
import { getCachedDashboardCategorySections } from '@/server/services/product.service';
import { getCachedCategoryTree } from '@/server/services/category.service';
import {
  DASHBOARD_ROTATION_CANDIDATE_COUNT,
  rotateDashboardProducts,
} from '@/lib/dashboard-rotation';
import { logger } from '@/lib/logger';

export const revalidate = 60; // ISR 60s

export default async function HomePage() {
  const [dashboardSections, categories] = await Promise.all([
    getCachedDashboardCategorySections(DASHBOARD_ROTATION_CANDIDATE_COUNT).catch((err: unknown) => {
      logger.error({ err }, 'HomePage: getDashboardCategorySections failed');
      return [];
    }),
    getCachedCategoryTree().catch((err: unknown) => {
      logger.error({ err }, 'HomePage: getCategoryTree failed');
      return [];
    }),
  ]);

  const rootCategories = categories.filter((category) => category.depth === 0);
  const rotatedDashboardSections = dashboardSections.map((section) => ({
    ...section,
    products: rotateDashboardProducts(section.products),
  }));

  return (
    <>
      <Suspense fallback={<HeaderShell categories={[]} />}>
        <Header />
      </Suspense>
      <main className="flex-1">
        <div className="mx-auto max-w-screen-xl space-y-12 px-4 py-6">
          <Suspense fallback={null}>
            <RegistrationNotice />
          </Suspense>

          {rootCategories.length > 0 && (
            <section aria-labelledby="category-heading" className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2
                    id="category-heading"
                    className="text-base font-bold tracking-normal text-neutral-950 md:text-lg"
                  >
                    카테고리
                  </h2>
                </div>
                <Link
                  href="/search"
                  className="inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-950"
                >
                  상품 검색
                  <ArrowRight aria-hidden="true" size={15} />
                </Link>
              </div>

              <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 lg:grid-cols-6">
                {rootCategories.map((category) => (
                  <li key={category.id} className="snap-start md:min-w-0">
                    <CategoryCard category={category} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rotatedDashboardSections.map((section, index) => (
            <section
              key={section.category.id}
              aria-labelledby={`dashboard-category-${section.category.id}`}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2
                  id={`dashboard-category-${section.category.id}`}
                  className="min-w-0 truncate text-lg font-bold text-neutral-900"
                >
                  {section.category.name}
                </h2>
                <Link
                  href={`/category/${section.category.slug}`}
                  className="inline-flex min-h-11 shrink-0 items-center text-sm text-neutral-500 transition-colors hover:text-neutral-800"
                >
                  전체보기
                </Link>
              </div>
              <ProductGrid products={section.products} priorityCount={index === 0 ? 4 : 0} />
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}

function CategoryCard({ category }: { category: SerializedCategory }) {
  return (
    <Link
      href={`/category/${category.slug}`}
      aria-label={`${category.name} 카테고리로 이동`}
      className="group inline-flex min-h-11 min-w-[92px] max-w-[52vw] items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-800 transition-colors hover:border-neutral-400 hover:bg-neutral-50 active:bg-neutral-100 md:w-full md:max-w-none md:justify-between"
    >
      <span className="min-w-0 truncate">{category.name}</span>
      <ArrowRight
        aria-hidden="true"
        size={14}
        className="hidden shrink-0 text-neutral-300 transition-colors group-hover:text-neutral-700 md:block"
      />
    </Link>
  );
}
