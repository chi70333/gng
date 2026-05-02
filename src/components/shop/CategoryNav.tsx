// 카테고리 사이드바/탭 네비 — Server Component.
// 모바일: 가로 스크롤 탭, 데스크톱: 사이드 리스트. docs/06-mobile.md

import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { SerializedCategory } from '@/server/repositories/category.repository';

interface CategoryNavProps {
  /** 루트 카테고리 + 자식 포함 트리 (또는 특정 부모의 자식들). */
  categories: SerializedCategory[];
  /** 현재 활성 slug. */
  activeSlug: string;
  /** 현재 카테고리의 조상 slug 목록. */
  activeAncestorSlugs?: string[];
  /** 부모 카테고리 정보 (소제목용). */
  parentName?: string;
}

export default function CategoryNav({
  categories,
  activeSlug,
  activeAncestorSlugs = [],
  parentName,
}: CategoryNavProps) {
  if (categories.length === 0) return null;

  const isChildList = Boolean(parentName);

  return (
    <>
      {/* 모바일: 가로 스크롤 탭 */}
      <nav
        className="-mx-4 md:hidden"
        aria-label={parentName ? `${parentName} 하위 카테고리 탭` : '카테고리 탭'}
      >
        {parentName && (
          <div className="mb-2 flex items-center gap-1.5 px-4 text-sm">
            <span className="font-semibold text-neutral-950">{parentName}</span>
            <span className="text-neutral-300" aria-hidden="true">
              /
            </span>
            <span className="text-xs font-medium text-neutral-500">하위 카테고리</span>
          </div>
        )}
        <div className="flex snap-x gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
          {categories.map((cat) => {
            const isActive = activeSlug === cat.slug;

            return (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex h-11 max-w-[72vw] shrink-0 snap-start items-center justify-center whitespace-nowrap rounded-lg border px-3.5 font-semibold shadow-sm transition-colors',
                  isChildList ? 'text-xs' : 'text-sm',
                  isActive
                    ? 'border-neutral-900 bg-neutral-900 text-white shadow-neutral-900/10'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 active:bg-neutral-100',
                )}
              >
                <span className="truncate">{cat.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* 데스크톱: 사이드 리스트 */}
      <aside
        className="hidden w-48 shrink-0 md:block"
        aria-label={parentName ? `${parentName} 하위 카테고리 목록` : '카테고리 목록'}
      >
        {parentName && (
          <div className="mb-3 px-2">
            <span className="block text-[11px] font-medium text-neutral-400">상위 카테고리</span>
            <h2 className="mt-1 truncate text-base font-bold text-neutral-950">{parentName}</h2>
          </div>
        )}
        <ul className={cn('space-y-1', parentName && 'border-t border-neutral-100 pt-2')}>
          {categories.map((cat) => {
            const isActive = activeSlug === cat.slug;
            const isExpanded = isActive || activeAncestorSlugs.includes(cat.slug);

            return (
              <li key={cat.id}>
                <Link
                  href={`/category/${cat.slug}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex min-h-10 items-center rounded-lg transition-colors',
                    isChildList ? 'ml-2 px-3 text-xs' : 'px-2 text-sm',
                    isActive
                      ? 'bg-neutral-100 font-semibold text-neutral-950'
                      : isExpanded
                        ? 'font-semibold text-neutral-950 hover:bg-neutral-50'
                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
                  )}
                >
                  <span className="truncate">{cat.name}</span>
                </Link>
                {/* 3단계 서브카테고리 */}
                {isExpanded && cat.children.length > 0 && (
                  <ul className="ml-2 mt-0.5 space-y-0.5">
                    {cat.children.map((child) => {
                      const isChildActive = activeSlug === child.slug;

                      return (
                        <li key={child.id}>
                          <Link
                            href={`/category/${child.slug}`}
                            aria-current={isChildActive ? 'page' : undefined}
                            className={cn(
                              'flex min-h-9 items-center rounded-lg pl-3 pr-2 text-xs transition-colors',
                              isChildActive
                                ? 'bg-neutral-100 font-semibold text-neutral-950'
                                : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800',
                            )}
                          >
                            {child.name}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
}
