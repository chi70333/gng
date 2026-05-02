import { describe, expect, it } from 'vitest';
import { addCartItemSchema, updateCartItemSchema } from './cart';
import { createOrderSchema } from './order';
import { paymentCallbackSchema } from './payment';
import { createProductQnaSchema } from './product-qna';

describe('cart schemas', () => {
  it('normalizes add quantity to one and keeps sku ids string-safe for bigint parsing', () => {
    const parsed = addCartItemSchema.parse({ skuId: '123', quantity: '2' });

    expect(parsed).toEqual({ skuId: '123', quantity: 1 });
  });

  it('keeps zero as delete for updates and normalizes positive updates to one', () => {
    expect(addCartItemSchema.parse({ skuId: '123', quantity: 0 })).toEqual({
      skuId: '123',
      quantity: 1,
    });
    expect(updateCartItemSchema.parse({ skuId: '123', quantity: 0 })).toEqual({
      skuId: '123',
      quantity: 0,
    });
    expect(updateCartItemSchema.parse({ skuId: '123', quantity: 7 })).toEqual({
      skuId: '123',
      quantity: 1,
    });
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

  it('accepts optional select values omitted by FormData.get', () => {
    const parsed = createOrderSchema.parse({
      buyerName: 'Park',
      buyerPhone: '01041055908',
      buyerEmail: 'hn02205@gmail.com',
      receiver: 'Park',
      phone: '010-4105-5908',
      zipCode: '42422',
      address1: 'Daegu Namgu Myeongdeok-ro 200',
      address2: 'TEST',
      couponIssueId: '',
      pointsToUse: '',
      paymentMethod: 'bank',
      deliveryType: null,
      depositorName: 'Park',
      depositDueDate: '2026-04-28',
      cashReceiptType: 'personal',
      cashReceiptIdentity: '',
      taxInvoiceCompanyName: '',
      taxInvoiceBusinessNumber: '',
      memo: '12312',
    });

    expect(parsed.deliveryType).toBeUndefined();
    expect(parsed.pointsToUse).toBe(0);
    expect(parsed.paymentMethod).toBe('bank');
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
