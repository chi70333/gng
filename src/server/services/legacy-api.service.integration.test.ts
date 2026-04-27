import argon2 from 'argon2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/server/db';
import {
  listLegacyMembers,
  registerLegacyMember,
  syncLegacyPoint,
} from '@/server/services/legacy-api.service';

const enabled = process.env.GNG_DB_INTEGRATION_TEST_ENABLED === '1';
const describeIntegration = enabled ? describe : describe.skip;

const runId = `${process.env.GNG_TEST_USER_PREFIX ?? 'gng_ext'}_${Date.now()}`;

async function cleanupTestUsers() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { loginId: { startsWith: runId } },
        { email: { startsWith: runId } },
      ],
    },
    select: { id: true },
  });

  if (users.length === 0) return;

  const userIds = users.map((user) => user.id);
  await prisma.userPointHistory.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describeIntegration('legacy API service DB integration', () => {
  beforeAll(async () => {
    await cleanupTestUsers();
  });

  afterAll(async () => {
    await cleanupTestUsers();
    await prisma.$disconnect();
  });

  it('registers a legacy member with fallback email, normalized phone, and argon2id password hash', async () => {
    const userid = `${runId}_member`;
    const result = await registerLegacyMember({
      userid,
      password: 'Password123!',
      name: '통합 테스트',
      hp: '010-1234-5678',
    });

    expect(result).toEqual({
      success: true,
      message: 'Member registered successfully',
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { loginId: userid },
      select: {
        loginId: true,
        email: true,
        phone: true,
        name: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    expect(user.loginId).toBe(userid);
    expect(user.email).toBe(`${userid}@legacy.local`);
    expect(user.phone).toBe('01012345678');
    expect(user.name).toBe('통합 테스트');
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    await expect(argon2.verify(user.passwordHash ?? '', 'Password123!')).resolves.toBe(true);
    expect(user.createdAt).toBeInstanceOf(Date);

    await expect(
      registerLegacyMember({
        userid,
        password: 'Password123!',
        name: '중복 테스트',
      }),
    ).resolves.toEqual({ success: false, message: 'User already exists' });
  });

  it('syncs point ledger entries and exposes the latest balance through list_members', async () => {
    const userid = `${runId}_points`;
    await registerLegacyMember({
      userid,
      password: 'Password123!',
      name: '포인트 테스트',
      email: `${userid}@example.test`,
    });

    await expect(
      syncLegacyPoint({
        userid,
        amount: 500,
        new_balance: 500,
        reason: '외부 적립',
      }),
    ).resolves.toEqual({
      success: true,
      message: 'Point Synchronized Successfully',
    });

    await syncLegacyPoint({
      userid,
      amount: -200,
      new_balance: 300,
      reason: '외부 사용',
    });

    await syncLegacyPoint({
      userid,
      amount: 700,
      new_balance: 1000,
      reason: '외부 잔액 보정',
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { loginId: userid },
      select: {
        pointHistories: {
          orderBy: { createdAt: 'asc' },
          select: { delta: true, balance: true, reason: true },
        },
      },
    });

    expect(user.pointHistories).toEqual([
      { delta: 500, balance: 500, reason: '외부 적립' },
      { delta: -200, balance: 300, reason: '외부 사용' },
      { delta: 700, balance: 1000, reason: '외부 잔액 보정' },
    ]);

    const members = await listLegacyMembers({ page: 1, limit: 10, search: userid });
    expect(members.members).toEqual([
      expect.objectContaining({
        userid,
        mileage: 1000,
      }),
    ]);
  });

  it('rejects point sync for a missing member without creating ledger rows', async () => {
    await expect(
      syncLegacyPoint({
        userid: `${runId}_missing`,
        amount: 100,
        new_balance: 100,
      }),
    ).resolves.toEqual({ success: false, message: 'User not found' });
  });
});
