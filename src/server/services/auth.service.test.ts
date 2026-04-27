import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  userCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('argon2', () => ({
  argon2id: 2,
  hash: vi.fn(async () => 'hashed-password'),
  verify: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    user: {
      create: mocks.userCreate,
    },
    $transaction: mocks.transaction,
  },
}));

import { registerSocialUser, registerUser } from './auth.service';

const registerInput = {
  loginId: 'user01',
  email: 'user@example.com',
  name: '홍길동',
  phone: '010-1234-5678',
  zipCode: '06234',
  address1: '서울시 강남구 테헤란로 1',
  address2: '101호',
  password: 'Password123!',
  memberType: 'M' as const,
  marketingAccepted: 'n' as const,
  smsAccepted: 'n' as const,
  termsAccepted: 'y' as const,
  privacyAccepted: 'y' as const,
};

const socialInput = {
  provider: 'kakao' as const,
  providerUid: 'kakao-1',
  email: 'social@example.com',
  name: '소셜회원',
  phone: '010-9876-5432',
  zipCode: '06234',
  address1: '서울시 강남구 테헤란로 1',
  address2: '202호',
  memberType: 'M' as const,
  marketingAccepted: 'n' as const,
  smsAccepted: 'n' as const,
  termsAccepted: 'y' as const,
  privacyAccepted: 'y' as const,
};

describe('auth registration service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a default address with the member in the same write', async () => {
    mocks.userCreate.mockResolvedValueOnce({
      id: 1n,
      email: registerInput.email,
      name: registerInput.name,
    });

    await registerUser(registerInput);

    expect(mocks.userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          addresses: {
            create: expect.objectContaining({
              label: '기본 배송지',
              receiver: '홍길동',
              phone: '01012345678',
              zipCode: '06234',
              address1: '서울시 강남구 테헤란로 1',
              address2: '101호',
              isDefault: true,
            }),
          },
        }),
      }),
    );
  });

  it('creates business profile and consent timestamps for business registration', async () => {
    mocks.userCreate.mockResolvedValueOnce({
      id: 2n,
      email: registerInput.email,
      name: registerInput.name,
    });

    await registerUser({
      ...registerInput,
      memberType: 'D',
      companyName: '지앤지',
      ceoName: '대표자',
      businessNumber: '123-45-67890',
      businessType: '도소매',
      businessItem: '상품',
      businessZipCode: '06234',
      businessAddress1: '서울시 강남구 테헤란로',
      businessAddress2: '사업장 1층',
      marketingAccepted: 'y',
      smsAccepted: 'y',
    });

    expect(mocks.userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          memberType: 'D',
          marketingAgreedAt: expect.any(Date),
          smsAgreedAt: expect.any(Date),
          businessProfile: {
            create: expect.objectContaining({
              companyName: '지앤지',
              businessNumber: '123-45-67890',
            }),
          },
        }),
      }),
    );
  });

  it('creates the user, social account, and default address in one transaction', async () => {
    const txUserCreate = vi.fn().mockResolvedValueOnce({
      id: 3n,
      email: socialInput.email,
      name: socialInput.name,
    });
    mocks.transaction.mockImplementationOnce(async (callback) =>
      callback({
        user: {
          create: txUserCreate,
        },
      }),
    );

    const user = await registerSocialUser(socialInput);

    expect(user).toEqual({
      id: '3',
      email: socialInput.email,
      name: socialInput.name,
      userKind: 'member',
    });
    expect(txUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          addresses: {
            create: expect.objectContaining({
              label: '기본 배송지',
              receiver: '소셜회원',
              phone: '01098765432',
              zipCode: '06234',
              address1: '서울시 강남구 테헤란로 1',
              address2: '202호',
              isDefault: true,
            }),
          },
          socialAccounts: {
            create: {
              provider: 'kakao',
              providerUid: 'kakao-1',
            },
          },
        }),
      }),
    );
  });

  it('maps social unique constraint conflicts to ConflictError', async () => {
    mocks.transaction.mockRejectedValueOnce({ code: 'P2002' });

    await expect(registerSocialUser(socialInput)).rejects.toBeInstanceOf(ConflictError);
  });
});
