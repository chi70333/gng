// Legacy sources: idsearch.php, id_loss.php, id_loss_ok.php, id_ok_ajax.php
// Cache: no-cache. Recovery responses are neutral to avoid account enumeration.

import { prisma } from '@/server/db';
import { logger } from '@/lib/logger';
import type { AccountRecoverInput } from '@/schemas/account';
import { hashPassword } from '@/server/services/auth.service';

const TEMP_PASSWORD = 'Q123456$$$';

export async function requestAccountRecovery(
  input: AccountRecoverInput,
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: {
      loginId: input.loginId,
      email: input.email,
      status: 'active',
    },
    select: { id: true },
  });

  if (!user) return;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(TEMP_PASSWORD),
      legacyPasswordHash: null,
      legacyPasswordAlgo: null,
     },
  });

logger.info({ userId: user.id.toString() }, 'temporary password issued');
}
