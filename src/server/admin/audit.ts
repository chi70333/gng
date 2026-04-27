import { headers } from 'next/headers';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import type { CurrentAdmin } from '@/server/admin/auth';

export async function writeAdminAuditLog(input: {
  admin: Pick<CurrentAdmin, 'id'>;
  action: string;
  entity: string;
  entityId?: string;
  payload?: Prisma.InputJsonValue;
}) {
  const headerList = headers();
  const forwardedFor = headerList.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = headerList.get('x-real-ip');

  await prisma.auditLog.create({
    data: {
      actorId: `admin:${input.admin.id.toString()}`,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      payload: input.payload,
      ip: forwardedFor || realIp || null,
    },
  });
}
