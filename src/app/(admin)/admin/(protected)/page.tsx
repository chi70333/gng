// Legacy sources: wb_admin/main.php, wb_admin/_main_inc.php
// Cache: page no-store. Dashboard count widgets use a 10s RSC cache to avoid
// repeated cross-region DB count queries while keeping operational data fresh.

import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { AlertTriangle, Boxes, FileText, PackageCheck, UsersRound } from 'lucide-react';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { formatKRW, formatNumber } from '@/lib/format';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '관리자 대시보드',
};

const getAdminStats = unstable_cache(
  async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [
      products,
      orders,
      users,
      pendingOrders,
      lowStock,
      todayOrders,
      todayUsers,
      todayPosts,
      recentOrders,
      recentUsers,
      recentInquiries,
      popularProducts,
      bestSellingProducts,
    ] = await prisma.$transaction([
      prisma.product.count({ where: { deletedAt: null } }),
      prisma.order.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.order.count({ where: { status: 'pending', deletedAt: null } }),
      prisma.productSku.count({ where: { isActive: true, stock: { lte: 5 } } }),
      prisma.order.count({ where: { deletedAt: null, createdAt: { gte: todayStart, lt: todayEnd } } }),
      prisma.user.count({ where: { deletedAt: null, createdAt: { gte: todayStart, lt: todayEnd } } }),
      prisma.post.count({ where: { deletedAt: null, createdAt: { gte: todayStart, lt: todayEnd } } }),
      prisma.order.findMany({
        where: { deletedAt: null, createdAt: { gte: todayStart, lt: todayEnd } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          orderNo: true,
          status: true,
          total: true,
          createdAt: true,
          user: { select: { name: true, phone: true } },
          buyerInfo: true,
          payments: { select: { method: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      prisma.user.findMany({
        where: { deletedAt: null, createdAt: { gte: todayStart, lt: todayEnd } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          loginId: true,
          email: true,
          name: true,
          createdAt: true,
          loginCount: true,
          grade: { select: { name: true } },
          pointHistories: { orderBy: { createdAt: 'desc' }, take: 1, select: { balance: true } },
        },
      }),
      prisma.inquiry.findMany({
        where: { status: 'open' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, email: true, createdAt: true },
      }),
      prisma.product.findMany({
        where: { deletedAt: null },
        orderBy: { viewCount: 'desc' },
        take: 10,
        select: { id: true, name: true, price: true, salePrice: true, viewCount: true },
      }),
      prisma.product.findMany({
        where: { deletedAt: null },
        orderBy: { soldCount: 'desc' },
        take: 10,
        select: { id: true, name: true, price: true, salePrice: true, soldCount: true },
      }),
    ]);

    return {
      products,
      orders,
      users,
      pendingOrders,
      lowStock,
      todayOrders,
      todayUsers,
      todayPosts,
      recentOrders,
      recentUsers: recentUsers.map((user) => ({
        ...user,
        id: user.id.toString(),
      })),
      recentInquiries: recentInquiries.map((inquiry) => ({
        ...inquiry,
        id: inquiry.id.toString(),
      })),
      popularProducts: popularProducts.map((product) => ({
        ...product,
        id: product.id.toString(),
      })),
      bestSellingProducts: bestSellingProducts.map((product) => ({
        ...product,
        id: product.id.toString(),
      })),
    };
  },
  ['admin-dashboard-stats'],
  { revalidate: 10, tags: ['admin-dashboard-stats'] },
);

function readJsonString(value: unknown, keys: string[]): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const result = record[key];
    if (typeof result === 'string' && result.trim()) return result;
  }
  return '';
}

function paymentLabel(method: string | undefined): string {
  const labels: Record<string, string> = {
    card: '카드결제',
    hand: '휴대폰',
    iche: '계좌이체',
    cyber: '가상계좌',
    bank: '무통장',
    vbank: '가상계좌',
    point: '마일리지',
  };
  return method ? labels[method] ?? method : '미결제';
}

export default async function AdminDashboardPage() {
  await requireAdmin();
  const stats = await getAdminStats();
  const cards = [
    { label: '상품', value: stats.products, href: '/admin/products', icon: Boxes },
    { label: '주문', value: stats.orders, href: '/admin/orders', icon: PackageCheck },
    { label: '회원', value: stats.users, href: '/admin/users', icon: UsersRound },
    { label: '결제 대기', value: stats.pendingOrders, href: '/admin/orders?status=pending', icon: PackageCheck },
    { label: '재고 5개 이하', value: stats.lowStock, href: '/admin/products?stock=low', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-neutral-950">관리자 대시보드</h1>
          <p className="mt-1 text-sm text-neutral-500">
            레거시 대시보드의 오늘 주문, 신규회원, 게시판 현황, 인기 상품을 한눈에 확인합니다.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-neutral-500">{card.label}</p>
                <Icon className="text-neutral-300" size={22} />
              </div>
              <p className="mt-4 text-2xl font-extrabold text-neutral-950">{formatNumber(card.value)}</p>
            </Link>
          );
        })}
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <div>
            <h2 className="text-base font-extrabold">오늘 주문 리스트</h2>
            <p className="mt-1 text-xs text-neutral-500">
              오늘 {formatNumber(stats.todayOrders)}건 / 전체 {formatNumber(stats.orders)}건
            </p>
          </div>
          <Link href="/admin/orders" className="text-sm font-bold text-blue-700 hover:underline">
            더보기
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-3 text-left">주문번호</th>
                <th className="px-4 py-3 text-left">주문자</th>
                <th className="px-4 py-3 text-left">전화번호</th>
                <th className="px-4 py-3 text-left">결제방법</th>
                <th className="px-4 py-3 text-right">결제금액</th>
                <th className="px-4 py-3 text-left">거래상태</th>
                <th className="px-4 py-3 text-right">주문날짜</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {stats.recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="h-24 px-4 text-center text-neutral-500">
                    오늘 주문내역이 없습니다.
                  </td>
                </tr>
              ) : (
                stats.recentOrders.map((order) => {
                  const buyerName = order.user?.name || readJsonString(order.buyerInfo, ['name']) || '비회원';
                  const phone = order.user?.phone || readJsonString(order.buyerInfo, ['phone', 'tel']) || '-';
                  const payment = order.payments[0];

                  return (
                    <tr key={order.orderNo} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-bold text-blue-700">
                        <Link href={`/admin/orders/${order.orderNo}`}>{order.orderNo}</Link>
                      </td>
                      <td className="px-4 py-3">{buyerName}</td>
                      <td className="px-4 py-3">{phone}</td>
                      <td className="px-4 py-3">{paymentLabel(payment?.method)}</td>
                      <td className="px-4 py-3 text-right font-bold">{formatKRW(order.total.toString())}</td>
                      <td className="px-4 py-3">
                        <AdminStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-500">
                        {order.createdAt.toLocaleString('ko-KR')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <div>
              <h2 className="text-base font-extrabold">신규회원</h2>
              <p className="mt-1 text-xs text-neutral-500">
                오늘 {formatNumber(stats.todayUsers)}명 / 전체 {formatNumber(stats.users)}명
              </p>
            </div>
            <Link href="/admin/users" className="text-sm font-bold text-blue-700 hover:underline">
              더보기
            </Link>
          </div>
          <ul className="divide-y divide-neutral-100">
            {stats.recentUsers.length === 0 ? (
              <li className="p-4 text-sm text-neutral-500">오늘 가입한 회원이 없습니다.</li>
            ) : (
              stats.recentUsers.map((user) => (
                <li key={user.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_90px_90px_120px] sm:items-center">
                  <div className="min-w-0">
                    <Link href={`/admin/users/${user.id}`} className="font-bold hover:underline">
                      {user.name}
                    </Link>
                    <p className="mt-1 truncate text-xs text-neutral-500">
                      {user.loginId ?? '-'} / {user.email}
                    </p>
                  </div>
                  <p className="text-sm text-neutral-600">{user.grade?.name ?? '-'}</p>
                  <p className="text-sm text-neutral-600">{formatNumber(user.pointHistories[0]?.balance ?? 0)}</p>
                  <p className="text-sm text-neutral-500 sm:text-right">
                    {user.createdAt.toLocaleDateString('ko-KR')}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <div>
              <h2 className="text-base font-extrabold">오늘 게시판 현황</h2>
              <p className="mt-1 text-xs text-neutral-500">오늘 게시글 {formatNumber(stats.todayPosts)}건</p>
            </div>
            <Link href="/admin/boards" className="text-sm font-bold text-blue-700 hover:underline">
              더보기
            </Link>
          </div>
          <ul className="divide-y divide-neutral-100">
            {stats.recentInquiries.length === 0 ? (
              <li className="p-4 text-sm text-neutral-500">미답변 1:1 문의가 없습니다.</li>
            ) : (
              stats.recentInquiries.map((inquiry) => (
                <li key={inquiry.id} className="p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
                    <FileText size={14} />
                    1:1 문의
                  </div>
                  <p className="mt-2 line-clamp-1 text-sm font-bold">{inquiry.title}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {inquiry.email} / {inquiry.createdAt.toLocaleDateString('ko-KR')}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RankTable
          title="인기 상품"
          valueLabel="조회수"
          products={stats.popularProducts.map((product) => ({
            id: product.id,
            name: product.name,
            price: (product.salePrice ?? product.price).toString(),
            value: product.viewCount,
          }))}
        />
        <RankTable
          title="최다 판매 상품"
          valueLabel="판매수"
          products={stats.bestSellingProducts.map((product) => ({
            id: product.id,
            name: product.name,
            price: (product.salePrice ?? product.price).toString(),
            value: product.soldCount,
          }))}
        />
      </div>
    </div>
  );
}

function RankTable({
  title,
  valueLabel,
  products,
}: {
  title: string;
  valueLabel: string;
  products: { id: string; name: string; price: string; value: number }[];
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 px-4 py-3">
        <h2 className="text-base font-extrabold">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-neutral-50 text-xs text-neutral-500">
            <tr>
              <th className="w-14 px-4 py-3 text-center">순위</th>
              <th className="px-4 py-3 text-left">상품명</th>
              <th className="w-28 px-4 py-3 text-right">판매가격</th>
              <th className="w-24 px-4 py-3 text-right">{valueLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {products.length === 0 ? (
              <tr>
                <td colSpan={4} className="h-24 px-4 text-center text-neutral-500">
                  표시할 상품이 없습니다.
                </td>
              </tr>
            ) : (
              products.map((product, index) => (
                <tr key={product.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-center font-bold">{index + 1}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${product.id}`} className="line-clamp-1 font-bold hover:underline">
                      {product.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">{formatKRW(product.price)}</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700">
                    {formatNumber(product.value)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
