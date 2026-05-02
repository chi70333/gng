import { expect, test } from '@playwright/test';
import { prisma } from '../../src/server/db';
import { hashPassword } from '../../src/server/services/auth.service';

const enabled = process.env.GNG_E2E_AUTH_TEST_ENABLED === '1';
const runId = `${process.env.GNG_TEST_USER_PREFIX ?? 'gng_ext'}_${Date.now()}`;

test.describe('[GNG] legacy join and points mobile flow', () => {
  test.skip(!enabled, 'Set GNG_E2E_AUTH_TEST_ENABLED=1 to run DB-backed auth E2E tests.');

  test.afterAll(async () => {
    const users = await prisma.user.findMany({
      where: {
        OR: [{ loginId: { startsWith: runId } }, { email: { startsWith: runId } }],
      },
      select: { id: true },
    });

    if (users.length > 0) {
      const userIds = users.map((user) => user.id);
      await prisma.userPointHistory.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    await prisma.$disconnect();
  });

  test('requires terms before join and completes a mobile registration flow', async ({ page }) => {
    const userid = `${runId}_join`;

    await page.goto('/join');
    await expect(page).toHaveURL(/\/join\/terms/);

    await page.getByRole('button', { name: '모두동의' }).click();
    await page.getByRole('button', { name: '다음' }).click();
    await expect(page).toHaveURL(/\/join$/);

    await page.locator('input[name="loginId"]').fill(userid);
    await page.locator('input[name="password"]').fill('Password123!');
    await page.locator('input[name="name"]').fill('가입 테스트');
    await page.locator('input[name="email"]').fill(`${userid}@example.test`);
    await page.locator('input[name="phone"]').fill('01012345678');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/login\?registered=1/);

    const created = await prisma.user.findUnique({
      where: { loginId: userid },
      select: { loginId: true, email: true, phone: true },
    });
    expect(created).toEqual({
      loginId: userid,
      email: `${userid}@example.test`,
      phone: '01012345678',
    });
  });

  test('shows point ledger rows after login', async ({ page }) => {
    const userid = `${runId}_points`;
    const user = await prisma.user.create({
      data: {
        loginId: userid,
        email: `${userid}@example.test`,
        name: '포인트 테스트',
        phone: `010${String(Date.now()).slice(-8)}`,
        passwordHash: await hashPassword('Password123!'),
      },
      select: { id: true },
    });

    await prisma.userPointHistory.createMany({
      data: [
        {
          userId: user.id,
          delta: 1200,
          balance: 1200,
          reason: '외부 적립',
        },
        {
          userId: user.id,
          delta: -200,
          balance: 1000,
          reason: '외부 사용',
        },
      ],
    });

    await page.goto('/login?callbackUrl=/mypage/points');
    await page.locator('input[name="loginId"]').fill(userid);
    await page.locator('input[name="password"]').fill('Password123!');
    await page.getByRole('button', { name: '로그인', exact: true }).click();

    await expect(page).toHaveURL(/\/mypage\/points/);
    await expect(page.getByRole('link', { name: /전체/ })).toBeVisible();
    await expect(page.getByText('외부 적립')).toBeVisible();
    await expect(page.getByText('+1,200원')).toBeVisible();
    await expect(page.getByText('외부 사용')).toBeVisible();
    await expect(page.getByText('-200원')).toBeVisible();
  });
});
