// Legacy sources: coupon_list.php, coupon_ajax.php, mypage_coupon.php
// Cache: no-store. Coupons are authenticated user data.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Ticket } from 'lucide-react';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import { formatKRW } from '@/lib/format';
import { issueCouponAction } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '쿠폰함',
  description: '보유 쿠폰과 발급 가능한 쿠폰을 확인합니다.',
};

type CouponPageProps = {
  searchParams: {
    issued?: string;
    error?: string;
  };
};

async function getCouponData(email: string) {
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      couponIssues: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          usedAt: true,
          expireAt: true,
          coupon: {
            select: {
              code: true,
              name: true,
              discountType: true,
              discountValue: true,
              minOrderAmount: true,
              maxDiscount: true,
            },
          },
        },
      },
    },
  });
  if (!user) return null;

  const issuedCouponIds = await prisma.couponIssue.findMany({
    where: { userId: user.id },
    select: { couponId: true },
  });
  const issuedSet = new Set(issuedCouponIds.map((row) => row.couponId.toString()));
  const availableCoupons = await prisma.coupon.findMany({
    where: {
      isActive: true,
      startAt: { lte: now },
      endAt: { gte: now },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id: true,
      code: true,
      name: true,
      discountType: true,
      discountValue: true,
      minOrderAmount: true,
      maxDiscount: true,
      endAt: true,
      totalQuota: true,
      _count: { select: { issues: true } },
    },
  });

  return {
    issues: user.couponIssues,
    availableCoupons: availableCoupons.filter((coupon) => {
      if (issuedSet.has(coupon.id.toString())) return false;
      return coupon.totalQuota == null || coupon._count.issues < coupon.totalQuota;
    }),
  };
}

function discountText(coupon: {
  discountType: string;
  discountValue: { toString(): string };
  maxDiscount: { toString(): string } | null;
}) {
  if (coupon.discountType === 'percent') {
    const base = `${coupon.discountValue.toString()}%`;
    return coupon.maxDiscount
      ? `${base} 최대 ${formatKRW(coupon.maxDiscount.toString())}`
      : base;
  }

  return formatKRW(coupon.discountValue.toString());
}

export default async function CouponsPage({ searchParams }: CouponPageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect('/login?callbackUrl=/mypage/coupons');

  const data = await getCouponData(session.user.email);
  if (!data) redirect('/login?callbackUrl=/mypage/coupons');

  const usableRows = data.issues.filter(
    (row) => !row.usedAt && row.expireAt >= new Date(),
  );
  const usedRows = data.issues.filter((row) => row.usedAt || row.expireAt < new Date());

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">쿠폰함</h1>
          <p className="mt-1 text-sm text-neutral-500">
            사용 가능 쿠폰 {usableRows.length}장
          </p>
        </div>
        <Ticket className="shrink-0 text-neutral-300" size={28} aria-hidden />
      </div>

      {searchParams.issued && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          쿠폰이 발급되었습니다. 결제 단계에서 사용할 수 있습니다.
        </p>
      )}
      {searchParams.error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          쿠폰을 발급할 수 없습니다. 기간, 재고, 중복 발급 여부를 확인해 주세요.
        </p>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-base font-bold text-neutral-900">발급 가능한 쿠폰</h2>
        {data.availableCoupons.length === 0 ? (
          <div className="rounded-lg bg-white px-4 py-12 text-center text-sm text-neutral-500">
            지금 발급 가능한 쿠폰이 없습니다.
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {data.availableCoupons.map((coupon) => (
              <li key={coupon.id.toString()} className="rounded-lg bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-neutral-900">{coupon.name}</p>
                    <p className="mt-1 text-xs text-neutral-400">{coupon.code}</p>
                  </div>
                  <p className="shrink-0 text-lg font-extrabold text-red-600">
                    {discountText(coupon)}
                  </p>
                </div>
                <p className="mt-3 text-xs text-neutral-500">
                  {coupon.minOrderAmount
                    ? `${formatKRW(coupon.minOrderAmount.toString())} 이상 주문`
                    : '최소 주문금액 없음'}
                  {' · '}
                  {coupon.endAt.toLocaleDateString('ko-KR')} 만료
                </p>
                <form action={issueCouponAction} className="mt-4">
                  <input type="hidden" name="couponId" value={coupon.id.toString()} />
                  <button
                    type="submit"
                    className="flex min-h-11 w-full items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-bold text-white"
                  >
                    쿠폰 받기
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-base font-bold text-neutral-900">사용 가능 쿠폰</h2>
        {usableRows.length === 0 ? (
          <div className="rounded-lg bg-white px-4 py-12 text-center text-sm text-neutral-500">
            보유한 사용 가능 쿠폰이 없습니다.
          </div>
        ) : (
          <ul className="space-y-3">
            {usableRows.map((row) => (
              <li key={row.id.toString()} className="rounded-lg bg-white p-4">
                <p className="text-sm font-bold text-neutral-900">{row.coupon.name}</p>
                <p className="mt-1 text-xs text-neutral-400">{row.coupon.code}</p>
                <p className="mt-4 text-lg font-extrabold text-neutral-900">
                  {discountText(row.coupon)}
                </p>
                <p className="mt-2 text-xs text-neutral-500">
                  {row.coupon.minOrderAmount
                    ? `${formatKRW(row.coupon.minOrderAmount.toString())} 이상 주문`
                    : '최소 주문금액 없음'}
                  {' · '}
                  {row.expireAt.toLocaleDateString('ko-KR')} 만료
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-bold text-neutral-900">사용 완료/만료 쿠폰</h2>
        {usedRows.length === 0 ? (
          <div className="rounded-lg bg-white px-4 py-10 text-center text-sm text-neutral-500">
            사용 완료 또는 만료된 쿠폰이 없습니다.
          </div>
        ) : (
          <ul className="space-y-3">
            {usedRows.map((row) => (
              <li key={row.id.toString()} className="rounded-lg bg-white p-4 opacity-70">
                <p className="text-sm font-bold text-neutral-900">{row.coupon.name}</p>
                <p className="mt-2 text-xs text-neutral-500">
                  {row.usedAt ? '사용 완료' : '기간 만료'} ·{' '}
                  {row.expireAt.toLocaleDateString('ko-KR')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
