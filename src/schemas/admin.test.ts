import { describe, expect, it } from 'vitest';
import { adminLoginSchema, adminPermissionSchema } from './admin-auth';
import {
  adminBoardFormSchema,
  adminInquiryAnswerSchema,
  adminPostFormSchema,
  adminProductQnaAnswerSchema,
} from './admin-board';
import {
  adminProductBulkDeleteFormSchema,
  adminProductFormSchema,
  adminProductListQuerySchema,
} from './admin-product';
import { adminOrderListQuerySchema, adminOrderStatusFormSchema } from './admin-order';
import {
  adminUserBulkDeleteFormSchema,
  adminUserBulkPointFormSchema,
  adminUserBulkPointResetAllFormSchema,
  adminUserListQuerySchema,
  adminUserMessageFormSchema,
  adminUserPointDeleteSchema,
  adminUserPointFormSchema,
  adminUserPointResetFormSchema,
} from './admin-user';

describe('admin schemas', () => {
  const productForm = {
    sku: 'SKU-1',
    slug: 'sample-product',
    name: '샘플 상품',
    summary: '샘플 상품 요약',
    description: '',
    price: '10000',
    salePrice: '',
    costPrice: '',
    status: 'active',
    categoryIds: ['1'],
    display: '1',
    isEmpty: '0',
    useStock: '2',
    stock: '5',
    pointRate: '3',
    expectedShipDays: '2',
    buyMin: '1',
    buyUseMax: '0',
    buyMax: '10',
    priceReplacementText: '',
    searchKeywords: '묶음\n인쇄',
    importFlag: 'N',
    quantityDiscountVisible: 'Y',
    mainImageIndex: '0',
    images: [{ url: 'https://example.com/product.jpg', alt: '샘플 상품 이미지' }],
  };

  it('validates admin login input', () => {
    expect(adminLoginSchema.safeParse({ loginId: 'admin', password: 'Admin1234!' }).success).toBe(
      true,
    );
  });

  it('rejects unknown permissions', () => {
    expect(adminPermissionSchema.safeParse('product.delete').success).toBe(false);
  });

  it('accepts product form money strings, legacy fields, and images', () => {
    const parsed = adminProductFormSchema.parse(productForm);

    expect(parsed.categoryIds).toEqual([1n]);
    expect(parsed.stock).toBe(5);
    expect(parsed.images).toEqual([
      { url: 'https://example.com/product.jpg', alt: '샘플 상품 이미지' },
    ]);
    expect(parsed.pointRate).toBe(3);
  });

  it('treats blank product list filters as unset', () => {
    const parsed = adminProductListQuerySchema.parse({
      q: '',
      status: '',
      categoryId: '',
      stock: '',
      page: '',
    });

    expect(parsed).toEqual({ q: '', page: 1, pageSize: 30 });
  });

  it('treats blank member list filters as unset', () => {
    const parsed = adminUserListQuerySchema.parse({
      q: '  홍길동  ',
      status: '',
      page: '',
      pageSize: '',
    });

    expect(parsed).toEqual({ q: '홍길동', status: undefined, page: 1, pageSize: 30 });
  });

  it('rejects product form without categories', () => {
    expect(
      adminProductFormSchema.safeParse({
        ...productForm,
        categoryIds: [],
      }).success,
    ).toBe(false);
  });

  it('rejects product form without a representative image URL', () => {
    expect(
      adminProductFormSchema.safeParse({
        ...productForm,
        images: [{ url: '', alt: '' }],
      }).success,
    ).toBe(false);
  });

  it('requires stock quantity when stock management is enabled', () => {
    expect(
      adminProductFormSchema.safeParse({
        ...productForm,
        useStock: '2',
        stock: '0',
      }).success,
    ).toBe(false);
  });

  it('allows large posted stock for unlimited stock products', () => {
    expect(
      adminProductFormSchema.safeParse({
        ...productForm,
        useStock: '1',
        stock: '1999998',
      }).success,
    ).toBe(true);
  });

  it('rejects stock quantity over the managed stock limit', () => {
    expect(
      adminProductFormSchema.safeParse({
        ...productForm,
        useStock: '2',
        stock: '1000000',
      }).success,
    ).toBe(false);
  });

  it('rejects max order quantity smaller than min order quantity', () => {
    expect(
      adminProductFormSchema.safeParse({
        ...productForm,
        buyMin: '10',
        buyUseMax: '0',
        buyMax: '2',
      }).success,
    ).toBe(false);
  });

  it('validates order status changes', () => {
    expect(
      adminOrderStatusFormSchema.safeParse({
        orderNo: 'ORD-1',
        status: 'shipping',
        reason: '송장 입력',
      }).success,
    ).toBe(true);
  });

  it('parses mileage range filters for order lists', () => {
    const parsed = adminOrderListQuerySchema.parse({
      point_min: '1000',
      point_max: '',
    });

    expect(parsed.point_min).toBe(1000);
    expect(parsed.point_max).toBeUndefined();
  });

  it('allows positive and negative point adjustments', () => {
    expect(
      adminUserPointFormSchema.safeParse({
        userId: '1',
        delta: '-1000',
        reason: 'manual correction',
      }).success,
    ).toBe(true);
  });

  it('requires explicit confirmation for point reset', () => {
    expect(
      adminUserPointResetFormSchema.safeParse({
        userId: '1',
        intent: 'reset',
        reason: '관리자 마일리지 초기화',
        confirm: '초기화',
      }).success,
    ).toBe(true);
    expect(
      adminUserPointResetFormSchema.safeParse({
        userId: '1',
        intent: 'reset',
        reason: '관리자 마일리지 초기화',
        confirm: '',
      }).success,
    ).toBe(false);
  });

  it('validates point history deletion parameters', () => {
    const parsed = adminUserPointDeleteSchema.parse({
      userId: '1',
      pointId: '2',
    });

    expect(parsed).toEqual({ userId: 1n, pointId: 2n });
  });

  it('requires at least one member for bulk deletion', () => {
    expect(adminUserBulkDeleteFormSchema.safeParse({ userIds: [1n, 2n] }).success).toBe(true);
    expect(adminUserBulkDeleteFormSchema.safeParse({ userIds: [] }).success).toBe(false);
  });

  it('validates bulk mileage grant forms', () => {
    expect(
      adminUserBulkPointFormSchema.safeParse({
        intent: 'mileage-grant',
        userIds: [1n, 2n],
        delta: '1000',
        reason: '관리자 마일리지 일괄 처리',
      }).success,
    ).toBe(true);
    expect(
      adminUserBulkPointFormSchema.safeParse({
        intent: 'mileage-grant',
        userIds: [1n],
        delta: '',
      }).success,
    ).toBe(false);
  });

  it('requires confirmation for all-member mileage reset', () => {
    expect(
      adminUserBulkPointResetAllFormSchema.safeParse({
        intent: 'mileage-reset-all',
        confirm: '전체 초기화',
        reason: '관리자 마일리지 전체 초기화',
      }).success,
    ).toBe(true);
    expect(
      adminUserBulkPointResetAllFormSchema.safeParse({
        intent: 'mileage-reset-all',
        confirm: '',
      }).success,
    ).toBe(false);
  });

  it('requires at least one product for bulk deletion', () => {
    expect(adminProductBulkDeleteFormSchema.safeParse({ productIds: [1n, 2n] }).success).toBe(true);
    expect(adminProductBulkDeleteFormSchema.safeParse({ productIds: [] }).success).toBe(false);
  });

  it('validates board and post management forms', () => {
    expect(
      adminBoardFormSchema.safeParse({
        code: 'notice',
        name: '공지사항',
        type: 'notice',
        isActive: true,
        redirectTo: '/admin/boards',
      }).success,
    ).toBe(true);
    expect(
      adminPostFormSchema.safeParse({
        boardId: '1',
        title: '공지',
        content: '내용',
        isNotice: true,
        isSecret: false,
        redirectTo: '/admin/boards/posts?q=공지',
      }).success,
    ).toBe(true);
  });

  it('validates board answer forms', () => {
    expect(
      adminProductQnaAnswerSchema.safeParse({
        qnaId: '1',
        answer: '상품문의 답변입니다.',
        redirectTo: '/admin/boards/product-qna',
      }).success,
    ).toBe(true);
    expect(
      adminInquiryAnswerSchema.safeParse({
        inquiryId: '1',
        answer: '1:1 문의 답변입니다.',
        redirectTo: '/admin/boards/inquiries',
      }).success,
    ).toBe(true);
    expect(
      adminInquiryAnswerSchema.safeParse({
        inquiryId: '1',
        answer: '',
      }).success,
    ).toBe(false);
  });

  it('validates member message requests', () => {
    expect(
      adminUserMessageFormSchema.safeParse({
        userId: '1',
        channel: 'sms',
        subject: '',
        content: '안내 메시지',
      }).success,
    ).toBe(true);
  });
});
