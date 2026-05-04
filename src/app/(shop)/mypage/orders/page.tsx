// Legacy sources: mypage_order.php, mypage_order_list.php
// Cache: no-store. Order list is private member state.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Pagination from '@/components/shop/Pagination';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import { formatKRW, formatKoreanDate, formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

const ORDER_PAGE_SIZE = 50;

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

function parsePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

interface MyOrdersPageProps {
  searchParams?: {
    page?: string;
  };
}

export default async function MyOrdersPage({ searchParams }: MyOrdersPageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect('/login?callbackUrl=/mypage/orders');

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
    },
  });
  if (!user) redirect('/login?callbackUrl=/mypage/orders');

  const currentPage = parsePage(searchParams?.page);
  const [totalOrders, orders] = await prisma.$transaction([
    prisma.order.count({
      where: { userId: user.id },
    }),
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip: (currentPage - 1) * ORDER_PAGE_SIZE,
      take: ORDER_PAGE_SIZE,
      select: {
        orderNo: true,
        status: true,
        total: true,
        pointsUsed: true,
        createdAt: true,
        items: {
          take: 1,
          select: {
            productName: true,
            quantity: true,
          },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalOrders / ORDER_PAGE_SIZE));
  if (totalOrders > 0 && currentPage > totalPages) {
    redirect(`/mypage/orders?page=${totalPages}`);
  }

  return (
    <div className="mx-auto max-w-screen-md px-4 py-6">
      <h1 className="text-xl font-bold text-neutral-900">주문내역</h1>
      <p className="mt-1 text-sm text-neutral-500">
        전체 {formatNumber(totalOrders)}건의 주문을 최근 주문부터 확인할 수 있습니다.
      </p>

      {orders.length === 0 ? (
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
        <>
          <ul className="mt-5 space-y-3">
            {orders.map((order) => {
              const firstItem = order.items[0];
              const orderAmount = order.total.plus(order.pointsUsed);
              const hasMileagePayment = order.pointsUsed > 0;
              return (
                <li key={order.orderNo} className="rounded-lg bg-white p-4">
                  <Link href={`/mypage/orders/${order.orderNo}`} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-neutral-400">
                          {formatKoreanDate(order.createdAt)} / {order.orderNo}
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
                    <div className="mt-3 space-y-1">
                      <p className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-neutral-500">구매금액</span>
                        <span className="font-bold text-neutral-900">
                          {formatKRW(orderAmount.toString())}
                        </span>
                      </p>
                      {hasMileagePayment && (
                        <>
                          <p className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-neutral-500">마일리지 사용</span>
                            <span className="font-semibold text-blue-700">
                              -{order.pointsUsed.toLocaleString('ko-KR')} P
                            </span>
                          </p>
                          <p className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-neutral-500">실결제금액</span>
                            <span className="font-semibold text-neutral-700">
                              {formatKRW(order.total.toString())}
                            </span>
                          </p>
                        </>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Pagination currentPage={currentPage} totalPages={totalPages} baseHref="/mypage/orders" />
        </>
      )}
    </div>
  );
}
