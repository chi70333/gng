// Legacy sources: api/gnp-api.php, api/point_sync.php
// Cache: no-store. These endpoints preserve the legacy JSON envelope.

import { prisma } from '@/server/db';
import { hashPassword } from '@/server/services/auth.service';
import { createPointLedgerEntry } from '@/server/services/point-ledger.service';
import type { Prisma } from '@prisma/client';
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

export type LegacyMemberListFilters = {
  userid?: string;
  loginId?: string;
  name?: string;
  email?: string;
  hp?: string;
  phone?: string;
};

function useridToEmail(userid: string, email?: string): string {
  return email ?? `${userid}@legacy.local`;
}

function normalizeLegacyPhone(phone?: string): string | null {
  const normalized = phone?.replace(/[^0-9]/g, '') ?? '';
  return normalized || null;
}

function legacySocialUseridWhere(userid: string): Prisma.UserWhereInput | null {
  const match = userid.match(/^(kakao|naver|google|apple)-(.+)$/);
  if (!match) return null;

  return {
    socialAccounts: {
      some: {
        provider: match[1],
        providerUid: match[2],
      },
    },
  };
}

export async function listLegacyMembers(params: {
  page: number;
  limit: number;
  search: string;
  filters?: LegacyMemberListFilters;
}): Promise<LegacyMemberListResult> {
  const skip = (params.page - 1) * params.limit;
  const and: Prisma.UserWhereInput[] = [];

  if (params.search) {
    and.push({
      OR: [
        { loginId: { contains: params.search, mode: 'insensitive' as const } },
        { email: { contains: params.search, mode: 'insensitive' as const } },
        { name: { contains: params.search, mode: 'insensitive' as const } },
        { phone: { contains: params.search } },
      ],
    });
  }

  if (params.filters?.userid) {
    and.push({
      OR: [
        { loginId: { contains: params.filters.userid, mode: 'insensitive' as const } },
        { email: { contains: params.filters.userid, mode: 'insensitive' as const } },
      ],
    });
  }

  if (params.filters?.loginId) {
    and.push({ loginId: { contains: params.filters.loginId, mode: 'insensitive' as const } });
  }

  if (params.filters?.name) {
    and.push({ name: { contains: params.filters.name, mode: 'insensitive' as const } });
  }

  if (params.filters?.email) {
    and.push({ email: { contains: params.filters.email, mode: 'insensitive' as const } });
  }

  const phone = normalizeLegacyPhone(params.filters?.hp ?? params.filters?.phone);
  if (phone) {
    and.push({ phone: { contains: phone } });
  }

  const where: Prisma.UserWhereInput = and.length > 0 ? { AND: and } : {};

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
  const phone = normalizeLegacyPhone(input.hp);
  const duplicateChecks: Prisma.UserWhereInput[] = [
    { loginId: input.userid },
    { email },
    { email: input.userid },
  ];
  if (phone) duplicateChecks.push({ phone });

  const exists = await prisma.user.findFirst({
    where: { OR: duplicateChecks },
    select: { id: true },
  });

  if (exists) return { success: false, message: 'User already exists' };

  await prisma.user.create({
    data: {
      email,
      loginId: input.userid,
      name: input.name,
      phone,
      passwordHash: await hashPassword(input.password),
    },
  });

  return { success: true, message: 'Member registered successfully' };
}

export async function syncLegacyPoint(
  input: LegacyPointSyncInput,
): Promise<{ success: boolean; message: string }> {
  const socialWhere = legacySocialUseridWhere(input.userid);
  const userWhere: Prisma.UserWhereInput[] = [
    { loginId: input.userid },
    { email: input.userid },
    { email: `${input.userid}@legacy.local` },
  ];
  if (socialWhere) userWhere.push(socialWhere);

  const user = await prisma.user.findFirst({
    where: { OR: userWhere },
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
