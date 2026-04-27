// Legacy sources: cart.php, _cart.php
// Cache: no-cache. Cart is per-user/per-guest Redis data with 30d TTL.

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { ShoppingBag } from 'lucide-react';
import { auth } from '@/server/auth';
import { getCart, mergeCart, type CartIdentity } from '@/server/services/cart.service';
import { formatKRW } from '@/lib/format';
import CartItemControls from '@/components/shop/CartItemControls';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '장바구니',
  description: '장바구니에 담긴 상품과 수량을 확인합니다.',
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

export default async function CartPage() {
  const identity = await resolveCartIdentity();
  const cart = identity ? await getCart(identity) : { items: [], subtotal: '0' };
  const hasUnavailableItem = cart.items.some((item) => !item.isAvailable);

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">장바구니</h1>
          <p className="mt-1 text-sm text-neutral-500">상품 {cart.items.length}개</p>
        </div>
        <ShoppingBag className="text-neutral-300" size={28} />
      </div>

      {cart.items.length === 0 ? (
        <div className="rounded-lg bg-white px-4 py-16 text-center">
          <p className="text-sm text-neutral-400">장바구니가 비어 있습니다.</p>
          <Link
            href="/"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-neutral-900 px-5 text-sm font-semibold text-white"
          >
            쇼핑 계속하기
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <ul className="space-y-3">
            {cart.items.map((item) => (
              <li key={item.skuId} className="flex gap-3 rounded-lg bg-white p-3">
                <Link
                  href={`/goods/${item.slug}`}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-neutral-100"
                >
                  {item.thumbnail && (
                    <Image
                      src={item.thumbnail}
                      alt={item.name}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/goods/${item.slug}`}
                    className="line-clamp-2 text-sm font-medium text-neutral-900"
                  >
                    {item.name}
                  </Link>
                  {item.optionSummary && (
                    <p className="mt-1 text-xs text-neutral-500">
                      {item.optionSummary}
                    </p>
                  )}
                  {item.stockMessage && (
                    <p className="mt-2 inline-flex rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600">
                      {item.stockMessage}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-neutral-900">
                      {formatKRW(item.unitPrice)}
                    </span>
                  </div>
                  <div className="mt-3">
                    <CartItemControls skuId={item.skuId} quantity={item.quantity} />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit rounded-lg bg-white p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">상품 합계</span>
              <span className="font-bold text-neutral-900">
                {formatKRW(cart.subtotal)}
              </span>
            </div>
            {hasUnavailableItem ? (
              <button
                type="button"
                disabled
                className="mt-4 flex h-12 w-full items-center justify-center rounded-lg bg-neutral-200 text-sm font-semibold text-neutral-500"
              >
                품절 상품 확인 필요
              </button>
            ) : (
              <Link
                href="/order"
                className="mt-4 flex h-12 w-full items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white"
              >
                주문하기
              </Link>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
