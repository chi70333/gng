// Legacy sources: payaction.php, payaction_adm.php, PG/*
// Cache: no-cache. Payment callbacks are transactional writes.

import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/server/db';
import { createPointLedgerEntry } from '@/server/services/point-ledger.service';
import { lockOrderForUpdate, transitionOrderStatus } from '@/server/services/order.service';
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

function logPaymentStep(
  step: string,
  startedAt: number,
  extra: Record<string, unknown> = {},
): void {
  logger.info(
    {
      area: 'payment',
      step,
      durationMs: Date.now() - startedAt,
      ...extra,
    },
    `payment ${step}`,
  );
}

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
      payments: {
        some: {
          provider: { not: 'manual-bank' },
        },
      },
    },
    select: { id: true, orderNo: true, status: true },
  });

  let cancelledCount = 0;
  for (const pending of pendingOrders) {
    const cancelled = await prisma.$transaction(async (tx) => {
      await lockOrderForUpdate(tx, pending.orderNo);
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
  const callbackStartedAt = Date.now();
  const result = await prisma.$transaction(async (tx) => {
    const transactionStartedAt = Date.now();
    await lockOrderForUpdate(tx, input.orderNo);
    logPaymentStep('lockOrder', transactionStartedAt, {
      orderNo: input.orderNo,
      provider: input.provider,
      status: input.status,
    });

    const orderLookupStartedAt = Date.now();
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
    logPaymentStep('orderLookup', orderLookupStartedAt, {
      orderNo: input.orderNo,
      currentStatus: order.status,
    });

    if (input.providerTxId) {
      const duplicateStartedAt = Date.now();
      const existingPayment = await tx.payment.findFirst({
        where: {
          provider: input.provider,
          providerTxId: input.providerTxId,
        },
        select: { id: true },
      });

      if (existingPayment) {
        logPaymentStep('duplicate', duplicateStartedAt, {
          orderNo: input.orderNo,
          duplicate: true,
          reason: 'providerTxId',
        });
        return { orderNo: input.orderNo, status: order.status, duplicate: true };
      }
      logPaymentStep('duplicateCheck', duplicateStartedAt, {
        orderNo: input.orderNo,
        duplicate: false,
        reason: 'providerTxId',
      });
    } else {
      const duplicateStartedAt = Date.now();
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
        logPaymentStep('duplicate', duplicateStartedAt, {
          orderNo: input.orderNo,
          duplicate: true,
          reason: 'callbackHash',
        });
        return { orderNo: input.orderNo, status: order.status, duplicate: true };
      }
      logPaymentStep('duplicateCheck', duplicateStartedAt, {
        orderNo: input.orderNo,
        duplicate: false,
        checkedPayments: existingPayments.length,
      });
    }

    if (order.status === 'cancelled' && input.status === 'approved') {
      throw new ConflictError('Order is already cancelled.');
    }

    if (input.status === 'approved' && !new Decimal(input.amount).eq(order.total)) {
      throw new ConflictError('Payment amount mismatch.');
    }

    if (order.status === 'paid' && input.status === 'approved') {
      return { orderNo: input.orderNo, status: order.status, duplicate: true };
    }

    const nextOrderStatus =
      input.status === 'approved'
        ? 'paid'
        : input.status === 'cancelled' || input.status === 'failed'
          ? 'cancelled'
          : 'pending';

    const paymentCreateStartedAt = Date.now();
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
    logPaymentStep('paymentCreate', paymentCreateStartedAt, {
      orderNo: input.orderNo,
      provider: input.provider,
      status: input.status,
    });

    const statusStartedAt = Date.now();
    const statusChanged =
      nextOrderStatus !== order.status
        ? await transitionOrderStatus(tx, {
            order,
            nextStatus: nextOrderStatus,
            actor: 'system',
            reason: `payment:${input.status}`,
          })
        : false;
    logPaymentStep('statusTransition', statusStartedAt, {
      orderNo: input.orderNo,
      fromStatus: order.status,
      nextStatus: nextOrderStatus,
      statusChanged,
    });

    if (input.status === 'approved' && statusChanged && order.userId) {
      const pointsStartedAt = Date.now();
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
      logPaymentStep('pointsEarn', pointsStartedAt, {
        orderNo: input.orderNo,
        pointsToEarn,
      });
    }

    logPaymentStep('transaction', transactionStartedAt, {
      orderNo: input.orderNo,
      nextStatus: nextOrderStatus,
      duplicate: false,
      statusChanged,
    });

    return { orderNo: input.orderNo, status: nextOrderStatus, duplicate: false };
  });

  logPaymentStep('complete', callbackStartedAt, {
    orderNo: input.orderNo,
    provider: input.provider,
    status: result.status,
    duplicate: result.duplicate,
  });

  return result;
}
