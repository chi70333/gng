// Legacy sources: cart_ok.php, cart_ok_ajax.php, cart_del_ajax.php
// Cache: no-store. Cart data is per-user/per-guest in Redis with 30d TTL.

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import {
  addCartItem,
  clearCart,
  getCart,
  mergeCart,
  updateCartItem,
  type CartIdentity,
} from '@/server/services/cart.service';
import { addCartItemSchema, updateCartItemSchema } from '@/schemas/cart';
import { toApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const CART_COOKIE = 'gng_cart_id';

async function resolveIdentity(req: NextRequest): Promise<{
  identity: CartIdentity;
  guestIdToSet: string | null;
  guestIdToClear: boolean;
}> {
  const session = await auth();
  const userId = session?.user?.email;
  if (userId) {
    return {
      identity: { type: 'user', id: userId },
      guestIdToSet: null,
      guestIdToClear: Boolean(req.cookies.get(CART_COOKIE)?.value),
    };
  }

  const existing = req.cookies.get(CART_COOKIE)?.value;
  const guestId = existing ?? randomUUID();
  return {
    identity: { type: 'guest', id: guestId },
    guestIdToSet: existing ? null : guestId,
    guestIdToClear: false,
  };
}

function jsonWithGuestCookie(
  body: unknown,
  status: number,
  guestIdToSet: string | null,
  guestIdToClear: boolean,
): NextResponse {
  const res = NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

  if (guestIdToSet) {
    res.cookies.set(CART_COOKIE, guestIdToSet, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
  }
  if (guestIdToClear) {
    res.cookies.delete(CART_COOKIE);
  }

  return res;
}

export async function GET(req: NextRequest) {
  const existingGuestId = req.cookies.get(CART_COOKIE)?.value;
  const { identity, guestIdToSet, guestIdToClear } = await resolveIdentity(req);
  const data =
    identity.type === 'user' && existingGuestId
      ? await mergeCart({ type: 'guest', id: existingGuestId }, identity)
      : await getCart(identity);
  return jsonWithGuestCookie({ ok: true, data }, 200, guestIdToSet, guestIdToClear);
}

export async function POST(req: NextRequest) {
  const { identity, guestIdToSet, guestIdToClear } = await resolveIdentity(req);
  const parsed = addCartItemSchema.safeParse(await req.json());

  if (!parsed.success) {
    return jsonWithGuestCookie(
      {
        ok: false,
        error: {
          code: 'VALIDATION',
          message: 'Invalid cart item.',
          fields: parsed.error.flatten().fieldErrors,
        },
      },
      400,
      guestIdToSet,
      guestIdToClear,
    );
  }

  try {
    const data = await addCartItem(identity, parsed.data.skuId, parsed.data.quantity);
    return jsonWithGuestCookie({ ok: true, data }, 200, guestIdToSet, guestIdToClear);
  } catch (err) {
    const apiError = toApiError(err);
    return jsonWithGuestCookie(
      apiError.body,
      apiError.status,
      guestIdToSet,
      guestIdToClear,
    );
  }
}

export async function PATCH(req: NextRequest) {
  const { identity, guestIdToSet, guestIdToClear } = await resolveIdentity(req);
  const parsed = updateCartItemSchema.safeParse(await req.json());

  if (!parsed.success) {
    return jsonWithGuestCookie(
      {
        ok: false,
        error: {
          code: 'VALIDATION',
          message: 'Invalid cart item.',
          fields: parsed.error.flatten().fieldErrors,
        },
      },
      400,
      guestIdToSet,
      guestIdToClear,
    );
  }

  try {
    const data = await updateCartItem(identity, parsed.data.skuId, parsed.data.quantity);
    return jsonWithGuestCookie({ ok: true, data }, 200, guestIdToSet, guestIdToClear);
  } catch (err) {
    const apiError = toApiError(err);
    return jsonWithGuestCookie(
      apiError.body,
      apiError.status,
      guestIdToSet,
      guestIdToClear,
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { identity, guestIdToSet, guestIdToClear } = await resolveIdentity(req);
  const data = await clearCart(identity);
  return jsonWithGuestCookie({ ok: true, data }, 200, guestIdToSet, guestIdToClear);
}
