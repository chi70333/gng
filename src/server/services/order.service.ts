// Legacy sources: order_sheet.php, order_table.php, order_table_ok.php, order_method_check.php
// Cache: no-cache. Orders and stock reservations are transactional writes.

import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/server/db';
import { clearCart, getCart, type CartIdentity } from '@/server/services/cart.service';
import { calculateCouponDiscount, markCouponUsed } from '@/server/services/coupon.service';
import {
  createPointLedgerEntry,
  getPointBalance,
} from '@/server/services/point-ledger.service';
import { ConflictError, ValidationError } from '@/lib/errors';
import type { CreateOrderInput } from '@/schemas/order';

type CreatedOrder = {
  orderNo: string;
  total: string;
};

function createOrderNo(): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  return `GNG${stamp}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

export async function createOrderFromCart(
  identity: CartIdentity,
  input: CreateOrderInput,
): Promise<CreatedOrder> {
  const cart = await getCart(identity);
  if (cart.items.length === 0) {
    throw new ValidationError('Cart is empty.');
  }

  const subtotal = new Decimal(cart.subtotal);
  const shippingBaseFee = new Decimal(
    typeof input.shippingBaseFee === 'number'
      ? input.shippingBaseFee
      : subtotal.gte(50000)
        ? 0
        : 3000,
  );
  const shippingExtraFee = new Decimal(input.shippingExtraFee ?? 0);
  const shippingFee = shippingBaseFee.plus(shippingExtraFee);
  const orderNo = createOrderNo();

  const user = identity.type === 'user'
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

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
      const balance = await getPointBalance(tx, userId);
      if (input.pointsToUse > balance) {
        throw new ValidationError('사용 가능한 포인트를 초과했습니다.');
      }
      if (new Decimal(input.pointsToUse).gt(payableBeforePoints)) {
        throw new ValidationError('주문금액보다 많은 포인트를 사용할 수 없습니다.');
      }
    }

    finalTotal = payableBeforePoints.minus(input.pointsToUse);

    for (const item of cart.items) {
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

    const order = await tx.order.create({
      data: {
        orderNo,
        userId,
        status: 'pending',
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
          paymentMethod: input.paymentMethod ?? null,
          couponIssueId: input.couponIssueId?.toString() ?? null,
        },
        memo: input.memo || null,
        items: {
          create: cart.items.map((item) => ({
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
        history: {
          create: {
            toStatus: 'pending',
            actor: identity.type,
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
  });

  await clearCart(identity);
  return { orderNo, total: finalTotal.toString() };
}
