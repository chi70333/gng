// Legacy sources: idsearch.php, id_loss.php, id_loss_ok.php, id_ok_ajax.php
// Cache: no-cache. Recovery responses are neutral to avoid account enumeration.

import { prisma } from '@/server/db';
import { logger } from '@/lib/logger';
import type { AccountRecoverInput, PasswordResetInput } from '@/schemas/account';
import { hashPassword } from './auth.service';

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

export async function resetAccountPassword(input: PasswordResetInput): Promise<void> {
  const user = await prisma.user.findFirst({
    where: {
      loginId: input.loginId,
      email: input.email,
      status: 'active',
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!user) return;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(input.password),
      legacyPasswordHash: null,
      legacyPasswordAlgo: null,
    },
  });

  logger.info({ userId: user.id.toString() }, 'account password reset completed');
}
