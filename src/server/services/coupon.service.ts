// Legacy sources: coupon_list.php, coupon_ajax.php, mypage_coupon.php
// Cache: no-store for user state. Public coupon discovery may use page-level cache later.

import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/server/db';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';

type CouponTx = Prisma.TransactionClient;

export type CouponDiscountResult = {
  couponIssueId: bigint;
  discount: Decimal;
};

function isCouponValidForDate(coupon: { startAt: Date; endAt: Date; isActive: boolean }) {
  const now = new Date();
  return coupon.isActive && coupon.startAt <= now && coupon.endAt >= now;
}

export async function issueCouponToUser(input: {
  couponId: bigint;
  userId: bigint;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.findUnique({
      where: { id: input.couponId },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        isActive: true,
        totalQuota: true,
        usedCount: true,
      },
    });

    if (!coupon || !isCouponValidForDate(coupon)) {
      throw new NotFoundError('발급 가능한 쿠폰이 없습니다.');
    }

    const existing = await tx.couponIssue.findFirst({
      where: { couponId: coupon.id, userId: input.userId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError('이미 발급받은 쿠폰입니다.');
    }

    const issuedCount = await tx.couponIssue.count({ where: { couponId: coupon.id } });
    if (coupon.totalQuota != null && issuedCount >= coupon.totalQuota) {
      throw new ConflictError('쿠폰 재고가 없습니다.');
    }

    await tx.couponIssue.create({
      data: {
        couponId: coupon.id,
        userId: input.userId,
        expireAt: coupon.endAt,
      },
    });
  });
}

export async function calculateCouponDiscount(
  tx: CouponTx,
  input: {
    couponIssueId: bigint;
    userId: bigint;
    subtotal: Decimal;
  },
): Promise<CouponDiscountResult> {
  const issue = await tx.couponIssue.findFirst({
    where: {
      id: input.couponIssueId,
      userId: input.userId,
      usedAt: null,
    },
    include: { coupon: true },
  });

  if (!issue) throw new NotFoundError('사용 가능한 쿠폰이 없습니다.');
  if (!isCouponValidForDate(issue.coupon) || issue.expireAt < new Date()) {
    throw new ValidationError('만료된 쿠폰입니다.');
  }
  if (issue.coupon.minOrderAmount && input.subtotal.lt(issue.coupon.minOrderAmount)) {
    throw new ValidationError('쿠폰 최소 주문금액을 충족하지 못했습니다.');
  }

  const rawDiscount =
    issue.coupon.discountType === 'percent'
      ? input.subtotal.mul(issue.coupon.discountValue).div(100).floor()
      : issue.coupon.discountValue;
  const cappedDiscount = issue.coupon.maxDiscount
    ? Decimal.min(rawDiscount, issue.coupon.maxDiscount)
    : rawDiscount;

  return {
    couponIssueId: issue.id,
    discount: Decimal.min(cappedDiscount, input.subtotal),
  };
}

export async function markCouponUsed(
  tx: CouponTx,
  input: {
    couponIssueId: bigint;
    orderId: bigint;
  },
): Promise<void> {
  const updated = await tx.couponIssue.updateMany({
    where: { id: input.couponIssueId, usedAt: null },
    data: { usedAt: new Date(), orderId: input.orderId },
  });

  if (updated.count !== 1) {
    throw new ConflictError('쿠폰을 사용할 수 없습니다.');
  }

  const issue = await tx.couponIssue.findUnique({
    where: { id: input.couponIssueId },
    select: { couponId: true },
  });

  if (issue) {
    await tx.coupon.update({
      where: { id: issue.couponId },
      data: { usedCount: { increment: 1 } },
    });
  }
}
