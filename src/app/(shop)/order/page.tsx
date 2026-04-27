// Legacy sources: order_sheet.php, order_table.php, mypage_coupon.php, mypage_point.php
// Cache: no-cache. Reads per-user/per-guest Redis cart and private coupon/point state.

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Decimal } from '@prisma/client/runtime/library';
import { auth } from '@/server/auth';
import { getCart, mergeCart, type CartIdentity } from '@/server/services/cart.service';
import { prisma } from '@/server/db';
import { formatKRW, formatNumber } from '@/lib/format';
import { FormattedNumberInput } from '@/components/ui/FormattedNumberInput';
import { createOrderAction } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '주문서',
  description: '주문자 정보, 배송지, 결제수단을 확인하고 구매를 진행합니다.',
};

const CART_COOKIE = 'gng_cart_id';

async function resolveCartIdentity(): Promise<CartIdentity | null> {
  const session = await auth();
  if (session?.user?.email) {
    const identity: CartIdentity = { type: 'user', id: session.user.email };
    const guestId = cookies().get(CART_COOKIE)?.value;
    if (guestId) {
      await mergeCart({ type: 'guest', id: guestId }, identity);
    }
    return identity;
  }

  const guestId = cookies().get(CART_COOKIE)?.value;
  return guestId ? { type: 'guest', id: guestId } : null;
}

async function getOrderUserData(email: string | null, subtotal: Decimal) {
  if (!email) return null;
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      name: true,
      email: true,
      phone: true,
      addresses: {
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        select: {
          id: true,
          label: true,
          isDefault: true,
          receiver: true,
          phone: true,
          zipCode: true,
          address1: true,
          address2: true,
        },
      },
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
    name: user.name,
    email: user.email,
    phone: user.phone,
    defaultAddress: user.addresses[0] ?? null,
    addresses: user.addresses,
    pointBalance: user.pointHistories[0]?.balance ?? 0,
    coupons: user.couponIssues.filter((issue) => {
      const minimum = issue.coupon.minOrderAmount;
      return !minimum || subtotal.gte(minimum);
    }),
  };
}

