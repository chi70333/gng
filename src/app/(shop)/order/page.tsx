// Legacy sources: order_sheet.php, order_table.php, mypage_coupon.php, mypage_point.php
// Cache: no-cache. Reads per-user/per-guest Redis cart and private coupon/point state.

import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Decimal } from '@prisma/client/runtime/library';
import { auth } from '@/server/auth';
import { getCart, mergeCart, type CartIdentity, type CartItem } from '@/server/services/cart.service';
import { prisma } from '@/server/db';
import { formatKRW } from '@/lib/format';
import { OrderPaymentForm, type OrderPaymentFormProps } from './OrderPaymentForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '결제하기',
  description: '배송지와 결제 정보를 확인하고 구매를 진행합니다.',
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

function decimalToNumber(value: Decimal | null): number | null {
  return value == null ? null : Number(value.toString());
}

function discountType(value: string): 'percent' | 'amount' {
  return value === 'percent' ? 'percent' : 'amount';
}

function serializeAddress(
  address: NonNullable<Awaited<ReturnType<typeof getOrderUserData>>>['addresses'][number],
) {
  return {
    id: address.id.toString(),
    label: address.label,
    isDefault: address.isDefault,
    receiver: address.receiver,
    phone: address.phone,
    zipCode: address.zipCode,
    address1: address.address1,
    address2: address.address2,
  };
}

function serializeCartItems(items: CartItem[]): OrderPaymentFormProps['cartItems'] {
  return items.map((item) => ({
    skuId: item.skuId,
    name: item.name,
    thumbnail: item.thumbnail,
    optionSummary: item.optionSummary,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
  }));
}

function serializeOrderUser(
  user: Awaited<ReturnType<typeof getOrderUserData>>,
): OrderPaymentFormProps['orderUser'] {
  if (!user) return null;

  return {
    name: user.name,
    email: user.email,
    phone: user.phone,
    defaultAddress: user.defaultAddress ? serializeAddress(user.defaultAddress) : null,
    addresses: user.addresses.map(serializeAddress),
    pointBalance: user.pointBalance,
    coupons: user.coupons.map((issue) => ({
      id: issue.id.toString(),
      label: couponLabel(issue),
      discountType: discountType(issue.coupon.discountType),
      discountValue: Number(issue.coupon.discountValue.toString()),
      minOrderAmount: decimalToNumber(issue.coupon.minOrderAmount),
      maxDiscount: decimalToNumber(issue.coupon.maxDiscount),
    })),
  };
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
  const hasUnavailableItem = cart.items.some((item) => !item.isAvailable);

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-sm px-4 py-14 text-center">
        <h1 className="text-lg font-bold text-neutral-900">결제할 상품이 없습니다</h1>
        <p className="mt-3 text-sm text-neutral-500">장바구니에 상품을 담은 뒤 다시 진행해 주세요.</p>
        <Link
          href="/"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-900 px-5 text-sm font-semibold text-white"
        >
          쇼핑 계속하기
        </Link>
      </div>
    );
  }

  return (
    <OrderPaymentForm
      orderUser={serializeOrderUser(orderUser)}
      sessionName={session?.user?.name ?? null}
      sessionEmail={session?.user?.email ?? null}
      cartItems={serializeCartItems(cart.items)}
      subtotal={Number(subtotal.toString())}
      shippingFee={Number(shippingFee.toString())}
      hasUnavailableItem={hasUnavailableItem}
      error={searchParams.error}
    />
  );
}
