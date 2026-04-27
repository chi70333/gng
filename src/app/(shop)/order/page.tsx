// Legacy sources: order_sheet.php, order_table.php, mypage_coupon.php, mypage_point.php
// Cache: no-cache. Reads per-user/per-guest Redis cart and private coupon/point state.

import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Decimal } from '@prisma/client/runtime/library';
import { auth } from '@/server/auth';
import { getCart, type CartIdentity } from '@/server/services/cart.service';
import { prisma } from '@/server/db';
import { formatKRW, formatNumber } from '@/lib/format';
import { createOrderAction } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '주문서',
  description: '배송지, 쿠폰, 포인트를 확인하고 주문을 접수합니다.',
};

const CART_COOKIE = 'gng_cart_id';

async function resolveCartIdentity(): Promise<CartIdentity | null> {
  const session = await auth();
  if (session?.user?.email) return { type: 'user', id: session.user.email };

  const guestId = cookies().get(CART_COOKIE)?.value;
  return guestId ? { type: 'guest', id: guestId } : null;
}

async function getOrderUserData(email: string | null, subtotal: Decimal) {
  if (!email) return null;
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      pointHistories: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { balance: true },
      },
      couponIssues: {
        where: {
          usedAt: null,
          expireAt: { gte: new Date() },
          coupon: {
            isActive: true,
            startAt: { lte: new Date() },
            endAt: { gte: new Date() },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          expireAt: true,
          coupon: {
            select: {
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

  return {
    pointBalance: user.pointHistories[0]?.balance ?? 0,
    coupons: user.couponIssues.filter((issue) => {
      const minimum = issue.coupon.minOrderAmount;
      return !minimum || subtotal.gte(minimum);
    }),
  };
}

function couponLabel(issue: NonNullable<Awaited<ReturnType<typeof getOrderUserData>>>['coupons'][number]) {
  const coupon = issue.coupon;
  const discount =
    coupon.discountType === 'percent'
      ? `${coupon.discountValue.toString()}%`
      : formatKRW(coupon.discountValue.toString());
  const limit = coupon.maxDiscount
    ? `, 최대 ${formatKRW(coupon.maxDiscount.toString())}`
    : '';
  const minimum = coupon.minOrderAmount
    ? `, ${formatKRW(coupon.minOrderAmount.toString())} 이상`
    : '';

  return `${coupon.name} (${discount}${limit}${minimum})`;
}

type OrderPageProps = {
  searchParams: {
    error?: string;
  };
};

export default async function OrderPage({ searchParams }: OrderPageProps) {
  const session = await auth();
  const identity = await resolveCartIdentity();
  const cart = identity ? await getCart(identity) : { items: [], subtotal: '0' };
  const subtotal = new Decimal(cart.subtotal);
  const shippingFee = subtotal.gte(50000) ? new Decimal(0) : new Decimal(3000);
  const orderUser = await getOrderUserData(session?.user?.email ?? null, subtotal);

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-neutral-900">주문서</h1>
        <p className="mt-4 text-sm text-neutral-500">장바구니가 비어 있습니다.</p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-neutral-900 px-5 text-sm font-semibold text-white"
        >
          쇼핑 계속하기
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-screen-xl gap-6 px-4 py-6 lg:grid-cols-[1fr_320px]">
      <section>
        <h1 className="mb-5 text-xl font-bold text-neutral-900">주문서</h1>
        {searchParams.error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            주문 정보와 재고 상태를 확인해 주세요.
          </p>
        )}
        <form action={createOrderAction} className="space-y-4 rounded-lg bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-neutral-700">받는 분</span>
              <input name="receiver" required className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-neutral-700">연락처</span>
              <input name="phone" type="tel" required className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">우편번호</span>
            <input name="zipCode" required className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">주소</span>
            <input name="address1" required className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">상세주소</span>
            <input name="address2" className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm" />
          </label>

          {orderUser && (
            <div className="grid gap-3 border-t border-neutral-100 pt-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-neutral-700">쿠폰</span>
                <select name="couponIssueId" className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm">
                  <option value="">사용 안 함</option>
                  {orderUser.coupons.map((issue) => (
                    <option key={issue.id.toString()} value={issue.id.toString()}>
                      {couponLabel(issue)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-neutral-700">
                  포인트 사용 가능 {formatNumber(orderUser.pointBalance)} P
                </span>
                <input
                  name="pointsToUse"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={orderUser.pointBalance}
                  defaultValue={0}
                  className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">배송 메모</span>
            <textarea name="memo" rows={3} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          </label>
          <button
            type="submit"
            className="flex min-h-12 w-full items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white"
          >
            주문 접수하기
          </button>
        </form>
      </section>

      <aside className="h-fit rounded-lg bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-neutral-900">주문 요약</h2>
        <ul className="mb-4 space-y-2">
          {cart.items.map((item) => (
            <li key={item.skuId} className="flex justify-between gap-3 text-sm">
              <span className="line-clamp-1 text-neutral-600">{item.name}</span>
              <span className="shrink-0 font-medium text-neutral-900">{item.quantity}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-2 border-t border-neutral-100 pt-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">상품 합계</span>
            <span className="font-bold text-neutral-900">{formatKRW(cart.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">배송비</span>
            <span className="font-bold text-neutral-900">{formatKRW(shippingFee.toString())}</span>
          </div>
          <p className="pt-2 text-xs text-neutral-500">
            쿠폰과 포인트 할인은 주문 접수 시 최종 금액에 반영됩니다.
          </p>
        </div>
      </aside>
    </div>
  );
}
