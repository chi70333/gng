import Link from 'next/link';

export function AdminPagination({
  baseHref,
  page,
  hasNext,
  totalPages,
}: {
  baseHref: string;
  page: number;
  hasNext: boolean;
  totalPages?: number;
}) {
  const joiner = baseHref.includes('?') ? '&' : '?';
  const pageLabel =
    totalPages == null ? `${page}` : `${page} / 총 ${totalPages.toLocaleString('ko-KR')}페이지`;

  return (
    <div className="mt-5 flex items-center justify-between">
      <Link
        href={page > 1 ? `${baseHref}${joiner}page=${page - 1}` : baseHref}
        aria-disabled={page <= 1}
        className="inline-flex min-h-11 items-center rounded-md border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 aria-disabled:pointer-events-none aria-disabled:opacity-40"
      >
        이전
      </Link>
      <span className="text-sm font-semibold text-neutral-500">{pageLabel}</span>
      <Link
        href={hasNext ? `${baseHref}${joiner}page=${page + 1}` : baseHref}
        aria-disabled={!hasNext}
        className="inline-flex min-h-11 items-center rounded-md border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 aria-disabled:pointer-events-none aria-disabled:opacity-40"
      >
        다음
      </Link>
    </div>
  );
}
