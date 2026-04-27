// Legacy sources: order_table_ok.php
// Cache: no-store. Creates pending orders from the Redis cart.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { createOrderFromCart } from '@/server/services/order.service';
import type { CartIdentity } from '@/server/services/cart.service';
import { createOrderSchema } from '@/schemas/order';
import { toApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const CART_COOKIE = 'gng_cart_id';

async function resolveIdentity(req: NextRequest): Promise<CartIdentity | null> {
  const session = await auth();
  if (session?.user?.email) return { type: 'user', id: session.user.email };

  const guestId = req.cookies.get(CART_COOKIE)?.value;
  return guestId ? { type: 'guest', id: guestId } : null;
}

export async function POST(req: NextRequest) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION', message: 'Cart is empty.' } },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const parsed = createOrderSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION',
          message: 'Invalid order input.',
          fields: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const data = await createOrderFromCart(identity, parsed.data);
    return NextResponse.json(
      { ok: true, data },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const apiError = toApiError(err);
    return NextResponse.json(apiError.body, {
      status: apiError.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
