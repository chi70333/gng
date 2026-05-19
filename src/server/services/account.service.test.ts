import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    user: {
      findFirst: mocks.userFindFirst,
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
  },
}));

vi.mock('./auth.service', () => ({
  hashPassword: mocks.hashPassword,
}));

import { resetAccountPassword } from './account.service';

describe('account service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hashPassword.mockResolvedValue('hashed-reset-password');
  });

  it('resets only the matched active member password by login id and email', async () => {
    mocks.userFindFirst.mockResolvedValueOnce({ id: 123n });

    await resetAccountPassword({
      loginId: 'kakao-1234567890',
      email: 'member@example.com',
      password: 'NewPassword123!',
      passwordConfirm: 'NewPassword123!',
    });

    expect(mocks.userFindFirst).toHaveBeenCalledWith({
      where: {
        loginId: 'kakao-1234567890',
        email: 'member@example.com',
        status: 'active',
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 123n },
      data: {
        passwordHash: 'hashed-reset-password',
        legacyPasswordHash: null,
        legacyPasswordAlgo: null,
      },
    });
  });

  it('does not update anything when the login id and email do not match', async () => {
    mocks.userFindFirst.mockResolvedValueOnce(null);

    await resetAccountPassword({
      loginId: 'missing-user',
      email: 'member@example.com',
      password: 'NewPassword123!',
      passwordConfirm: 'NewPassword123!',
    });

    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });
});
