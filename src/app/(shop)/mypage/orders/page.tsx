// Legacy sources: mypage_order.php, mypage_order_list.php
// Cache: no-store. Order list is private member state.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import { formatKRW } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '주문내역',
  description: '회원 주문내역을 확인합니다.',
};

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

export default async function MyOrdersPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login?callbackUrl=/mypage/orders');

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          orderNo: true,
          status: true,
          total: true,
          createdAt: true,
          items: {
            take: 1,
            select: { productName: true, quantity: true },
          },
        },
      },
    },
  });
  if (!user) redirect('/login?callbackUrl=/mypage/orders');

  return (
    <div className="mx-auto max-w-screen-md px-4 py-6">
      <h1 className="text-xl font-bold text-neutral-900">주문내역</h1>
      <p className="mt-1 text-sm text-neutral-500">최근 주문부터 확인할 수 있습니다.</p>

      {user.orders.length === 0 ? (
        <div className="mt-6 rounded-lg bg-white px-4 py-14 text-center">
          <p className="text-sm text-neutral-400">아직 주문 내역이 없습니다.</p>
          <Link
            href="/"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-neutral-900 px-5 text-sm font-semibold text-white"
          >
            쇼핑 계속하기
          </Link>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
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
    </div>
  );
}
