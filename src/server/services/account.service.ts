// Legacy sources: idsearch.php, id_loss.php, id_loss_ok.php, id_ok_ajax.php
// Cache: no-cache. Recovery responses distinguish whether an active account matched.

import { prisma } from '@/server/db';
import { logger } from '@/lib/logger';
import type { AccountRecoverInput } from '@/schemas/account';
import { hashPassword } from '@/server/services/auth.service';

const TEMP_PASSWORD = 'Q123456$$$';

export async function requestAccountRecovery(input: AccountRecoverInput): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: {
      loginId: input.loginId,
      email: input.email,
      status: 'active',
    },
    select: { id: true },
  });

  if (!user) {
    logger.warn({ loginId: input.loginId }, 'temporary password request did not match an active account');
    return false;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(TEMP_PASSWORD),
      legacyPasswordHash: null,
      legacyPasswordAlgo: null,
    },
  });

  logger.info({ userId: user.id.toString() }, 'temporary password issued');
  return true;
}
