// Legacy sources: cart_ok_ajax.php, cart_del_ajax.php, /m/cart_count.php
// Cache: no-store. Legacy AJAX reads/writes the same Redis cart with 30d TTL.

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import {
  mergeCart,
  type CartIdentity,
  type Cart,
} from '@/server/services/cart.service';

export const LEGACY_CART_COOKIE = 'gng_cart_id';

export async function resolveLegacyCartIdentity(req: NextRequest): Promise<{
  identity: CartIdentity;
  guestIdToSet: string | null;
  guestIdToClear: boolean;
}> {
  const session = await auth();
  const userId = session?.user?.email;
  const existingGuestId = req.cookies.get(LEGACY_CART_COOKIE)?.value;

  if (userId) {
    const identity: CartIdentity = { type: 'user', id: userId };
    if (existingGuestId) {
      await mergeCart({ type: 'guest', id: existingGuestId }, identity);
    }
    return {
      identity,
      guestIdToSet: null,
      guestIdToClear: Boolean(existingGuestId),
    };
  }

  const guestId = existingGuestId ?? randomUUID();
  return {
    identity: { type: 'guest', id: guestId },
    guestIdToSet: existingGuestId ? null : guestId,
    guestIdToClear: false,
  };
}

export function legacyTextResponse(
  body: string,
  status: number,
  guestIdToSet: string | null,
  guestIdToClear: boolean,
): NextResponse {
  const res = new NextResponse(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });

  if (guestIdToSet) {
    res.cookies.set(LEGACY_CART_COOKIE, guestIdToSet, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
  }
  if (guestIdToClear) {
    res.cookies.delete(LEGACY_CART_COOKIE);
  }

  return res;
}

export async function formDataToRecord(req: NextRequest): Promise<Record<string, string>> {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('form') && !contentType.includes('multipart')) {
    return {};
  }

  const formData = await req.formData();
  const record: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === 'string') {
      record[key] = value;
    }
  });
  return record;
}

export function legacyBeforeCheckResponse(cart: Cart, skuId: string | undefined): string {
  const existing = skuId ? cart.items.find((item) => item.skuId === skuId) : null;
  const totalCount = skuId ? 1 : 0;
  const updateCount = existing ? 1 : 0;
  const insertCount = existing?.quantity ?? 0;
  return `${totalCount}|${updateCount}|${insertCount}`;
}
