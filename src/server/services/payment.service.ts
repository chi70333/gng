// Legacy sources: payaction.php, payaction_adm.php, PG/*
// Cache: no-cache. Payment callbacks are transactional writes.

import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/server/db';
import { createPointLedgerEntry } from '@/server/services/point-ledger.service';
import { transitionOrderStatus } from '@/server/services/order.service';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { PaymentCallbackInput } from '@/schemas/payment';

export type PaymentCallbackResult = {
  orderNo: string;
  status: string;
  duplicate: boolean;
};

type ExpiredHoldCleanupResult = {
  cancelledCount: number;
};

const DEFAULT_HOLD_TTL_MINUTES = 30;

function extractCallbackHash(rawResponse: unknown): string | null {
  if (!rawResponse || typeof rawResponse !== 'object') return null;
  const record = rawResponse as Record<string, unknown>;
  const value = record._callbackHash;
  return typeof value === 'string' ? value : null;
}

function isDuplicateWithoutProviderTxId(
  payment: {
    provider: string | null;
    method: string;
    status: string;
    amount: Decimal;
    rawResponse: Prisma.JsonValue | null;
  },
  input: PaymentCallbackInput,
): boolean {
  const sameProvider = payment.provider === input.provider;
  const sameMethod = payment.method === input.method;
  const sameStatus = payment.status === input.status;
  const sameAmount = payment.amount.eq(new Decimal(input.amount));
  const sameCallbackHash =
    !!input.callbackHash && extractCallbackHash(payment.rawResponse) === input.callbackHash;

  return (sameProvider && sameMethod && sameStatus && sameAmount) || sameCallbackHash;
}

export async function cleanupExpiredOrderHolds(
  now: Date = new Date(),
): Promise<ExpiredHoldCleanupResult> {
  const ttlMinutes = Number.parseInt(
    process.env.ORDER_HOLD_TTL_MINUTES ?? String(DEFAULT_HOLD_TTL_MINUTES),
    10,
  );
  const safeTtlMinutes = Number.isFinite(ttlMinutes) && ttlMinutes > 0
    ? ttlMinutes
    : DEFAULT_HOLD_TTL_MINUTES;
  const cutoff = new Date(now.getTime() - safeTtlMinutes * 60_000);

  const pendingOrders = await prisma.order.findMany({
    where: {
      status: 'pending',
      createdAt: { lte: cutoff },
    },
    select: { id: true, orderNo: true, status: true },
  });

  let cancelledCount = 0;
  for (const pending of pendingOrders) {
    const cancelled = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: pending.id },
        select: {
          id: true,
          orderNo: true,
          status: true,
          userId: true,
          pointsUsed: true,
        },
      });
      if (!order || order.status !== 'pending') return false;

      const approved = await tx.payment.findFirst({
        where: { orderId: order.id, status: 'approved' },
        select: { id: true },
      });
      if (approved) return false;

      await transitionOrderStatus(tx, {
        order,
        nextStatus: 'cancelled',
        actor: 'system',
        reason: 'payment:hold-expired',
      });
      return true;
    });

    if (cancelled) cancelledCount += 1;
  }

  return { cancelledCount };
}

export async function handlePaymentCallback(
  input: PaymentCallbackInput,
): Promise<PaymentCallbackResult> {
  try {
    const cleaned = await cleanupExpiredOrderHolds();
    if (cleaned.cancelledCount > 0) {
      logger.info({ cleaned }, 'Expired order hold cleanup completed');
    }
  } catch (err) {
    logger.warn({ err }, 'Expired order hold cleanup failed');
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderNo: input.orderNo },
      select: {
        id: true,
        orderNo: true,
        total: true,
        subtotal: true,
        discount: true,
        status: true,
        userId: true,
        pointsUsed: true,
        user: { select: { grade: { select: { pointPct: true } } } },
      },
    });

    if (!order) throw new NotFoundError('Order not found.');

    if (input.providerTxId) {
      const existingPayment = await tx.payment.findFirst({
        where: {
          provider: input.provider,
          providerTxId: input.providerTxId,
        },
        select: { id: true },
      });

      if (existingPayment) {
        return { orderNo: input.orderNo, status: order.status, duplicate: true };
      }
    } else {
      const existingPayments = await tx.payment.findMany({
        where: { orderId: order.id },
        select: {
          provider: true,
          method: true,
          status: true,
          amount: true,
          rawResponse: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      if (existingPayments.some((payment) => isDuplicateWithoutProviderTxId(payment, input))) {
        return { orderNo: input.orderNo, status: order.status, duplicate: true };
      }
    }

    if (order.status === 'cancelled' && input.status === 'approved') {
      throw new ConflictError('Order is already cancelled.');
    }

    if (input.status === 'approved' && !new Decimal(input.amount).eq(order.total)) {
      throw new ConflictError('Payment amount mismatch.');
    }

    const nextOrderStatus =
      input.status === 'approved'
        ? 'paid'
        : input.status === 'cancelled' || input.status === 'failed'
          ? 'cancelled'
          : 'pending';

    await tx.payment.create({
      data: {
        orderId: order.id,
        method: input.method,
        provider: input.provider,
        providerTxId: input.providerTxId,
        amount: new Decimal(input.amount),
        status: input.status,
        rawResponse: {
          ...(input.rawResponse && typeof input.rawResponse === 'object'
            ? (input.rawResponse as Record<string, unknown>)
            : { raw: input.rawResponse ?? null }),
          _callbackHash: input.callbackHash ?? null,
          _responseCode: input.responseCode ?? null,
          _responseMessage: input.responseMessage ?? null,
        },
        approvedAt: input.status === 'approved' ? new Date() : null,
      },
    });

    if (nextOrderStatus !== order.status) {
      await transitionOrderStatus(tx, {
        order,
        nextStatus: nextOrderStatus,
        actor: 'system',
        reason: `payment:${input.status}`,
      });
    }

    if (input.status === 'approved' && order.status !== 'paid' && order.userId) {
      const pointPct = order.user?.grade?.pointPct ?? new Decimal(0);
      const earnBase = Decimal.max(order.subtotal.minus(order.discount), 0);
      const pointsToEarn = earnBase.mul(pointPct).div(100).floor().toNumber();
      if (pointsToEarn > 0) {
        await createPointLedgerEntry(tx, {
          userId: order.userId,
          delta: pointsToEarn,
          reason: `주문 ${order.orderNo} 포인트 적립`,
          orderId: order.id,
          expireAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
        });
      }
    }

    return { orderNo: input.orderNo, status: nextOrderStatus, duplicate: false };
  });

  return result;
}
