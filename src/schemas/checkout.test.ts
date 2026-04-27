import { describe, expect, it } from 'vitest';
import { addCartItemSchema, updateCartItemSchema } from './cart';
import { createOrderSchema } from './order';
import { paymentCallbackSchema } from './payment';
import { createProductQnaSchema } from './product-qna';

describe('cart schemas', () => {
  it('coerces quantity and keeps sku ids string-safe for bigint parsing', () => {
    const parsed = addCartItemSchema.parse({ skuId: '123', quantity: '2' });

    expect(parsed).toEqual({ skuId: '123', quantity: 2 });
  });

  it('allows zero only for cart item updates', () => {
    expect(addCartItemSchema.safeParse({ skuId: '123', quantity: 0 }).success).toBe(
      false,
    );
    expect(updateCartItemSchema.safeParse({ skuId: '123', quantity: 0 }).success).toBe(
      true,
    );
  });
});

describe('createOrderSchema', () => {
  it('trims shipping fields and accepts optional address details', () => {
    const parsed = createOrderSchema.parse({
      receiver: '  Hong  ',
      phone: '01012345678',
      zipCode: '06234',
      address1: '  Seoul Gangnam  ',
      address2: '',
      memo: '  Leave at door  ',
    });

    expect(parsed.receiver).toBe('Hong');
    expect(parsed.address1).toBe('Seoul Gangnam');
    expect(parsed.memo).toBe('Leave at door');
    expect(parsed.pointsToUse).toBe(0);
  });

  it('accepts coupon issue and point usage fields', () => {
    const parsed = createOrderSchema.parse({
      receiver: '홍길동',
      phone: '01012345678',
      zipCode: '06234',
      address1: '서울시 강남구',
      couponIssueId: '10',
      pointsToUse: '3000',
    });

    expect(parsed.couponIssueId).toBe(10n);
    expect(parsed.pointsToUse).toBe(3000);
  });
});

describe('paymentCallbackSchema', () => {
  it('defaults provider and method for legacy PG callbacks', () => {
    const parsed = paymentCallbackSchema.parse({
      orderNo: 'GNG-1',
      amount: '12000',
      status: 'approved',
    });

    expect(parsed).toMatchObject({
      orderNo: 'GNG-1',
      amount: 12000,
      status: 'approved',
      provider: 'legacy-payaction',
      method: 'card',
    });
  });

  it('rejects fractional payment amounts', () => {
    const parsed = paymentCallbackSchema.safeParse({
      orderNo: 'GNG-1',
      amount: '12000.5',
      status: 'approved',
    });

    expect(parsed.success).toBe(false);
  });
});

describe('createProductQnaSchema', () => {
  it('trims Q&A title and content', () => {
    const parsed = createProductQnaSchema.parse({
      productId: '1',
      title: '  배송 문의  ',
      content: '  언제 출고되나요?  ',
      isPrivate: 'true',
    });

    expect(parsed).toEqual({
      productId: '1',
      title: '배송 문의',
      content: '언제 출고되나요?',
      isPrivate: true,
    });
  });
});
