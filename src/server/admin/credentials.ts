// Legacy sources: wb_admin/login_ok.php, wb_admin/adm_ok.php
// Admin passwords use argon2id. Legacy hashes are rehashed on first successful login.

import { createHash, timingSafeEqual } from 'crypto';
import { prisma } from '@/server/db';
import { adminLoginSchema, type AdminLoginInput } from '@/schemas/admin-auth';
import { hashPassword } from '@/server/services/auth.service';

export type AdminSessionUser = {
  id: string;
  email: string;
  name: string;
  userKind: 'admin';
  adminRole: string;
  permissions: string[];
  sessionVersion: number;
};

async function getArgon2(): Promise<typeof import('argon2')> {
  return import('argon2');
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function digest(algo: 'md5' | 'sha1', password: string): string {
  return createHash(algo).update(password).digest('hex');
}

function mysqlOldPassword(password: string): string {
  let nr = 1345345333n;
  let add = 7n;
  let nr2 = 0x12345671n;

  for (const char of password) {
    if (char === ' ' || char === '\t') continue;
    const tmp = BigInt(char.charCodeAt(0));
    nr ^= (((nr & 63n) + add) * tmp) + (nr << 8n);
    nr2 += (nr2 << 8n) ^ nr;
    add += tmp;
  }

  const mask = 0x7fffffffn;
  return `${(nr & mask).toString(16).padStart(8, '0')}${(nr2 & mask)
    .toString(16)
    .padStart(8, '0')}`;
}

function permissionsFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function verifyLegacyPassword(
  password: string,
  hash: string | null,
  algo: string | null,
): boolean {
  if (!hash || !algo) return false;
  const normalizedHash = hash.toLowerCase();
  if (algo === 'md5') return safeEqual(digest('md5', password), normalizedHash);
  if (algo === 'sha1') return safeEqual(digest('sha1', password), normalizedHash);
  if (algo === 'mysql_old_password') {
    return safeEqual(mysqlOldPassword(password), normalizedHash);
  }
  return false;
}

export async function verifyAdminCredentials(
  input: AdminLoginInput,
): Promise<AdminSessionUser | null> {
  const parsed = adminLoginSchema.safeParse(input);
  if (!parsed.success) return null;

  const loginId = parsed.data.loginId;
  const admin = await prisma.adminUser.findFirst({
    where: {
      deletedAt: null,
      OR: [{ loginId }, { email: loginId }],
    },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      legacyPasswordHash: true,
      legacyPasswordAlgo: true,
      role: true,
      permissions: true,
      status: true,
      sessionVersion: true,
    },
  });

  if (!admin || admin.status !== 'active') return null;

  const argon2 = await getArgon2();
  const passwordOk = admin.passwordHash
    ? await argon2.verify(admin.passwordHash, parsed.data.password)
    : false;

  const legacyOk = passwordOk
    ? false
    : verifyLegacyPassword(
        parsed.data.password,
        admin.legacyPasswordHash,
        admin.legacyPasswordAlgo,
      );

  if (!passwordOk && !legacyOk) return null;

  const updated = await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      lastLoginAt: new Date(),
      ...(legacyOk
        ? {
            passwordHash: await hashPassword(parsed.data.password),
            legacyPasswordHash: null,
            legacyPasswordAlgo: null,
            sessionVersion: { increment: 1 },
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      permissions: true,
      sessionVersion: true,
    },
  });

  return {
    id: updated.id.toString(),
    email: updated.email,
    name: updated.name,
    userKind: 'admin',
    adminRole: updated.role,
    permissions: permissionsFromJson(updated.permissions),
    sessionVersion: updated.sessionVersion,
  };
}
