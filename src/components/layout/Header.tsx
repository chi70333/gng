import Link from 'next/link';
import { LogOut, Search, ShoppingBag, User } from 'lucide-react';
import MobileMenuDrawer from './MobileMenuDrawer';
import { logoutAction } from '@/app/actions';
import { logger } from '@/lib/logger';
import { auth } from '@/server/auth';
import type { SerializedCategory } from '@/server/repositories/category.repository';
import { getCachedCategoryTree } from '@/server/services/category.service';

export default async function Header() {
  let categories: SerializedCategory[] = [];

  try {
    categories = await getCachedCategoryTree();
  } catch (err) {
    logger.error({ err }, 'Header: getCachedCategoryTree failed');
  }

  const session = await auth();

  return (
    <HeaderShell
      categories={categories}
      isAuthenticated={Boolean(session?.user?.userKind)}
    />
  );
}

export function HeaderShell({
  categories,
  isAuthenticated,
}: {
  categories: SerializedCategory[];
  isAuthenticated: boolean;
}) {
  const rootCategories = categories.filter((category) => category.depth === 0);

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-14 max-w-screen-xl items-center gap-3 px-4">
        <Link
          href="/"
          className="mr-2 flex min-h-11 min-w-11 shrink-0 items-center text-xl font-extrabold tracking-normal text-neutral-900"
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
                className="h-11 w-44 rounded-lg border-0 bg-neutral-100 pl-9 pr-3 text-sm outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-300 lg:w-56"
              />
              <Search
                size={15}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
              />
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

          <Link
            href={isAuthenticated ? '/mypage' : '/login'}
            aria-label={isAuthenticated ? '마이페이지' : '로그인'}
            className="hidden h-11 w-11 items-center justify-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100 md:flex"
          >
            <User size={20} />
          </Link>

          {isAuthenticated ? (
            <form action={logoutAction} className="hidden md:block">
              <input type="hidden" name="callbackUrl" value="/" />
              <button
                type="submit"
                aria-label="로그아웃"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100 active:bg-neutral-200"
              >
                <LogOut size={20} />
              </button>
            </form>
          ) : null}

          <MobileMenuDrawer
            categories={categories}
            isAuthenticated={isAuthenticated}
            logoutAction={logoutAction}
          />
        </div>
      </div>
    </header>
  );
}
