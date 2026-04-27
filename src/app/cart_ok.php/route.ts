// Legacy sources: legacy/www/cart_ok.php
// Compatibility: form fallback for act=add|edit|del, then redirect to /cart.
// Cache: no-store. Shared Redis cart TTL is 30d.

import { NextRequest, NextResponse } from 'next/server';
import {
  addCartItem,
  addCartProduct,
  deleteCartItems,
  updateCartItem,
} from '@/server/services/cart.service';
import {
  legacyCartAddSchema,
  legacyCartChangeCountSchema,
  legacyCartDeleteSchema,
} from '@/schemas/cart';
import {
  formDataToRecord,
  LEGACY_CART_COOKIE,
  resolveLegacyCartIdentity,
} from '@/app/api/cart/legacy-compat';

export const dynamic = 'force-dynamic';

function redirectCart(req: NextRequest, guestIdToSet: string | null, guestIdToClear: boolean) {
  const res = NextResponse.redirect(new URL('/cart', req.url), {
    headers: { 'Cache-Control': 'no-store' },
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

async function legacyCartOk(req: NextRequest) {
  const { identity, guestIdToSet, guestIdToClear } = await resolveLegacyCartIdentity(req);
  const form = await formDataToRecord(req);
  const input = { ...Object.fromEntries(req.nextUrl.searchParams), ...form };
  const act = req.nextUrl.searchParams.get('act') ?? form.act ?? 'add';

  if (act === 'edit') {
    const parsed = legacyCartChangeCountSchema.safeParse({
      mode: 'chang_cnt',
      idx: input.idx,
      tar: 'cnt',
      cnt: input.cnt,
    });
    if (parsed.success) {
      await updateCartItem(identity, parsed.data.idx, parsed.data.cnt);
    }
    return redirectCart(req, guestIdToSet, guestIdToClear);
  }

  if (act === 'del') {
    const parsed = legacyCartDeleteSchema.safeParse({
      mode: input.mode ?? 'single',
      idx: input.idx ?? input.arr ?? '',
    });
    if (parsed.success) {
      await deleteCartItems(identity, parsed.data.idx);
    }
    return redirectCart(req, guestIdToSet, guestIdToClear);
  }

  const parsed = legacyCartAddSchema.safeParse(input);
  if (parsed.success) {
    if (parsed.data.skuId) {
      await addCartItem(identity, parsed.data.skuId, parsed.data.quantity);
    } else if (parsed.data.goodsIdx) {
      await addCartProduct(identity, parsed.data.goodsIdx, parsed.data.quantity);
    }
  }

  return redirectCart(req, guestIdToSet, guestIdToClear);
}

export async function GET(req: NextRequest) {
  return legacyCartOk(req);
}

export async function POST(req: NextRequest) {
  return legacyCartOk(req);
}
