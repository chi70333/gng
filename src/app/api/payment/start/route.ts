// Legacy sources: payaction.php, order_ok.php, PG/*
// Cache: no-store. Builds a one-time PG start payload from server order totals.

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import { paymentStartSchema } from '@/schemas/payment';
import { ConflictError, ForbiddenError, NotFoundError, toApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

function signPayload(payload: Record<string, string>): string | null {
  const secret = process.env.PAYMENT_START_SECRET;
  if (!secret) return null;
  const base = Object.keys(payload)
    .sort()
    .map((key) => `${key}=${payload[key]}`)
    .join('&');
  return createHmac('sha256', secret).update(base).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const parsed = paymentStartSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION',
            message: '결제 시작 정보를 확인해 주세요.',
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const session = await auth();
    const order = await prisma.order.findUnique({
      where: { orderNo: parsed.data.orderNo },
      select: {
        orderNo: true,
        userId: true,
        status: true,
        total: true,
        items: {
          orderBy: { id: 'asc' },
          select: { productName: true },
        },
      },
    });

    if (!order) throw new NotFoundError('주문을 찾을 수 없습니다.');
    if (order.status !== 'pending') {
      throw new ConflictError('결제 대기 상태의 주문만 결제를 시작할 수 있습니다.');
    }

    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      if (order.userId && user?.id !== order.userId) {
        throw new ForbiddenError('본인 주문만 결제를 시작할 수 있습니다.');
      }
    }

    const firstName = order.items[0]?.productName ?? '주문 상품';
    const productName =
      order.items.length > 1 ? `${firstName} 외 ${order.items.length - 1}건` : firstName;
    const amount = order.total.toFixed(0);
    const returnUrl =
      parsed.data.returnUrl ?? `${req.nextUrl.origin}/order/complete?orderNo=${order.orderNo}`;

    const payload: Record<string, string> = {
      provider: parsed.data.provider,
      method: parsed.data.method,
      orderNo: order.orderNo,
      amount,
      productName,
      returnUrl,
    };
    const signature = signPayload(payload);

    return NextResponse.json(
      {
        ok: true,
        data: {
          ...payload,
          signature,
        },
      },
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
