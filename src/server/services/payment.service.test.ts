import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import type { PaymentCallbackInput } from '@/schemas/payment';

const mocks = vi.hoisted(() => {
  const tx = {
    order: {
      findUnique: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  };

  return {
    tx,
    transaction: vi.fn(),
    lockOrderForUpdate: vi.fn(),
    transitionOrderStatus: vi.fn(),
    loggerInfo: vi.fn(),
  };
});

vi.mock('@/server/db', () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

vi.mock('@/server/services/order.service', () => ({
  lockOrderForUpdate: mocks.lockOrderForUpdate,
  transitionOrderStatus: mocks.transitionOrderStatus,
}));

vi.mock('@/server/services/point-ledger.service', () => ({
  createPointLedgerEntry: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { handlePaymentCallback } from './payment.service';

const approvedCallback = {
  orderNo: 'ORDER-PAID',
  provider: 'ksnet',
  providerTxId: 'TX-1',
  method: 'card',
  amount: 12000,
  status: 'approved',
  responseCode: '0000',
  responseMessage: 'OK',
  callbackHash: 'hash-1',
  rawResponse: { resultcd: '0000' },
} satisfies PaymentCallbackInput;

describe('payment callback service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(
      async (callback: (tx: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx),
    );
    mocks.tx.order.findUnique.mockResolvedValue({
      id: 11n,
      orderNo: 'ORDER-PAID',
      total: new Decimal(12000),
      subtotal: new Decimal(12000),
      discount: new Decimal(0),
      status: 'pending',
      userId: null,
      pointsUsed: 0,
      user: null,
    });
    mocks.tx.payment.findFirst.mockResolvedValue(null);
    mocks.tx.payment.findMany.mockResolvedValue([]);
    mocks.tx.payment.create.mockResolvedValue({ id: 21n });
    mocks.transitionOrderStatus.mockResolvedValue(true);
  });

  it('records payment timing logs around callback processing', async () => {
    const result = await handlePaymentCallback(approvedCallback);

    expect(result).toEqual({ orderNo: 'ORDER-PAID', status: 'paid', duplicate: false });
    expect(mocks.lockOrderForUpdate).toHaveBeenCalledWith(mocks.tx, 'ORDER-PAID');
    expect(mocks.tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: 'ksnet',
          providerTxId: 'TX-1',
          status: 'approved',
        }),
      }),
    );
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        area: 'payment',
        step: 'statusTransition',
        orderNo: 'ORDER-PAID',
        statusChanged: true,
      }),
      'payment statusTransition',
    );
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        area: 'payment',
        step: 'complete',
        orderNo: 'ORDER-PAID',
        duplicate: false,
      }),
      'payment complete',
    );
  });
});
