// Legacy sources: login.php, login_ok.php, member_join.php, member_join_ok.php
// Password policy: argon2id timeCost 3, memoryCost 64MB. Legacy hashes are rehashed on first successful login.

import { createHash, timingSafeEqual } from 'crypto';
import { prisma } from '@/server/db';
import { ConflictError } from '@/lib/errors';
import type { LoginInput, RegisterInput, SocialRegisterInput } from '@/schemas/auth';

type AuthUser = {
  id: string;
  email: string;
  name: string;
  userKind: 'member';
};

export type SocialProvider = 'kakao' | 'naver';

export class SocialAccountNotRegisteredError extends Error {
  constructor() {
    super('SOCIAL_ACCOUNT_NOT_REGISTERED');
    this.name = 'SocialAccountNotRegisteredError';
  }
}

type SocialLoginInput = {
  provider: SocialProvider;
  providerUid: string;
  email: string;
  name?: string | null;
};

type Argon2Module = typeof import('argon2');

async function getArgon2(): Promise<Argon2Module> {
  return import('argon2');
}

function normalizePhone(phone: string | undefined): string | undefined {
  const normalized = phone?.replace(/[^0-9]/g, '');
  return normalized ? normalized : undefined;
}

function consentedAt(value: 'y' | 'n'): Date | undefined {
  return value === 'y' ? new Date() : undefined;
}

function businessProfileData(input: RegisterInput | SocialRegisterInput) {
  if (input.memberType !== 'D') return undefined;

  return {
    create: {
      companyName: input.companyName || null,
      ceoName: input.ceoName || null,
      businessNumber: input.businessNumber || null,
      businessType: input.businessType || null,
      businessItem: input.businessItem || null,
      zipCode: input.businessZipCode || null,
      address1: input.businessAddress1 || null,
      address2: input.businessAddress2 || null,
    },
  };
}

function digest(algo: 'md5' | 'sha1', password: string): string {
  return createHash(algo).update(password).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function verifyLegacyPassword(
  password: string,
  hash: string | null,
  algo: string | null,
): boolean {
  if (!hash || !algo) return false;
  if (algo === 'md5') return safeEqual(digest('md5', password), hash);
  if (algo === 'sha1') return safeEqual(digest('sha1', password), hash);
  return false;
}

export async function hashPassword(password: string): Promise<string> {
  const argon2 = await getArgon2();
  return argon2.hash(password, {
    type: argon2.argon2id,
    timeCost: 3,
    memoryCost: 65536,
    parallelism: 1,
  });
}

export async function registerUser(input: RegisterInput): Promise<AuthUser> {
  const passwordHash = await hashPassword(input.password);
  const phone = normalizePhone(input.phone);

  try {
    const user = await prisma.user.create({
      data: {
        loginId: input.loginId,
        email: input.email,
        name: input.name,
        phone,
        passwordHash,
        memberType: input.memberType,
        marketingAgreedAt: consentedAt(input.marketingAccepted),
        smsAgreedAt: consentedAt(input.smsAccepted),
        addresses: {
          create: {
            label: '기본 배송지',
            receiver: input.name,
            phone: phone ?? input.phone,
            zipCode: input.zipCode,
            address1: input.address1,
            address2: input.address2,
            isDefault: true,
          },
        },
        businessProfile: businessProfileData(input),
      },
      select: { id: true, email: true, name: true },
    });

    return { id: user.id.toString(), email: user.email, name: user.name, userKind: 'member' };
  } catch (err) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      err.code === 'P2002'
    ) {
      throw new ConflictError('Login ID, email or phone already exists.');
    }
    throw err;
  }
}

export async function registerSocialUser(
  input: SocialRegisterInput & { provider: SocialProvider; providerUid: string },
): Promise<AuthUser> {
  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new ConflictError('Phone is required.');
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          phone,
          memberType: input.memberType,
          marketingAgreedAt: consentedAt(input.marketingAccepted),
          smsAgreedAt: consentedAt(input.smsAccepted),
          addresses: {
            create: {
              label: '기본 배송지',
              receiver: input.name,
              phone: phone ?? input.phone,
              zipCode: input.zipCode,
              address1: input.address1,
              address2: input.address2,
              isDefault: true,
            },
          },
          businessProfile: businessProfileData(input),
          socialAccounts: {
            create: {
              provider: input.provider,
              providerUid: input.providerUid,
            },
          },
        },
        select: { id: true, email: true, name: true },
      });

      return created;
    });

    return { id: user.id.toString(), email: user.email, name: user.name, userKind: 'member' };
  } catch (err) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      err.code === 'P2002'
    ) {
      throw new ConflictError('Email, phone or social account already exists.');
    }
    throw err;
  }
}

export async function verifyCredentials(input: LoginInput): Promise<AuthUser | null> {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ loginId: input.loginId }, { email: input.loginId }],
    },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      legacyPasswordHash: true,
      legacyPasswordAlgo: true,
      status: true,
    },
  });

  if (!user || user.status !== 'active') return null;

  const argon2 = await getArgon2();

  if (user.passwordHash && (await argon2.verify(user.passwordHash, input.password))) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    });
    return { id: user.id.toString(), email: user.email, name: user.name, userKind: 'member' };
  }

  const legacyOk = verifyLegacyPassword(
    input.password,
    user.legacyPasswordHash,
    user.legacyPasswordAlgo,
  );

  if (!legacyOk) return null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(input.password),
      legacyPasswordHash: null,
      legacyPasswordAlgo: null,
      lastLoginAt: new Date(),
      loginCount: { increment: 1 },
    },
  });

  return { id: user.id.toString(), email: user.email, name: user.name, userKind: 'member' };
}

export async function linkSocialUser(input: SocialLoginInput): Promise<AuthUser> {
  const user = await prisma.$transaction(async (tx) => {
    const socialAccount = await tx.userSocialAccount.findUnique({
      where: {
        provider_providerUid: {
          provider: input.provider,
          providerUid: input.providerUid,
        },
      },
      select: {
        user: {
          select: { id: true, email: true, name: true, status: true },
        },
      },
    });

    if (socialAccount) {
      if (socialAccount.user.status !== 'active') {
        throw new Error('SOCIAL_ACCOUNT_INACTIVE');
      }

      return tx.user.update({
        where: { id: socialAccount.user.id },
        data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
        select: { id: true, email: true, name: true },
      });
    }

    throw new SocialAccountNotRegisteredError();
  });

  return { id: user.id.toString(), email: user.email, name: user.name, userKind: 'member' };
}
