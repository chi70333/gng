// Legacy sources: order_method_check.php, order_table_trans_chk.php
// Cache: no-store. Validates the current Redis cart against live stock.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import type { CartIdentity } from '@/server/services/cart.service';
import { validateCartForOrder } from '@/server/services/order-validation.service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const CART_COOKIE = 'gng_cart_id';

async function resolveIdentity(req: NextRequest): Promise<CartIdentity | null> {
  const session = await auth();
  if (session?.user?.email) return { type: 'user', id: session.user.email };

  const guestId = req.cookies.get(CART_COOKIE)?.value;
  return guestId ? { type: 'guest', id: guestId } : null;
}

export async function GET(req: NextRequest) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json(
      { ok: true, data: { valid: false, issues: [{ skuId: '', message: 'Cart is empty.' }] } },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const data = await validateCartForOrder(identity);
    return NextResponse.json(
      { ok: true, data },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    logger.error({ err }, 'GET /api/order/validate failed');
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL', message: 'Internal Server Error' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
