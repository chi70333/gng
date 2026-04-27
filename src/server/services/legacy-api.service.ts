// Legacy sources: api/gnp-api.php, api/point_sync.php
// Cache: no-store. These endpoints preserve the legacy JSON envelope.

import { prisma } from '@/server/db';
import { hashPassword } from '@/server/services/auth.service';
import { createPointLedgerEntry } from '@/server/services/point-ledger.service';
import type {
  LegacyPointSyncInput,
  LegacyRegisterMemberInput,
} from '@/schemas/legacy-api';

export type LegacyMemberListResult = {
  success: true;
  total: number;
  page: number;
  limit: number;
  members: Array<{
    userid: string;
    name: string;
    email: string;
    hp: string;
    mileage: number;
    regdate: string;
  }>;
};

function useridToEmail(userid: string, email?: string): string {
  return email ?? `${userid}@legacy.local`;
}

export async function listLegacyMembers(params: {
  page: number;
  limit: number;
  search: string;
}): Promise<LegacyMemberListResult> {
  const skip = (params.page - 1) * params.limit;
  const where = params.search
    ? {
        OR: [
          { loginId: { contains: params.search, mode: 'insensitive' as const } },
          { email: { contains: params.search, mode: 'insensitive' as const } },
          { name: { contains: params.search, mode: 'insensitive' as const } },
          { phone: { contains: params.search } },
        ],
      }
    : {};

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: params.limit,
      select: {
        email: true,
        loginId: true,
        name: true,
        phone: true,
        createdAt: true,
        pointHistories: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { balance: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    success: true,
    total,
    page: params.page,
    limit: params.limit,
    members: users.map((user) => ({
      userid: user.loginId ?? user.email,
      name: user.name,
      email: user.email,
      hp: user.phone ?? '',
      mileage: user.pointHistories[0]?.balance ?? 0,
      regdate: user.createdAt.toISOString(),
    })),
  };
}

export async function registerLegacyMember(
  input: LegacyRegisterMemberInput,
): Promise<{ success: boolean; message?: string }> {
  const email = useridToEmail(input.userid, input.email);
  const exists = await prisma.user.findFirst({
    where: { OR: [{ loginId: input.userid }, { email }, { email: input.userid }] },
    select: { id: true },
  });

  if (exists) return { success: false, message: 'User already exists' };

  await prisma.user.create({
    data: {
      email,
      loginId: input.userid,
      name: input.name,
      phone: input.hp?.replace(/[^0-9]/g, '') || null,
      passwordHash: await hashPassword(input.password),
    },
  });

  return { success: true, message: 'Member registered successfully' };
}

export async function syncLegacyPoint(
  input: LegacyPointSyncInput,
): Promise<{ success: boolean; message: string }> {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { loginId: input.userid },
        { email: input.userid },
        { email: `${input.userid}@legacy.local` },
      ],
    },
    select: { id: true },
  });

  if (!user) return { success: false, message: 'User not found' };

  await prisma.$transaction(async (tx) => {
    await createPointLedgerEntry(tx, {
      userId: user.id,
      delta: input.amount,
      reason: input.reason ?? 'External point sync',
      forcedBalance: input.new_balance,
    });
  });

  return { success: true, message: 'Point Synchronized Successfully' };
}
