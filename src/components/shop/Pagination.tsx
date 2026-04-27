// 페이지네이션 — Server Component (순수 링크).
// URL searchParam page=N 방식. Client 상태 불필요.

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  /** 현재 경로 + 기존 searchParams (page 제외) */
  baseHref: string;
}

function pageHref(base: string, page: number): string {
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}page=${page}`;
}

export default function Pagination({ currentPage, totalPages, baseHref }: PaginationProps) {
  if (totalPages <= 1) return null;

  // 표시할 페이지 번호 범위 (최대 5개)
  const delta = 2;
  const start = Math.max(1, currentPage - delta);
  const end = Math.min(totalPages, currentPage + delta);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const btnBase =
    'flex items-center justify-center min-w-[40px] h-10 px-2 rounded-lg text-sm transition-colors';

  return (
    <nav aria-label="페이지 이동" className="flex items-center justify-center gap-1 py-6">
      {/* 이전 */}
      {currentPage > 1 ? (
        <Link
          href={pageHref(baseHref, currentPage - 1)}
          className={cn(btnBase, 'text-neutral-700 hover:bg-neutral-100')}
          aria-label="이전 페이지"
        >
          <ChevronLeft size={16} />
        </Link>
      ) : (
        <span className={cn(btnBase, 'text-neutral-300 cursor-default')}>
          <ChevronLeft size={16} />
        </span>
      )}

      {/* 첫 페이지 */}
      {start > 1 && (
        <>
          <Link href={pageHref(baseHref, 1)} className={cn(btnBase, 'text-neutral-700 hover:bg-neutral-100')}>
            1
          </Link>
          {start > 2 && <span className={cn(btnBase, 'text-neutral-400 cursor-default')}>…</span>}
        </>
      )}

      {/* 페이지 번호 */}
      {pages.map((p) => (
        <Link
          key={p}
          href={pageHref(baseHref, p)}
          aria-current={p === currentPage ? 'page' : undefined}
          className={cn(
            btnBase,
            p === currentPage
              ? 'bg-neutral-900 text-white font-medium pointer-events-none'
              : 'text-neutral-700 hover:bg-neutral-100',
          )}
        >
          {p}
        </Link>
      ))}

      {/* 마지막 페이지 */}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && (
            <span className={cn(btnBase, 'text-neutral-400 cursor-default')}>…</span>
          )}
          <Link href={pageHref(baseHref, totalPages)} className={cn(btnBase, 'text-neutral-700 hover:bg-neutral-100')}>
            {totalPages}
          </Link>
        </>
      )}

      {/* 다음 */}
      {currentPage < totalPages ? (
        <Link
          href={pageHref(baseHref, currentPage + 1)}
          className={cn(btnBase, 'text-neutral-700 hover:bg-neutral-100')}
          aria-label="다음 페이지"
        >
          <ChevronRight size={16} />
        </Link>
      ) : (
        <span className={cn(btnBase, 'text-neutral-300 cursor-default')}>
          <ChevronRight size={16} />
        </span>
      )}
    </nav>
  );
}
