import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateOrderInput } from '@/schemas/order';

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    order: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    product: {
      update: vi.fn(),
    },
    userAddress: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  };

  return {
    tx,
    transaction: vi.fn(),
    userFindUnique: vi.fn(),
    getOrderReadyItem: vi.fn(),
    getPointBalance: vi.fn(),
    createPointLedgerEntry: vi.fn(),
    loggerInfo: vi.fn(),
  };
});

vi.mock('@/server/db', () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock('@/server/services/cart.service', () => ({
  clearCart: vi.fn(),
  deleteCartItems: vi.fn(),
  getCart: vi.fn(),
  getOrderReadyItem: mocks.getOrderReadyItem,
}));

vi.mock('@/server/services/coupon.service', () => ({
  calculateCouponDiscount: vi.fn(),
  markCouponUsed: vi.fn(),
}));

vi.mock('@/server/services/point-ledger.service', () => ({
  createPointLedgerEntry: mocks.createPointLedgerEntry,
  getPointBalance: mocks.getPointBalance,
}));

vi.mock('@/lib/legacy-order-code', () => ({
  createLegacyOrderCode: () => 'ORDER-ZERO',
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mocks.loggerInfo,
  },
}));

import { createOrderFromDirectItem } from './order.service';

const zeroPointOrderInput = {
  buyerName: '홍길동',
  buyerEmail: 'hong@example.com',
  buyerPhone: '01012345678',
  receiver: '홍길동',
  phone: '01012345678',
  zipCode: '06234',
  address1: '서울시 강남구 테헤란로 1',
  address2: '',
  memo: '',
  paymentMethod: 'bank',
  depositorName: '홍길동',
  cashReceiptType: 'none',
  cashReceiptIdentity: '',
  taxInvoiceRequested: false,
  taxInvoiceCompanyName: '',
  taxInvoiceBusinessNumber: '',
  saveShippingAddress: false,
  pointsToUse: 2_000_000,
} satisfies CreateOrderInput;

describe('order checkout service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(
      async (callback: (tx: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx),
    );
    mocks.userFindUnique.mockResolvedValue({ id: 7n, grade: { pointPct: 0 } });
    mocks.tx.order.findFirst.mockResolvedValue(null);
    mocks.tx.$queryRaw.mockResolvedValue([{ id: 7n }]);
    mocks.tx.$executeRaw.mockResolvedValue(1);
    mocks.tx.order.create.mockResolvedValue({ id: 11n });
    mocks.getPointBalance.mockResolvedValue(2_000_000);
    mocks.getOrderReadyItem.mockResolvedValue({
      productId: '3',
      skuId: '1',
      name: '테스트 상품',
      thumbnail: null,
      optionSummary: null,
      unitPrice: '2000000',
      quantity: 1,
      isAvailable: true,
    });
  });

  it('marks a fully point-paid zero-won order as paid immediately', async () => {
    const order = await createOrderFromDirectItem({
      identity: { type: 'user', id: 'hong@example.com' },
      orderInput: zeroPointOrderInput,
      skuId: '1',
      quantity: 1,
    });

    expect(order).toEqual({ orderNo: 'ORDER-ZERO', total: '0', status: 'paid' });
    const orderCreateInput = mocks.tx.order.create.mock.calls[0]?.[0];
    expect(mocks.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mocks.tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(mocks.tx.product.update).toHaveBeenCalledWith({
      where: { id: 3n },
      data: { soldCount: { increment: 1 } },
    });
    expect(mocks.tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'paid',
          payments: {
            create: expect.objectContaining({
              method: 'point',
              provider: 'internal-point',
              status: 'approved',
              approvedAt: expect.any(Date),
              rawResponse: expect.objectContaining({
                paymentMethod: 'point',
                pointsUsed: 2_000_000,
                zeroCheckout: true,
              }),
            }),
          },
          history: {
            create: expect.objectContaining({
              toStatus: 'paid',
              reason: 'checkout:zero-total',
            }),
          },
        }),
      }),
    );
    expect(orderCreateInput?.data.total.toString()).toBe('0');
    expect(mocks.createPointLedgerEntry).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({
        userId: 7n,
        delta: -2_000_000,
        orderId: 11n,
      }),
    );
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        area: 'checkout',
        step: 'directItemHydrate',
        durationMs: expect.any(Number),
      }),
      'checkout directItemHydrate',
    );
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        area: 'checkout',
        step: 'stockFinalize',
        orderNo: 'ORDER-ZERO',
      }),
      'checkout stockFinalize',
    );
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        area: 'checkout',
        step: 'complete',
        orderNo: 'ORDER-ZERO',
        status: 'paid',
      }),
      'checkout complete',
    );
  });
});
