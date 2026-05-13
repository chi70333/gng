// Legacy sources: order_sheet.php, order_table.php, order_table_ok.php, order_method_check.php
// Cache: no-cache. Orders and stock reservations are transactional writes.

import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/server/db';
import {
  clearCart,
  deleteCartItems,
  getCart,
  getOrderReadyItem,
  type CartIdentity,
  type CartItem,
} from '@/server/services/cart.service';
import { calculateCouponDiscount, markCouponUsed } from '@/server/services/coupon.service';
import { createPointLedgerEntry, getPointBalance } from '@/server/services/point-ledger.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { createLegacyOrderCode } from '@/lib/legacy-order-code';
import type { CreateOrderInput } from '@/schemas/order';

type CreatedOrder = {
  orderNo: string;
  total: string;
  status: string;
};

type CreateOrderOptions = {
  clientIp?: string | null;
};

type OrderReleaseTarget = {
  id: bigint;
  orderNo: string;
  userId: bigint | null;
  pointsUsed: number;
};

type OrderTransitionStatus =
  | 'pending'
  | 'paid'
  | 'preparing'
  | 'shipping'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

type OrderTransitionTarget = OrderReleaseTarget & {
  status: string;
};

const FINALIZED_STOCK_STATUSES = new Set([
  'paid',
  'preparing',
  'shipping',
  'delivered',
  'refunded',
]);
const TERMINAL_REVERSAL_STATUSES = new Set(['cancelled', 'refunded']);

async function lockOrderById(tx: Prisma.TransactionClient, orderId: bigint): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
}

