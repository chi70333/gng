// Legacy source: coupon_ajax.php
// Cache: no-store. Coupon issuance mutates authenticated user state.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import { issueCouponToUser } from '@/server/services/coupon.service';
import { toApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const issueCouponSchema = z.object({
  couponId: z.coerce.bigint(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' } },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const parsed = issueCouponSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION', message: '쿠폰 정보가 올바르지 않습니다.' } },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' } },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    await issueCouponToUser({ couponId: parsed.data.couponId, userId: user.id });
    return NextResponse.json(
      { ok: true },
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
