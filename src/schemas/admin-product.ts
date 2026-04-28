import { z } from 'zod';

const moneyString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, '금액 형식이 올바르지 않습니다.');

const optionalMoneyString = moneyString.optional().or(z.literal(''));

const optionalUrlString = z.string().trim().url('올바른 URL을 입력해주세요.').or(z.literal(''));

const optionalPositiveInt = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.coerce.number().int().min(1).max(999999).optional(),
);

const imageRowSchema = z.object({
  url: optionalUrlString,
  key: z.string().trim().max(500).optional().or(z.literal('')),
  alt: z.string().trim().max(200).optional().or(z.literal('')),
});

export const adminProductStatusSchema = z.enum(['draft', 'active', 'sold_out', 'hidden']);

const emptyStringToUndefined = (value: unknown) => (value === '' ? undefined : value);

export const adminProductListQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional().default(''),
    status: z.preprocess(emptyStringToUndefined, adminProductStatusSchema.optional()),
    categoryId: z.preprocess(emptyStringToUndefined, z.coerce.bigint().optional()),
    stock: z.preprocess(emptyStringToUndefined, z.enum(['low', 'managed', 'unlimited']).optional()),
    page: z.preprocess(
      emptyStringToUndefined,
      z.coerce.number().int().min(1).max(1000).optional().default(1),
    ),
    pageSize: z.preprocess(
      emptyStringToUndefined,
      z.coerce.number().int().min(10).max(200).optional().default(30),
    ),
  })
  .transform((value) => ({
    q: value.q,
    page: value.page,
    pageSize: value.pageSize,
    ...(value.status ? { status: value.status } : {}),
    ...(value.categoryId ? { categoryId: value.categoryId } : {}),
    ...(value.stock ? { stock: value.stock } : {}),
  }));

export const adminProductFormSchema = z
  .object({
    id: z.coerce.bigint().optional(),
    sku: z.string().trim().min(2, '상품 코드를 입력해주세요.').max(80),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.'),
    name: z.string().trim().min(1, '상품명을 입력해주세요.').max(200),
    summary: z.string().trim().max(500).optional().or(z.literal('')),
    description: z.string().trim().max(50000).optional().or(z.literal('')),
    price: moneyString,
    salePrice: optionalMoneyString,
    costPrice: optionalMoneyString,
    status: adminProductStatusSchema,
    categoryIds: z.array(z.coerce.bigint()).min(1, '카테고리를 1개 이상 선택해주세요.'),
    display: z.enum(['1', '0']).default('1'),
    isEmpty: z.enum(['0', '1']).default('0'),
    useStock: z.enum(['1', '2']).default('1'),
    stock: z.coerce.number().int().min(0).default(0),
    pointRate: z.coerce.number().min(0).max(100).default(0),
    expectedShipDays: z.coerce.number().int().min(0).max(99).default(0),
    buyMin: z.coerce.number().int().min(1).max(999999).default(1),
    buyUseMax: z.enum(['1', '0']).default('1'),
    buyMax: optionalPositiveInt,
    priceReplacementText: z.string().trim().max(100).optional().or(z.literal('')),
    searchKeywords: z.string().trim().max(400).optional().or(z.literal('')),
    importFlag: z.enum(['Y', 'N']).default('N'),
    quantityDiscountVisible: z.enum(['Y', 'N']).default('N'),
    mainImageIndex: z.coerce.number().int().min(0).max(20).default(0),
    images: z
      .array(imageRowSchema)
      .default([])
      .transform((rows) => rows.filter((row) => row.url !== '')),
  })
  .superRefine((value, ctx) => {
    if (value.useStock === '2') {
      if (value.stock < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['stock'],
          message: '재고 수량은 1개 이상 입력해주세요.',
        });
      } else if (value.stock > 999999) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['stock'],
          message: '재고 수량은 999999개를 초과할 수 없습니다.',
        });
      }
    }

    if (value.buyUseMax === '0') {
      if (!value.buyMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['buyMax'],
          message: '최대 주문 수량을 입력해주세요.',
        });
      } else if (value.buyMax < value.buyMin) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['buyMax'],
          message: '최대 주문 수량은 최소 주문 수량보다 작을 수 없습니다.',
        });
      }
    }

    if (value.images.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['images'],
        message: '상품 이미지를 1개 이상 업로드해 주세요.',
      });
    }

    if (value.images.length > 0 && value.mainImageIndex >= value.images.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mainImageIndex'],
        message: '대표 이미지를 다시 선택해주세요.',
      });
    }
  });

export type AdminProductFormInput = z.infer<typeof adminProductFormSchema>;