async function lockOrderByOrderNo(
  tx: Prisma.TransactionClient,
  orderNo: string,
): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "orderNo" = ${orderNo} FOR UPDATE`;
}

async function createUniqueLegacyOrderNo(
  tx: Prisma.TransactionClient,
  clientIp?: string | null,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const orderNo = createLegacyOrderCode({ clientIp });
    const exists = await tx.order.findFirst({
      where: {
        OR: [{ orderNo }, { legacyTradeCode: orderNo }],
      },
      select: { id: true },
    });

    if (!exists) return orderNo;
  }

  throw new ConflictError('주문번호 생성에 실패했습니다. 다시 시도해 주세요.');
}

async function lockUserById(tx: Prisma.TransactionClient, userId: bigint): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
}

function getPaymentProvider(method: string): string {
  if (method === 'point') return 'internal-point';
  if (method === 'bank') return 'manual-bank';
  return 'checkout-pending';
}

function buildPaymentRawResponse(
  input: CreateOrderInput,
  method: string,
  options: { zeroCheckout?: boolean } = {},
) {
  return {
    source: 'checkout',
    paymentMethod: method,
    zeroCheckout: options.zeroCheckout ?? false,
    pointsUsed: input.pointsToUse,
    bankDeposit:
      method === 'bank'
        ? {
            account: process.env.BANK_TRANSFER_ACCOUNT ?? null,
            depositorName: input.depositorName || input.buyerName || input.receiver,
            depositDueDate: input.depositDueDate?.toISOString() ?? null,
          }
        : null,
    cashReceipt: {
      type: input.cashReceiptType,
      identity: input.cashReceiptIdentity || null,
    },
    taxInvoice: {
      requested: input.taxInvoiceRequested,
      companyName: input.taxInvoiceCompanyName || null,
      businessNumber: input.taxInvoiceBusinessNumber || null,
    },
  };
}

function getShippingBaseFee(subtotal: Decimal): Decimal {
  return subtotal.gte(50000) ? new Decimal(0) : new Decimal(3000);
}

function getRemoteAreaShippingFee(_zipCode: string): Decimal {
  // Legacy order_table_trans_chk.php looked up island/mountain fees by zipcode.
  // Until the legacy trans_add table is migrated, do not trust client-supplied fees.
  return new Decimal(0);
}

function getOrderItems(cartItems: CartItem[], selectedSkuIds?: string[]): CartItem[] {
  if (!selectedSkuIds) return cartItems;

  const selected = new Set(selectedSkuIds);
  return cartItems.filter((item) => selected.has(item.skuId));
}

export async function releaseReservedStock(
  tx: Prisma.TransactionClient,
  orderId: bigint,
): Promise<void> {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { skuId: true, quantity: true },
  });

  for (const item of items) {
    if (!item.skuId) continue;
    await tx.$executeRaw`
      UPDATE "ProductSku"
      SET "reserved" = GREATEST("reserved" - ${item.quantity}, 0)
      WHERE "id" = ${item.skuId}
    `;
  }
}

export async function finalizeReservedStock(
  tx: Prisma.TransactionClient,
  orderId: bigint,
): Promise<void> {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { skuId: true, productId: true, quantity: true },
  });

  for (const item of items) {
    if (!item.skuId) continue;
    await tx.$executeRaw`
      UPDATE "ProductSku"
      SET
        "stock" = GREATEST("stock" - ${item.quantity}, 0),
        "reserved" = GREATEST("reserved" - ${item.quantity}, 0)
      WHERE "id" = ${item.skuId}
    `;
    await tx.product.update({
      where: { id: item.productId },
      data: { soldCount: { increment: item.quantity } },
    });
  }
}

async function finalizeStockForImmediatePayment(
  tx: Prisma.TransactionClient,
  orderItems: CartItem[],
): Promise<void> {
  for (const item of orderItems) {
    if (!item.skuId) continue;
    // Raw SQL is used here to atomically honor existing reserved stock while
    // immediately decrementing inventory for zero-won paid orders.
    const sold = await tx.$executeRaw`
      UPDATE "ProductSku"
      SET "stock" = "stock" - ${item.quantity}
      WHERE "id" = ${BigInt(item.skuId)}
        AND "isActive" = true
        AND "stock" - "reserved" >= ${item.quantity}
    `;

    if (sold !== 1) {
      throw new ConflictError('Some cart items are out of stock.');
    }

    await tx.product.update({
      where: { id: BigInt(item.productId) },
      data: { soldCount: { increment: item.quantity } },
    });
  }
}

async function reserveStockForPendingPayment(
  tx: Prisma.TransactionClient,
  orderItems: CartItem[],
): Promise<void> {
  for (const item of orderItems) {
    if (!item.skuId) continue;
    // Raw SQL is used here because Prisma updateMany cannot express
    // `stock - reserved >= quantity` atomically without a read-then-write race.
    const reserved = await tx.$executeRaw`
      UPDATE "ProductSku"
      SET "reserved" = "reserved" + ${item.quantity}
      WHERE "id" = ${BigInt(item.skuId)}
        AND "isActive" = true
        AND "stock" - "reserved" >= ${item.quantity}
    `;

    if (reserved !== 1) {
      throw new ConflictError('Some cart items are out of stock.');
    }
  }
}

export async function restoreFinalizedStock(
  tx: Prisma.TransactionClient,
  orderId: bigint,
): Promise<void> {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { skuId: true, productId: true, quantity: true },
  });

  for (const item of items) {
    if (!item.skuId) continue;
    await tx.productSku.update({
      where: { id: item.skuId },
      data: { stock: { increment: item.quantity } },
    });
    await tx.product.update({
      where: { id: item.productId },
      data: { soldCount: { decrement: item.quantity } },
    });
  }
}

export async function releaseOrderBenefits(
  tx: Prisma.TransactionClient,
  order: OrderReleaseTarget,
): Promise<void> {
  if (order.userId && order.pointsUsed > 0) {
    const restored = await tx.userPointHistory.findFirst({
      where: {
        userId: order.userId,
        orderId: order.id,
        delta: order.pointsUsed,
        reason: `주문 ${order.orderNo} 포인트 사용 취소`,
      },
      select: { id: true },
    });
    if (!restored) {
      await createPointLedgerEntry(tx, {
        userId: order.userId,
        delta: order.pointsUsed,
        reason: `주문 ${order.orderNo} 포인트 사용 취소`,
        orderId: order.id,
      });
    }
  }

  const couponIssues = await tx.couponIssue.findMany({
    where: { orderId: order.id },
    select: { id: true, couponId: true },
  });

  for (const issue of couponIssues) {
    await tx.couponIssue.update({
      where: { id: issue.id },
      data: { usedAt: null, orderId: null },
    });
    await tx.coupon.update({
      where: { id: issue.couponId },
      data: { usedCount: { decrement: 1 } },
    });
  }
}

export async function transitionOrderStatus(
  tx: Prisma.TransactionClient,
  input: {
    order: OrderTransitionTarget;
    nextStatus: OrderTransitionStatus;
    actor: string;
    reason?: string | null;
  },
): Promise<boolean> {
  await lockOrderById(tx, input.order.id);
  const currentOrder = await tx.order.findUnique({
    where: { id: input.order.id },
    select: { status: true },
  });
  const previousStatus = currentOrder?.status ?? input.order.status;
  if (previousStatus === input.nextStatus) return false;

  if (previousStatus === 'pending' && input.nextStatus === 'paid') {
    await finalizeReservedStock(tx, input.order.id);
  }

  if (
    TERMINAL_REVERSAL_STATUSES.has(input.nextStatus) &&
    !TERMINAL_REVERSAL_STATUSES.has(previousStatus)
  ) {
    if (previousStatus === 'pending') {
      await releaseReservedStock(tx, input.order.id);
    } else if (FINALIZED_STOCK_STATUSES.has(previousStatus)) {
      await restoreFinalizedStock(tx, input.order.id);
    }
    await releaseOrderBenefits(tx, input.order);
  }

  await tx.order.update({
    where: { id: input.order.id },
    data: { status: input.nextStatus },
  });
  await tx.orderStatusHistory.create({
    data: {
      orderId: input.order.id,
      fromStatus: previousStatus,
      toStatus: input.nextStatus,
      actor: input.actor,
      reason: input.reason || null,
    },
  });
  return true;
}

export async function lockOrderForUpdate(
  tx: Prisma.TransactionClient,
  orderNo: string,
): Promise<void> {
  await lockOrderByOrderNo(tx, orderNo);
}

async function createOrderFromItems(
  identity: CartIdentity,
  input: CreateOrderInput,
  orderItems: CartItem[],
  options: CreateOrderOptions = {},
): Promise<CreatedOrder> {
  if (orderItems.length === 0) {
    throw new ValidationError('Cart is empty.');
  }

  const subtotal = orderItems.reduce(
    (sum, item) => sum.plus(new Decimal(item.unitPrice).mul(item.quantity)),
    new Decimal(0),
  );
  const shippingBaseFee = getShippingBaseFee(subtotal);
  const shippingExtraFee = getRemoteAreaShippingFee(input.zipCode);
  const shippingFee = shippingBaseFee.plus(shippingExtraFee);
  let orderNo = '';

  const user =
    identity.type === 'user'
      ? await prisma.user.findUnique({
          where: { email: identity.id },
          select: {
            id: true,
            grade: { select: { pointPct: true } },
          },
        })
      : null;
  const userId = user?.id ?? null;

  if ((input.couponIssueId || input.pointsToUse > 0) && !userId) {
    throw new ValidationError('회원만 쿠폰과 포인트를 사용할 수 있습니다.');
  }

  let finalTotal = subtotal.plus(shippingFee);
  let orderStatus: OrderTransitionStatus = 'pending';

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    orderNo = await createUniqueLegacyOrderNo(tx, options.clientIp);
    let discount = new Decimal(0);
    let couponIssueId: bigint | null = null;

    if (input.couponIssueId && userId) {
      const coupon = await calculateCouponDiscount(tx, {
        couponIssueId: input.couponIssueId,
        userId,
        subtotal,
      });
      discount = coupon.discount;
      couponIssueId = coupon.couponIssueId;
    }

    const payableBeforePoints = subtotal.plus(shippingFee).minus(discount);
    if (input.pointsToUse > 0 && userId) {
      await lockUserById(tx, userId);
      const balance = await getPointBalance(tx, userId);
      if (input.pointsToUse > balance) {
        throw new ValidationError('사용 가능한 포인트를 초과했습니다.');
      }
      if (new Decimal(input.pointsToUse).gt(payableBeforePoints)) {
        throw new ValidationError('주문금액보다 많은 포인트를 사용할 수 없습니다.');
      }
    }

    finalTotal = payableBeforePoints.minus(input.pointsToUse);
    const paidImmediately = finalTotal.eq(0);
    orderStatus = paidImmediately ? 'paid' : 'pending';
    const paymentMethod =
      paidImmediately && input.pointsToUse > 0 ? 'point' : input.paymentMethod ?? 'bank';
    const paymentStatus = paidImmediately ? 'approved' : 'pending';

    if (paidImmediately) {
      await finalizeStockForImmediatePayment(tx, orderItems);
    } else {
      await reserveStockForPendingPayment(tx, orderItems);
    }

    const order = await tx.order.create({
      data: {
        orderNo,
        legacyTradeCode: orderNo,
        userId,
        status: orderStatus,
        subtotal,
        discount,
        shippingFee,
        pointsUsed: input.pointsToUse,
        total: finalTotal,
        shippingAddress: {
          receiver: input.receiver,
          phone: input.phone,
          phone2: input.receiverPhone2 ?? null,
          email: input.receiverEmail ?? null,
          zipCode: input.zipCode,
          address1: input.address1,
          address2: input.address2 ?? '',
          deliveryType: input.deliveryType ?? 'default',
        },
        buyerInfo: {
          receiver: input.receiver,
          phone: input.phone,
          name: input.buyerName ?? input.receiver,
          email: input.buyerEmail ?? null,
          buyerPhone: input.buyerPhone ?? input.phone,
          channel: input.channel ?? null,
          paymentMethod,
          couponIssueId: input.couponIssueId?.toString() ?? null,
          receipt: {
            cashReceiptType: input.cashReceiptType,
            cashReceiptIdentity: input.cashReceiptIdentity || null,
            taxInvoiceRequested: input.taxInvoiceRequested,
            taxInvoiceCompanyName: input.taxInvoiceCompanyName || null,
            taxInvoiceBusinessNumber: input.taxInvoiceBusinessNumber || null,
          },
        },
        memo: input.memo || null,
        items: {
          create: orderItems.map((item) => ({
            productId: BigInt(item.productId),
            skuId: BigInt(item.skuId),
            productName: item.name,
            skuCode: item.skuId,
            optionSummary: item.optionSummary,
            unitPrice: new Decimal(item.unitPrice),
            quantity: item.quantity,
            totalPrice: new Decimal(item.unitPrice).mul(item.quantity),
          })),
        },
        payments: {
          create: {
            method: paymentMethod,
            provider: getPaymentProvider(paymentMethod),
            amount: finalTotal,
            status: paymentStatus,
            rawResponse: buildPaymentRawResponse(input, paymentMethod, {
              zeroCheckout: paidImmediately,
            }),
            approvedAt: paidImmediately ? new Date() : null,
          },
        },
        history: {
          create: {
            toStatus: orderStatus,
            actor: identity.type,
            reason: paidImmediately ? 'checkout:zero-total' : null,
          },
        },
      },
    });

    if (couponIssueId) {
      await markCouponUsed(tx, { couponIssueId, orderId: order.id });
    }

    if (input.pointsToUse > 0 && userId) {
      await createPointLedgerEntry(tx, {
        userId,
        delta: -input.pointsToUse,
        reason: `주문 ${orderNo} 포인트 사용`,
        orderId: order.id,
      });
    }

    if (input.saveShippingAddress && userId) {
      const hasDefault = await tx.userAddress.findFirst({
        where: { userId, isDefault: true },
        select: { id: true },
      });

      await tx.userAddress.create({
        data: {
          userId,
          label: '최근 배송지',
          receiver: input.receiver,
          phone: input.phone,
          zipCode: input.zipCode,
          address1: input.address1,
          address2: input.address2 || null,
          isDefault: !hasDefault,
        },
      });
    }
  });

  return { orderNo, total: finalTotal.toString(), status: orderStatus };
}

export async function createOrderFromCart(
  identity: CartIdentity,
  input: CreateOrderInput,
  options: CreateOrderOptions = {},
): Promise<CreatedOrder> {
  const cart = await getCart(identity);
  const orderItems = getOrderItems(cart.items, input.selectedSkuIds);
  const order = await createOrderFromItems(identity, input, orderItems, options);

  if (input.selectedSkuIds) {
    await deleteCartItems(
      identity,
      orderItems.map((item) => item.skuId),
    );
  } else {
    await clearCart(identity);
  }

  return order;
}

export async function createOrderFromDirectItem(input: {
  identity: CartIdentity;
  orderInput: CreateOrderInput;
  skuId: string;
  quantity: number;
  clientIp?: string | null;
}): Promise<CreatedOrder> {
  const checkoutItem = await getOrderReadyItem(input.skuId, input.quantity);
  return createOrderFromItems(input.identity, input.orderInput, [checkoutItem], {
    clientIp: input.clientIp,
  });
}

export async function cancelUserOrder(input: {
  orderNo: string;
  userId: bigint;
  reason?: string;
}): Promise<{ orderNo: string; status: string }> {
  return prisma.$transaction(async (tx) => {
    await lockOrderByOrderNo(tx, input.orderNo);
    const order = await tx.order.findUnique({
      where: { orderNo: input.orderNo },
      select: {
        id: true,
        orderNo: true,
        userId: true,
        status: true,
        pointsUsed: true,
      },
    });

    if (!order) throw new NotFoundError('주문을 찾을 수 없습니다.');
    if (order.userId !== input.userId) {
      throw new ForbiddenError('본인 주문만 취소할 수 있습니다.');
    }
    if (order.status !== 'pending' && order.status !== 'paid') {
      throw new ConflictError('배송 준비 이후 주문은 고객센터로 취소를 요청해 주세요.');
    }

    await tx.payment.updateMany({
      where: { orderId: order.id, status: { in: ['pending', 'approved'] } },
      data: { status: 'cancelled' },
    });
    await transitionOrderStatus(tx, {
      order,
      nextStatus: 'cancelled',
      actor: 'user',
      reason: input.reason || 'user:cancel',
    });

    return { orderNo: order.orderNo, status: 'cancelled' };
  });
}
