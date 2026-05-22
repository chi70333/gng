import { redirect } from 'next/navigation';
import { cache } from 'react';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import type { AdminPermission } from '@/schemas/admin-auth';
import { ForbiddenError } from '@/lib/errors';

export type CurrentAdmin = {
  id: bigint;
  loginId: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
};

function permissionsFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function canAdmin(
  admin: Pick<CurrentAdmin, 'role' | 'permissions'> & { loginId?: string | null },
  permission: AdminPermission,
): boolean {
  return (
    admin.role === 'super_admin' ||
    admin.loginId === 'admin' ||
    admin.permissions.includes(permission)
  );
}

export function assertAdminPermission(
  admin: Pick<CurrentAdmin, 'role' | 'permissions'> & { loginId?: string | null },
  permission: AdminPermission,
): void {
  if (!canAdmin(admin, permission)) throw new ForbiddenError('관리자 권한이 없습니다.');
}

const getCurrentAdmin = cache(async (): Promise<CurrentAdmin> => {
  const session = await auth();

  if (
    !session?.user?.id ||
    session.user.userKind !== 'admin' ||
    typeof session.user.sessionVersion !== 'number'
  ) {
    redirect('/admin/login');
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: BigInt(session.user.id) },
    select: {
      id: true,
      loginId: true,
      email: true,
      name: true,
      role: true,
      permissions: true,
      status: true,
      sessionVersion: true,
      deletedAt: true,
    },
  });

  if (
    !admin ||
    admin.deletedAt ||
    admin.status !== 'active' ||
    admin.sessionVersion !== session.user.sessionVersion
  ) {
    redirect('/admin/login');
  }

  const currentAdmin = {
    id: admin.id,
    loginId: admin.loginId,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    permissions: permissionsFromJson(admin.permissions),
  };

  return currentAdmin;
});

export async function requireAdmin(permission?: AdminPermission): Promise<CurrentAdmin> {
  const currentAdmin = await getCurrentAdmin();

  if (permission) assertAdminPermission(currentAdmin, permission);
  return currentAdmin;
}
