// Legacy sources: mypage_point.php, goods_point.php, goods_point2.php
// Cache: no-store. Points are authenticated user ledger data.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import { formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '마일리지',
  description: '마일리지 적립, 사용, 동기화 내역을 확인합니다.',
};

type PointFilter = 'all' | 'earn' | 'use';

type PointRow = NonNullable<Awaited<ReturnType<typeof getPointRows>>>[number];

async function getPointRows(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      pointHistories: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100,
        select: {
          id: true,
          delta: true,
          balance: true,
          reason: true,
          orderId: true,
          expireAt: true,
          createdAt: true,
        },
      },
    },
  });
  if (!user) return null;

  const orderIds = Array.from(
    new Set(
      user.pointHistories
        .map((row) => row.orderId)
        .filter((orderId): orderId is bigint => Boolean(orderId)),
    ),
  );
  const orders =
    orderIds.length > 0
      ? await prisma.order.findMany({
          where: {
            id: { in: orderIds },
            userId: user.id,
          },
          select: {
            id: true,
            orderNo: true,
            _count: {
              select: {
                items: true,
              },
            },
            items: {
              orderBy: { id: 'asc' },
              take: 1,
              select: {
                productName: true,
              },
            },
          },
        })
      : [];
  const orderSummaryById = new Map(
    orders.map((order) => [
      order.id.toString(),
      {
        orderNo: order.orderNo,
        productName:
          order._count.items > 1
            ? `${order.items[0]?.productName ?? '상품 정보 없음'} 외 ${order._count.items - 1}건`
            : (order.items[0]?.productName ?? '상품 정보 없음'),
      },
    ]),
  );

  return user.pointHistories.map((row) => ({
    ...row,
    orderSummary: row.orderId ? (orderSummaryById.get(row.orderId.toString()) ?? null) : null,
  }));
}

function pointFilterFromSearchParams(type: string | string[] | undefined): PointFilter {
  const value = Array.isArray(type) ? type[0] : type;
  if (value === 'earn' || value === 'use') return value;
  return 'all';
}

function pointTabHref(filter: PointFilter): string {
  return filter === 'all' ? '/mypage/points' : `/mypage/points?type=${filter}`;
}

function pointDateText(date: Date): string {
  return date
    .toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .replace(/\. /g, '.')
    .replace(/\.$/, '');
}

function pointMeta(delta: number) {
  if (delta > 0) {
    return {
      label: '적립',
      amountClass: 'text-blue-700',
      amountText: `+${formatNumber(delta)}원`,
    };
  }

  if (delta < 0) {
    return {
      label: '사용',
      amountClass: 'text-red-600',
      amountText: `-${formatNumber(Math.abs(delta))}원`,
    };
  }

  return {
    label: '조정',
    amountClass: 'text-neutral-600',
    amountText: '0원',
  };
}

function pointTitle(row: PointRow): string {
  if (/^주문\s+\S+\s+포인트 사용 취소/.test(row.reason)) return '상품구매 취소';
  if (/^주문\s+\S+\s+포인트 사용/.test(row.reason)) return '상품구매';
  if (/^주문\s+\S+\s+포인트 적립/.test(row.reason)) return '주문 적립';
  return row.reason.replace(/\s*포인트\s*/g, ' ').trim();
}

function pointDescription(row: PointRow): string | null {
  if (row.orderSummary) return row.orderSummary.productName;
  const title = pointTitle(row);
  if (
    row.reason === title ||
    title === '상품구매' ||
    title === '상품구매 취소' ||
    title === '주문 적립'
  ) {
    return null;
  }
  return row.reason;
}

function pointDetailText(row: PointRow): string {
  const meta = pointMeta(row.delta);
  const expireText =
    row.delta > 0 && row.expireAt ? ` (${pointDateText(row.expireAt)} 소멸 예정)` : '';

  return `${meta.label} · ${pointDateText(row.createdAt)}${expireText}`;
}

