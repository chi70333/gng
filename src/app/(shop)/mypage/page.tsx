// Legacy sources: mypage.php, order_list.php
// Cache: no-store. My page contains per-user account and order data.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Coins, PackageCheck, UserRound } from 'lucide-react';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import { formatKRW } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '마이페이지',
};

async function getMyPageData(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      loginId: true,
      phone: true,
      createdAt: true,
      pointHistories: {
        orderBy: { id: 'desc' },
        take: 1,
        select: { balance: true },
      },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          orderNo: true,
          status: true,
          total: true,
          createdAt: true,
          items: {
            take: 1,
            select: {
              productName: true,
              quantity: true,
            },
          },
        },
      },
    },
  });
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '결제 대기',
    paid: '결제 완료',
    preparing: '상품 준비중',
    shipping: '배송중',
    delivered: '배송 완료',
    cancelled: '취소',
    refunded: '환불',
  };
  return labels[status] ?? status;
}

export default async function MyPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login?callbackUrl=/mypage');

  const user = await getMyPageData(session.user.email);
  if (!user) redirect('/login?callbackUrl=/mypage');
  const pointBalance = user.pointHistories[0]?.balance ?? 0;

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">마이페이지</h1>
          <p className="mt-1 text-sm text-neutral-500">주문과 회원 정보를 확인할 수 있습니다.</p>
        </div>
        <UserRound className="text-neutral-300" size={28} />
      </div>

      <section className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-white p-4">
          <p className="text-xs font-medium text-neutral-500">회원명</p>
          <p className="mt-2 text-base font-bold text-neutral-900">{user.name}</p>
        </div>
        <div className="rounded-lg bg-white p-4">
          <p className="text-xs font-medium text-neutral-500">회원 ID</p>
          <p className="mt-2 text-base font-bold text-neutral-900">{user.loginId ?? '-'}</p>
        </div>
        <div className="rounded-lg bg-white p-4">
          <p className="text-xs font-medium text-neutral-500">이메일</p>
          <p className="mt-2 break-all text-base font-bold text-neutral-900">{user.email}</p>
        </div>
        <div className="rounded-lg bg-white p-4">
          <p className="text-xs font-medium text-neutral-500">적립금</p>
          <p className="mt-2 text-base font-bold text-neutral-900">
            {pointBalance.toLocaleString('ko-KR')} P
          </p>
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <Link
          href="/mypage/orders"
          className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-white p-4 text-sm font-semibold text-neutral-900"
        >
          <span>주문내역 전체 보기</span>
          <PackageCheck size={18} className="shrink-0 text-neutral-300" aria-hidden />
        </Link>
        <Link
          href="/mypage/addresses"
          className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-white p-4 text-sm font-semibold text-neutral-900"
        >
          <span>배송지 관리</span>
          <UserRound size={18} className="shrink-0 text-neutral-300" aria-hidden />
        </Link>
        <Link
          href="/mypage/points"
          className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-neutral-900 p-4 text-sm font-semibold text-white"
          aria-label="나의 포인트 이력 조회"
        >
          <span>포인트 이력 조회</span>
          <Coins size={18} className="shrink-0 text-white/70" aria-hidden />
        </Link>
      </section>

      <section className="mt-8" aria-labelledby="recent-orders">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-orders" className="text-lg font-bold text-neutral-900">
            최근 주문
          </h2>
          <PackageCheck className="text-neutral-300" size={22} />
        </div>

        {user.orders.length === 0 ? (
          <div className="rounded-lg bg-white px-4 py-14 text-center">
            <p className="text-sm text-neutral-400">아직 주문 내역이 없습니다.</p>
            <Link
              href="/"
              className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-neutral-900 px-5 text-sm font-semibold text-white"
            >
              쇼핑 계속하기
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {user.orders.map((order) => {
              const firstItem = order.items[0];
              return (
                <li key={order.orderNo} className="rounded-lg bg-white p-4">
                  <Link href={`/mypage/orders/${order.orderNo}`} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-neutral-400">
                          {order.createdAt.toLocaleDateString('ko-KR')} / {order.orderNo}
                        </p>
                        <p className="mt-2 line-clamp-1 text-sm font-semibold text-neutral-900">
                          {firstItem
                            ? `${firstItem.productName} ${firstItem.quantity}개`
                            : '주문 상품'}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
                        {statusLabel(order.status)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-bold text-neutral-900">
                      {formatKRW(order.total.toString())}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