function couponLabel(
  issue: NonNullable<Awaited<ReturnType<typeof getOrderUserData>>>['coupons'][number],
) {
  const coupon = issue.coupon;
  const discount =
    coupon.discountType === 'percent'
      ? `${coupon.discountValue.toString()}%`
      : formatKRW(coupon.discountValue.toString());
  const limit = coupon.maxDiscount ? `, 최대 ${formatKRW(coupon.maxDiscount.toString())}` : '';
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
  const totalBeforeDiscount = subtotal.plus(shippingFee);
  const orderUser = await getOrderUserData(session?.user?.email ?? null, subtotal);
  const defaultAddress = orderUser?.defaultAddress;
  const hasUnavailableItem = cart.items.some((item) => !item.isAvailable);

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
    <div className="mx-auto grid max-w-screen-xl gap-6 px-4 py-6 lg:grid-cols-[1fr_340px]">
      <section>
        <h1 className="mb-5 text-xl font-bold text-neutral-900">주문서</h1>
        {searchParams.error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            주문 정보를 확인해 주세요. 재고가 부족하거나 필수 정보가 누락되었을 수 있습니다.
          </p>
        )}
        {hasUnavailableItem && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            구매할 수 없는 상품이 있습니다. 장바구니에서 수량 또는 상품을 조정해 주세요.
          </p>
        )}

        <form action={createOrderAction} className="space-y-4">
          <section className="rounded-lg bg-white p-4">
            <h2 className="text-base font-bold text-neutral-900">주문자 정보</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-neutral-700">주문자명</span>
                <input
                  name="buyerName"
                  required
                  defaultValue={orderUser?.name ?? session?.user?.name ?? ''}
                  className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-neutral-700">연락처</span>
                <input
                  name="buyerPhone"
                  type="tel"
                  required
                  defaultValue={orderUser?.phone ?? ''}
                  className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-medium text-neutral-700">이메일</span>
                <input
                  name="buyerEmail"
                  type="email"
                  defaultValue={orderUser?.email ?? session?.user?.email ?? ''}
                  className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
            </div>
          </section>

          <section className="rounded-lg bg-white p-4">
            <h2 className="text-base font-bold text-neutral-900">배송지 정보</h2>
            {orderUser && orderUser.addresses.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-neutral-700">최근 배송지</p>
                {orderUser.addresses.map((address) => (
                  <div
                    key={address.id.toString()}
                    className="rounded-lg border border-neutral-200 p-3 text-sm text-neutral-700"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-neutral-900">
                        {address.label || address.receiver}
                      </span>
                      {address.isDefault && (
                        <span className="rounded-full bg-neutral-900 px-2 py-1 text-xs text-white">
                          기본
                        </span>
                      )}
                    </div>
                    <p className="mt-1">{address.receiver} / {address.phone}</p>
                    <p className="mt-1 text-neutral-500">
                      [{address.zipCode}] {address.address1} {address.address2 ?? ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-neutral-700">받는 분</span>
                <input
                  name="receiver"
                  required
                  defaultValue={defaultAddress?.receiver ?? orderUser?.name ?? ''}
                  className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-neutral-700">연락처</span>
                <input
                  name="phone"
                  type="tel"
                  required
                  defaultValue={defaultAddress?.phone ?? orderUser?.phone ?? ''}
                  className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-neutral-700">우편번호</span>
                <input
                  name="zipCode"
                  required
                  defaultValue={defaultAddress?.zipCode ?? ''}
                  className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-medium text-neutral-700">주소</span>
                <input
                  name="address1"
                  required
                  defaultValue={defaultAddress?.address1 ?? ''}
                  className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-medium text-neutral-700">상세주소</span>
                <input
                  name="address2"
                  required
                  defaultValue={defaultAddress?.address2 ?? ''}
                  className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
            </div>
            {orderUser && (
              <label className="mt-4 flex items-start gap-2 text-sm text-neutral-700">
                <input name="saveShippingAddress" type="checkbox" className="mt-1" />
                <span>이 배송지를 최근 배송지에 저장합니다.</span>
              </label>
            )}
          </section>

          {orderUser && (
            <section className="grid gap-3 rounded-lg bg-white p-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-neutral-700">쿠폰</span>
                <select
                  name="couponIssueId"
                  className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                >
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
                <FormattedNumberInput
                  name="pointsToUse"
                  min={0}
                  max={orderUser.pointBalance}
                  defaultValue={0}
                  className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
            </section>
          )}

          <section className="rounded-lg bg-white p-4">
            <h2 className="text-base font-bold text-neutral-900">결제수단</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[ 
                ['bank', '무통장입금'],
                ['card', '신용카드'],
                ['vbank', '가상계좌'],
                ['mobile', '휴대폰 결제'],
                ['transfer', '계좌이체'],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-neutral-300 px-3 text-sm"
                >
                  <input
                    name="paymentMethod"
                    type="radio"
                    value={value}
                    defaultChecked={value === 'bank'}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              PG 연동 전까지 결제수단은 주문 접수 상태로 저장됩니다. 무통장 주문은 관리자 확인 후
              처리합니다.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-neutral-700">입금자명</span>
                <input
                  name="depositorName"
                  defaultValue={orderUser?.name ?? session?.user?.name ?? ''}
                  className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-neutral-700">입금 예정일</span>
                <input
                  name="depositDueDate"
                  type="date"
                  className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
            </div>
          </section>

          <section className="rounded-lg bg-white p-4">
            <h2 className="text-base font-bold text-neutral-900">증빙 신청</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-neutral-700">현금영수증</span>
                <select
                  name="cashReceiptType"
                  className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                >
                  <option value="none">신청 안 함</option>
                  <option value="personal">개인 소득공제</option>
                  <option value="business">사업자 지출증빙</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-neutral-700">휴대폰/사업자번호</span>
                <input
                  name="cashReceiptIdentity"
                  className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-700 md:col-span-2">
                <input name="taxInvoiceRequested" type="checkbox" />
                <span>세금계산서를 신청합니다.</span>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-neutral-700">상호명</span>
                <input
                  name="taxInvoiceCompanyName"
                  className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-neutral-700">사업자등록번호</span>
                <input
                  name="taxInvoiceBusinessNumber"
                  className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
            </div>
          </section>

          <section className="rounded-lg bg-white p-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-neutral-700">배송 메모</span>
              <textarea
                name="memo"
                rows={3}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-4 flex items-start gap-2 text-sm text-neutral-700">
              <input name="agree" type="checkbox" required className="mt-1" />
              <span>주문 상품, 결제 금액, 배송 정보를 확인했으며 구매 진행에 동의합니다.</span>
            </label>
          </section>

          <button
            type="submit"
            disabled={hasUnavailableItem}
            className="flex min-h-12 w-full items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
          >
            구매하기
          </button>
        </form>
      </section>

      <aside className="h-fit rounded-lg bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-neutral-900">주문 요약</h2>
        <ul className="mb-4 space-y-3">
          {cart.items.map((item) => (
            <li key={item.skuId} className="flex gap-3 text-sm">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-neutral-100">
                {item.thumbnail && (
                  <Image
                    src={item.thumbnail}
                    alt={item.name}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-medium text-neutral-900">{item.name}</p>
                {item.optionSummary && (
                  <p className="mt-1 line-clamp-1 text-xs text-neutral-500">{item.optionSummary}</p>
                )}
                <p className="mt-1 text-xs text-neutral-500">수량 {item.quantity}개</p>
              </div>
              <span className="shrink-0 font-bold text-neutral-900">
                {formatKRW(new Decimal(item.unitPrice).mul(item.quantity).toString())}
              </span>
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
          <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-base">
            <span className="font-bold text-neutral-900">결제 예정금액</span>
            <span className="font-extrabold text-neutral-950">
              {formatKRW(totalBeforeDiscount.toString())}
            </span>
          </div>
          <p className="pt-2 text-xs text-neutral-500">
            쿠폰과 포인트 할인은 구매하기를 누를 때 최종 검증 후 반영됩니다.
          </p>
        </div>
      </aside>
    </div>
  );
}
