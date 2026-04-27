'use client';

// 정렬 선택 — 'use client': URL searchParam 변경 위해 useRouter 필요.
// GET 파라미터 방식: /category/slug?sort=popular&page=1

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Suspense } from 'react';

const SORT_OPTIONS = [
  { value: 'new', label: '최신순' },
  { value: 'popular', label: '인기순' },
  { value: 'price_asc', label: '낮은 가격순' },
  { value: 'price_desc', label: '높은 가격순' },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];

interface SortSelectProps {
  currentSort: string;
}

function SortSelectInner({ currentSort }: SortSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (value: SortValue) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', value);
    params.set('page', '1'); // 정렬 변경 시 1페이지로 리셋
    window.dispatchEvent(new Event('gng:navigation-start'));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort-select" className="text-sm text-neutral-500 shrink-0">
        정렬
      </label>
      <select
        id="sort-select"
        value={currentSort}
        onChange={(e) => handleChange(e.target.value as SortValue)}
        className="h-9 pl-3 pr-8 text-sm bg-white border border-neutral-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-300"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function SortSelect(props: SortSelectProps) {
  return (
    <Suspense fallback={null}>
      <SortSelectInner {...props} />
    </Suspense>
  );
}
