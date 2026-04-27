// Legacy sources: idsearch.php, id_loss.php, id_loss_ok.php, id_ok_ajax.php
// Cache: no-cache. Recovery responses are neutral to avoid account enumeration.

import { prisma } from '@/server/db';
import { logger } from '@/lib/logger';
import type { AccountRecoverInput } from '@/schemas/account';

export async function requestAccountRecovery(
  input: AccountRecoverInput,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (!user) return;

  // TODO(P1): enqueue email/SMS recovery through QStash after provider selection.
  logger.info({ userId: user.id.toString() }, 'account recovery requested');
}