export default async function PointsPage({
  searchParams,
}: {
  searchParams?: { type?: string | string[] };
}) {
  const session = await auth();
  if (!session?.user?.email) redirect('/login?callbackUrl=/mypage/points');

  const rows = await getPointRows(session.user.email);
  if (!rows) redirect('/login?callbackUrl=/mypage/points');
  const activeFilter = pointFilterFromSearchParams(searchParams?.type);
  const balance = rows[0]?.balance ?? 0;
  const earned = rows.filter((row) => row.delta > 0).reduce((sum, row) => sum + row.delta, 0);
  const used = Math.abs(
    rows.filter((row) => row.delta < 0).reduce((sum, row) => sum + row.delta, 0),
  );
  const earnedCount = rows.filter((row) => row.delta > 0).length;
  const usedCount = rows.filter((row) => row.delta < 0).length;
  const filteredRows = rows.filter((row) => {
    if (activeFilter === 'earn') return row.delta > 0;
    if (activeFilter === 'use') return row.delta < 0;
    return true;
  });
  const tabs: { filter: PointFilter; label: string; count: number }[] = [
    { filter: 'all', label: '전체', count: rows.length },
    { filter: 'earn', label: '적립', count: earnedCount },
    { filter: 'use', label: '사용', count: usedCount },
  ];
  const summaries = [
    { label: '총 적립', value: earned },
    { label: '총 사용', value: used },
    { label: '잔액', value: balance },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-screen-sm bg-white">
      <section className="px-4 pb-5 pt-6" aria-labelledby="point-summary-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 id="point-summary-title" className="text-xl font-semibold text-neutral-950">
              마일리지
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              사용 가능 마일리지 {formatNumber(balance)} P
            </p>
          </div>
          <div className="relative mt-0.5 h-8 w-8 shrink-0 text-neutral-300" aria-hidden="true">
            <span className="absolute left-0 top-0 flex h-4 w-4 items-center justify-center rounded-full border-2 border-current text-[10px] leading-none">
              P
            </span>
            <span className="absolute right-0 top-2 h-4 w-4 rounded-full border-2 border-current" />
            <span className="absolute bottom-0 left-3 h-4 w-4 rounded-full border-2 border-current" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {summaries.map((summary) => (
            <div key={summary.label} className="min-h-[82px] rounded-lg bg-neutral-50 p-3">
              <p className="text-xs text-neutral-500">{summary.label}</p>
              <p className="mt-2 break-words text-sm font-semibold leading-snug text-neutral-950">
                {formatNumber(summary.value)} P
              </p>
            </div>
          ))}
        </div>
      </section>

      <nav
        className="sticky top-0 z-10 grid grid-cols-3 border-b border-neutral-200 bg-white"
        aria-label="마일리지 이력 필터"
      >
        {tabs.map((tab) => {
          const active = tab.filter === activeFilter;

          return (
            <Link
              key={tab.filter}
              href={pointTabHref(tab.filter)}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'relative flex h-12 items-center justify-center text-sm text-neutral-950 after:absolute after:bottom-0 after:h-[3px] after:w-8 after:bg-neutral-950'
                  : 'flex h-12 items-center justify-center text-sm text-neutral-500'
              }
            >
              {tab.label}
              <span className="sr-only">{formatNumber(tab.count)}건</span>
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <div className="px-4 py-16 text-center text-sm text-neutral-500">
          마일리지 내역이 없습니다.
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="px-4 py-16 text-center text-sm text-neutral-500">
          조회된 {tabs.find((tab) => tab.filter === activeFilter)?.label} 내역이 없습니다.
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100 px-4">
          {filteredRows.map((row) => {
            const meta = pointMeta(row.delta);
            const description = pointDescription(row);

            return (
              <li key={row.id.toString()} className="py-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm leading-tight text-neutral-950">
                      {pointTitle(row)}
                    </p>
                    {description ? (
                      <p className="mt-1.5 text-xs leading-snug text-neutral-950">
                        <span className="min-w-0 flex-1 truncate">{description}</span>
                      </p>
                    ) : null}
                    <p className="mt-1 truncate text-xs leading-snug text-neutral-500">
                      {pointDetailText(row)}
                    </p>
                  </div>
                  <p
                    className={`whitespace-nowrap pt-0.5 text-right text-sm leading-tight ${meta.amountClass}`}
                  >
                    {meta.amountText}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
