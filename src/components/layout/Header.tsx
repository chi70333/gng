import Link from 'next/link';
import { Search, ShoppingBag } from 'lucide-react';
import MobileMenuDrawer from './MobileMenuDrawer';
import HeaderAccountActions from './HeaderAccountActions';
import { logger } from '@/lib/logger';
import type { SerializedCategory } from '@/server/repositories/category.repository';
import { getCachedCategoryTree } from '@/server/services/category.service';

export default async function Header() {
  let categories: SerializedCategory[] = [];

  try {
    categories = await getCachedCategoryTree();
  } catch (err) {
    logger.error({ err }, 'Header: getCachedCategoryTree failed');
  }

  return <HeaderShell categories={categories} />;
}

export function HeaderShell({
  categories,
}: {
  categories: SerializedCategory[];
}) {
  const rootCategories = categories.filter((category) => category.depth === 0);

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white">
      <div className="relative mx-auto flex h-14 max-w-screen-xl items-center gap-2 px-4 md:gap-3">
        <MobileMenuDrawer
          categories={categories}
        />

        <Link
          href="/"
          className="absolute left-1/2 flex min-h-11 min-w-11 -translate-x-1/2 items-center justify-center text-xl font-extrabold tracking-normal text-neutral-900 md:static md:mr-2 md:translate-x-0 md:justify-start"
        >
          GNG
        </Link>

        <nav
          className="hidden flex-1 items-center gap-1 overflow-hidden md:flex"
          aria-label="주요 카테고리"
        >
          {rootCategories.map((category) => (
            <Link
              key={category.id}
              href={`/category/${category.slug}`}
              className="flex min-h-11 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              {category.name}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <form action="/search" method="GET" className="hidden items-center md:flex">
            <div className="relative">
              <input
                name="q"
                type="search"
                placeholder="상품 검색"
                className="h-11 w-44 rounded-lg border-0 bg-neutral-100 pl-11 pr-3 text-sm outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-300 lg:w-56"
              />
              <button
                type="submit"
                aria-label="검색"
                className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-l-lg text-neutral-500 transition-colors hover:text-neutral-900"
              >
                <Search aria-hidden="true" size={15} />
              </button>
            </div>
          </form>

          <Link
            href="/search"
            aria-label="검색"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100 active:bg-neutral-200 md:hidden"
          >
            <Search size={20} />
          </Link>

          <Link
            href="/cart"
            aria-label="장바구니"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100 active:bg-neutral-200"
          >
            <ShoppingBag size={20} />
          </Link>

          <HeaderAccountActions />
        </div>
      </div>
    </header>
  );
}
