// Legacy sources: mypage_point.php, point_table writes, api/point_sync.php
// Cache: no-store. Point balance is an authenticated ledger snapshot.

import type { Prisma } from '@prisma/client';

type PointLedgerTx = Prisma.TransactionClient;

export async function getPointBalance(
  tx: PointLedgerTx,
  userId: bigint,
): Promise<number> {
  const latest = await tx.userPointHistory.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { balance: true },
  });

  return latest?.balance ?? 0;
}

export async function createPointLedgerEntry(
  tx: PointLedgerTx,
  input: {
    userId: bigint;
    delta: number;
    reason: string;
    orderId?: bigint | null;
    expireAt?: Date | null;
    forcedBalance?: number;
  },
) {
  const previousBalance = await getPointBalance(tx, input.userId);
  const nextBalance = input.forcedBalance ?? previousBalance + input.delta;

  if (nextBalance < 0) {
    throw new Error('POINT_BALANCE_NEGATIVE');
  }

  return tx.userPointHistory.create({
    data: {
      userId: input.userId,
      delta: input.delta,
      balance: nextBalance,
      reason: input.reason,
      orderId: input.orderId ?? null,
      expireAt: input.expireAt ?? null,
    },
  });
}
