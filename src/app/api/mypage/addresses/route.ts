// Legacy sources: mypage_addrs.php, mypage_addrs_ok.php
// Cache: no-store. User addresses are private member state.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import { updateUserAddressSchema, userAddressSchema } from '@/schemas/order';
import { AuthError, ForbiddenError, NotFoundError, toApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

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

function serializeAddress(address: {
  id: bigint;
  label: string | null;
  receiver: string;
  phone: string;
  zipCode: string;
  address1: string;
  address2: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...address,
    id: address.id.toString(),
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  };
}

export async function GET() {
  try {
    const userId = await getUserId();
    const addresses = await prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });

    return NextResponse.json(
      { ok: true, data: addresses.map(serializeAddress) },
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

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const parsed = userAddressSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION',
            message: '배송지 정보를 확인해 주세요.',
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault) {
        await tx.userAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const count = await tx.userAddress.count({ where: { userId } });
      if (count >= 10) {
        const oldest = await tx.userAddress.findFirst({
          where: { userId, isDefault: false },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (oldest) {
          await tx.userAddress.delete({ where: { id: oldest.id } });
        }
      }

      return tx.userAddress.create({
        data: {
          userId,
          label: parsed.data.label || null,
          receiver: parsed.data.receiver,
          phone: parsed.data.phone,
          zipCode: parsed.data.zipCode,
          address1: parsed.data.address1,
          address2: parsed.data.address2 || null,
          isDefault: parsed.data.isDefault,
        },
      });
    });

    return NextResponse.json(
      { ok: true, data: serializeAddress(created) },
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

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getUserId();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) throw new NotFoundError('배송지를 찾을 수 없습니다.');

    const parsed = updateUserAddressSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION',
            message: '배송지 정보를 확인해 주세요.',
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const addressId = BigInt(id);
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.userAddress.findUnique({
        where: { id: addressId },
        select: { userId: true },
      });
      if (!existing) throw new NotFoundError('배송지를 찾을 수 없습니다.');
      if (existing.userId !== userId) throw new ForbiddenError('본인 배송지만 수정할 수 있습니다.');

      if (parsed.data.isDefault) {
        await tx.userAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.userAddress.update({
        where: { id: addressId },
        data: {
          label: parsed.data.label === undefined ? undefined : parsed.data.label || null,
          receiver: parsed.data.receiver,
          phone: parsed.data.phone,
          zipCode: parsed.data.zipCode,
          address1: parsed.data.address1,
          address2: parsed.data.address2 === undefined ? undefined : parsed.data.address2 || null,
          isDefault: parsed.data.isDefault,
        },
      });
    });

    return NextResponse.json(
      { ok: true, data: serializeAddress(updated) },
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

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) throw new NotFoundError('배송지를 찾을 수 없습니다.');

    const address = await prisma.userAddress.findUnique({
      where: { id: BigInt(id) },
      select: { userId: true },
    });
    if (!address) throw new NotFoundError('배송지를 찾을 수 없습니다.');
    if (address.userId !== userId) throw new ForbiddenError('본인 배송지만 삭제할 수 있습니다.');

    await prisma.userAddress.delete({ where: { id: BigInt(id) } });
    return NextResponse.json(
      { ok: true, data: { id } },
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
