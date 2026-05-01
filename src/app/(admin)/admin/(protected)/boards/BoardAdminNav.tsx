import Link from 'next/link';
import { FileText, HelpCircle, MessageSquareText, Settings } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

type BoardAdminNavKey = 'settings' | 'posts' | 'product-qna' | 'inquiries';

type BoardAdminCounts = {
  posts: number;
  productQna: number;
  inquiries: number;
};

const navItems = [
  {
    key: 'settings',
    href: '/admin/boards',
    label: '게시판 설정',
    description: '게시판 코드와 노출 상태',
    icon: Settings,
  },
  {
    key: 'posts',
    href: '/admin/boards/posts',
    label: '게시글',
    description: '등록, 수정, 삭제',
    icon: FileText,
  },
  {
    key: 'product-qna',
    href: '/admin/boards/product-qna',
    label: '상품문의',
    description: '미답변 답변 처리',
    icon: MessageSquareText,
  },
  {
    key: 'inquiries',
    href: '/admin/boards/inquiries',
    label: '1:1 문의',
    description: '고객 문의 답변',
    icon: HelpCircle,
  },
] as const;

function navCountLabel(key: BoardAdminNavKey, counts: BoardAdminCounts): string | null {
  if (key === 'posts') return `${formatNumber(counts.posts)}건`;
  if (key === 'product-qna') return `미답변 ${formatNumber(counts.productQna)}건`;
  if (key === 'inquiries') return `미답변 ${formatNumber(counts.inquiries)}건`;
  return null;
}

export function BoardAdminNav({
  active,
  counts,
}: {
  active: BoardAdminNavKey;
  counts: BoardAdminCounts;
}) {
  return (
    <nav className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="게시판 관리 하위 메뉴">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        const countLabel = navCountLabel(item.key, counts);

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-h-20 items-center gap-3 rounded-lg border bg-white px-3 py-3 text-left shadow-[0_8px_24px_rgba(15,23,42,0.045)] ring-1 ring-white transition hover:-translate-y-px hover:border-neutral-300',
              isActive
                ? 'border-neutral-900 text-neutral-950'
                : 'border-neutral-200 text-neutral-700',
            )}
          >
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-md border',
                isActive
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-600',
              )}
            >
              <Icon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-extrabold">{item.label}</span>
                {countLabel ? (
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-600">
                    {countLabel}
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block truncate text-xs font-medium text-neutral-500">
                {item.description}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
