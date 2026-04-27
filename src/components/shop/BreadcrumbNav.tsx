// 빵 부스러기 네비 — Server Component.
// 구조화 데이터(BreadcrumbList) schema.org 포함. SEO docs/01-architecture.md

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
}

export default function BreadcrumbNav({ items }: BreadcrumbNavProps) {
  if (items.length === 0) return null;

  const schemaItems = items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.label,
    ...(item.href ? { item: item.href } : {}),
  }));

  return (
    <>
      {/* 구조화 데이터 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: schemaItems,
          }),
        }}
      />

      <nav aria-label="breadcrumb" className="py-2">
        <ol className="flex items-center gap-1 text-xs text-neutral-500 overflow-x-auto scrollbar-none">
          <li className="shrink-0">
            <Link
              href="/"
              className="inline-flex min-h-11 min-w-11 items-center justify-center transition-colors hover:text-neutral-800"
            >
              홈
            </Link>
          </li>
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-1 shrink-0">
              <ChevronRight size={12} className="text-neutral-300" aria-hidden="true" />
              {item.href && i < items.length - 1 ? (
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center transition-colors hover:text-neutral-800"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-neutral-800 font-medium" aria-current="page">
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
