// Legacy sources: wb_admin/member_point.php
// Cache: no-store. Admin point adjustments must write and return live ledger state.

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { createPointLedgerEntry } from '@/server/services/point-ledger.service';
import { adminUserPointFormSchema, adminUserPointHistoryQuerySchema } from '@/schemas/admin-user';

export const dynamic = 'force-dynamic';

function clientIp(): string | null {
  const headerList = headers();
  const forwardedFor = headerList.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = headerList.get('x-real-ip');
  return forwardedFor || realIp || null;
}

function pointJson(point: {
  id: bigint;
  delta: number;
  balance: number;
  reason: string;
  createdAt: Date;
}) {
  return {
    id: point.id.toString(),
    delta: point.delta,
    balance: point.balance,
    reason: point.reason,
    createdAt: point.createdAt.toISOString(),
  };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin('user.read');
    const searchParams = new URL(request.url).searchParams;
    const parsed = adminUserPointHistoryQuerySchema.parse({
      userId: params.id,
      limit: searchParams.get('limit') ?? undefined,
    });

    const points = await prisma.userPointHistory.findMany({
      where: {
        userId: parsed.userId,
      },
      orderBy: { createdAt: 'desc' },
      take: parsed.limit,
      select: {
        id: true,
        delta: true,
        balance: true,
        reason: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ items: points.map(pointJson) });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? '입력값을 확인해주세요.' },
        { status: 400 },
      );
    }

    return NextResponse.json({ message: '마일리지 이력을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin('user.write');
    const body = (await request.json()) as unknown;
    const input = typeof body === 'object' && body !== null ? body : {};
    const parsed = adminUserPointFormSchema.parse({
      ...input,
      userId: params.id,
    });
    const ip = clientIp();

    const point = await prisma.$transaction(async (tx) => {
      const created = await createPointLedgerEntry(tx, {
        userId: parsed.userId,
        delta: parsed.delta,
        reason: parsed.reason,
      });

      await tx.auditLog.create({
        data: {
          actorId: `admin:${admin.id.toString()}`,
          action: 'user.points.adjust',
          entity: 'User',
          entityId: parsed.userId.toString(),
          payload: { delta: parsed.delta, reason: parsed.reason },
          ip,
        },
      });

      return created;
    });

    return NextResponse.json(pointJson(point));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? '입력값을 확인해주세요.' },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === 'POINT_BALANCE_NEGATIVE') {
      return NextResponse.json(
        { message: '포인트 잔액은 0보다 작을 수 없습니다.' },
        { status: 400 },
      );
    }

    return NextResponse.json({ message: '포인트 저장에 실패했습니다.' }, { status: 500 });
  }
}
