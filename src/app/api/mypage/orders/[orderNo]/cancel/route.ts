// Legacy sources: mypage_order_detail.php, order_cancel.php
// Cache: no-store. User cancellation mutates private order state.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import { cancelUserOrder } from '@/server/services/order.service';
import { AuthError, toApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const cancelSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

async function getUserId(): Promise<bigint> {
  const session = await auth();
  if (!session?.user?.email) throw new AuthError('로그인이 필요합니다.');

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) throw new AuthError('로그인이 필요합니다.');
  return user.id;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { orderNo: string } },
) {
  try {
    const userId = await getUserId();
    const body = await req.json().catch(() => ({}));
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION',
            message: '취소 사유를 확인해 주세요.',
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const data = await cancelUserOrder({
      orderNo: params.orderNo,
      userId,
      reason: parsed.data.reason,
    });

    return NextResponse.json(
      { ok: true, data },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const apiError = toApiError(err);
    return NextResponse.json(apiError.body, {
      status: apiError.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
