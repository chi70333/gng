// Legacy sources: cart.php, _cart.php
// Cache: no-cache. Cart is per-user/per-guest Redis data with 30d TTL.

import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { ShoppingBag } from 'lucide-react';
import { auth } from '@/server/auth';
import { getCart, mergeCart, type CartIdentity } from '@/server/services/cart.service';
import CartSelectionPanel from '@/components/shop/CartSelectionPanel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '장바구니',
  description: '장바구니에 담긴 상품을 확인합니다.',
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
        <CartSelectionPanel items={cart.items} />
      )}
    </div>
  );
}
