// Legacy sources: mypage_point.php, goods_point.php, goods_point2.php
// Cache: no-store. Points are authenticated user ledger data.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Coins } from 'lucide-react';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import { formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '포인트',
  description: '포인트 적립, 사용, 동기화 내역을 확인합니다.',
};

async function getPointRows(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      pointHistories: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          delta: true,
          balance: true,
          reason: true,
          expireAt: true,
          createdAt: true,
        },
      },
    },
  });
  return user?.pointHistories ?? null;
}

export default async function PointsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login?callbackUrl=/mypage/points');

  const rows = await getPointRows(session.user.email);
  if (!rows) redirect('/login?callbackUrl=/mypage/points');
  const balance = rows[0]?.balance ?? 0;
  const earned = rows
    .filter((row) => row.delta > 0)
    .reduce((sum, row) => sum + row.delta, 0);
  const used = Math.abs(
    rows.filter((row) => row.delta < 0).reduce((sum, row) => sum + row.delta, 0),
  );

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">포인트</h1>
          <p className="mt-1 text-sm text-neutral-500">
            사용 가능 포인트 {formatNumber(balance)} P
          </p>
        </div>
        <Coins className="shrink-0 text-neutral-300" size={28} aria-hidden />
      </div>

      <div className="mb-6 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-white p-3">
          <p className="text-xs text-neutral-500">총 적립</p>
          <p className="mt-1 text-sm font-bold text-neutral-900">{formatNumber(earned)} P</p>
        </div>
        <div className="rounded-lg bg-white p-3">
          <p className="text-xs text-neutral-500">총 사용</p>
          <p className="mt-1 text-sm font-bold text-neutral-900">{formatNumber(used)} P</p>
        </div>
        <div className="rounded-lg bg-white p-3">
          <p className="text-xs text-neutral-500">잔액</p>
          <p className="mt-1 text-sm font-bold text-neutral-900">{formatNumber(balance)} P</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg bg-white px-4 py-16 text-center text-sm text-neutral-500">
          포인트 내역이 없습니다.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id.toString()} className="rounded-lg bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900">{row.reason}</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {row.createdAt.toLocaleDateString('ko-KR')}
                    {row.expireAt
                      ? ` · ${row.expireAt.toLocaleDateString('ko-KR')} 만료`
                      : ''}
                  </p>
                </div>
                <p
                  className={
                    row.delta >= 0
                      ? 'shrink-0 text-sm font-bold text-blue-700'
                      : 'shrink-0 text-sm font-bold text-red-600'
                  }
                >
                  {row.delta > 0 ? '+' : ''}
                  {formatNumber(row.delta)} P
                </p>
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                잔액 {formatNumber(row.balance)} P
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
