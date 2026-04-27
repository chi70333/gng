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
  /** 부모 카테고리 정보 (소제목용). */
  parentName?: string;
}

export default function CategoryNav({
  categories,
  activeSlug,
  parentName,
}: CategoryNavProps) {
  if (categories.length === 0) return null;

  return (
    <>
      {/* 모바일: 가로 스크롤 탭 */}
      <nav
        className="md:hidden overflow-x-auto -mx-4 px-4 flex gap-2 pb-0.5 scrollbar-none"
        aria-label="카테고리 탭"
      >
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/category/${cat.slug}`}
            className={cn(
              'shrink-0 h-9 px-4 text-sm rounded-full border transition-colors whitespace-nowrap',
              activeSlug === cat.slug
                ? 'bg-neutral-900 border-neutral-900 text-white font-medium'
                : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-400',
            )}
          >
            {cat.name}
          </Link>
        ))}
      </nav>

      {/* 데스크톱: 사이드 리스트 */}
      <aside className="hidden md:block w-48 shrink-0" aria-label="카테고리 목록">
        {parentName && (
          <h2 className="text-sm font-semibold text-neutral-900 mb-3 px-2">
            {parentName}
          </h2>
        )}
        <ul className="space-y-0.5">
          {categories.map((cat) => (
            <li key={cat.id}>
              <Link
                href={`/category/${cat.slug}`}
                className={cn(
                  'flex items-center h-9 px-2 rounded-lg text-sm transition-colors',
                  activeSlug === cat.slug
                    ? 'bg-neutral-100 text-neutral-900 font-medium'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
                )}
              >
                {cat.name}
              </Link>
              {/* 3단계 서브카테고리 */}
              {activeSlug === cat.slug && cat.children.length > 0 && (
                <ul className="mt-0.5 ml-2 space-y-0.5">
                  {cat.children.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={`/category/${child.slug}`}
                        className="flex items-center h-8 pl-3 pr-2 rounded-lg text-xs text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 transition-colors"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
