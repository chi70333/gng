// Legacy sources: mypage_point.php, point_table writes, api/point_sync.php
// Cache: no-store. Point balance is an authenticated ledger snapshot.

import type { Prisma } from '@prisma/client';

type PointLedgerTx = Prisma.TransactionClient;

export async function getPointBalance(tx: PointLedgerTx, userId: bigint): Promise<number> {
  const latest = await tx.userPointHistory.findFirst({
    where: { userId },
    orderBy: { id: 'desc' },
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

export async function createPointLedgerBalanceEntry(
  tx: PointLedgerTx,
  input: {
    userId: bigint;
    targetBalance: number;
    reason: string;
    orderId?: bigint | null;
    expireAt?: Date | null;
  },
) {
  const previousBalance = await getPointBalance(tx, input.userId);

  if (input.targetBalance < 0) {
    throw new Error('POINT_BALANCE_NEGATIVE');
  }

  return tx.userPointHistory.create({
    data: {
      userId: input.userId,
      delta: input.targetBalance - previousBalance,
      balance: input.targetBalance,
      reason: input.reason,
      orderId: input.orderId ?? null,
      expireAt: input.expireAt ?? null,
    },
  });
}

export async function deletePointLedgerEntry(
  tx: PointLedgerTx,
  input: {
    userId: bigint;
    pointId: bigint;
  },
) {
  const target = await tx.userPointHistory.findFirst({
    where: {
      id: input.pointId,
      userId: input.userId,
    },
    select: {
      id: true,
      delta: true,
      reason: true,
    },
  });

  if (!target) return null;

  await tx.userPointHistory.delete({
    where: { id: target.id },
  });

  return {
    deletedId: target.id,
    delta: target.delta,
    balance: await getPointBalance(tx, input.userId),
    reason: target.reason,
  };
}
