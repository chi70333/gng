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

const productOptionRowSchema = z.object({
  name: z.string().trim().min(1, '옵션명을 입력해주세요.').max(50),
  values: z
    .array(z.string().trim().min(1).max(80))
    .min(1, '옵션값을 1개 이상 입력해주세요.')
    .max(50, '옵션값은 옵션당 50개까지 입력할 수 있습니다.'),
});

const productSkuRowSchema = z.object({
  code: z.string().trim().max(120).optional().or(z.literal('')),
  optionValues: z.record(z.string().trim().min(1)),
  priceDelta: moneyString.default('0'),
  stock: z.coerce.number().int().min(0).max(999999),
  isActive: z.boolean().default(true),
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

export const adminProductBulkDeleteFormSchema = z.object({
  productIds: z.array(z.bigint()).min(1, '삭제할 상품을 선택해주세요.').max(500),
  redirectTo: z.string().trim().optional(),
});

export const adminProductDeleteFormSchema = z.object({
  productId: z.coerce.bigint(),
  redirectTo: z.string().trim().optional(),
});

export const adminProductFormSchema = z
  .object({
    id: z.coerce.bigint().optional(),
    sku: z.string().trim().min(2, '상품 코드를 입력해주세요.').max(80),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(160)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'slug는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.',
      ),
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
    options: z
      .array(productOptionRowSchema)
      .max(3, '옵션은 최대 3개까지 등록할 수 있습니다.')
      .default([]),
    skus: z
      .array(productSkuRowSchema)
      .max(120, '옵션 조합은 최대 120개까지 등록할 수 있습니다.')
      .default([]),
  })
  .superRefine((value, ctx) => {
    if (value.useStock === '2' && value.options.length === 0) {
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

    if (value.options.length === 0) return;

    const optionNames = value.options.map((option) => option.name);
    if (new Set(optionNames).size !== optionNames.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: '옵션명은 중복될 수 없습니다.',
      });
    }

    const expectedCount = value.options.reduce((count, option) => count * option.values.length, 1);
    if (value.skus.length !== expectedCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['skus'],
        message: '옵션 조합을 다시 확인해주세요.',
      });
      return;
    }

    const valuesByName = new Map(
      value.options.map((option) => [option.name, new Set(option.values)]),
    );
    const seenCombinations = new Set<string>();
    const seenCodes = new Set<string>();

    value.skus.forEach((sku, index) => {
      const keys = Object.keys(sku.optionValues);
      const sameKeys =
        keys.length === optionNames.length &&
        optionNames.every((optionName) => keys.includes(optionName));
      if (!sameKeys) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['skus', index, 'optionValues'],
          message: '옵션 조합 값이 옵션 목록과 일치하지 않습니다.',
        });
        return;
      }

      for (const optionName of optionNames) {
        const selectedValue = sku.optionValues[optionName];
        if (!selectedValue || !valuesByName.get(optionName)?.has(selectedValue)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['skus', index, 'optionValues'],
            message: '등록되지 않은 옵션값이 포함되어 있습니다.',
          });
        }
      }

      const combinationKey = optionNames
        .map((optionName) => `${optionName}:${sku.optionValues[optionName]}`)
        .join('|');
      if (seenCombinations.has(combinationKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['skus', index, 'optionValues'],
          message: '옵션 조합이 중복되었습니다.',
        });
      }
      seenCombinations.add(combinationKey);

      if (sku.code) {
        if (seenCodes.has(sku.code)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['skus', index, 'code'],
            message: 'SKU 코드가 중복되었습니다.',
          });
        }
        seenCodes.add(sku.code);
      }
    });
  });

export type AdminProductFormInput = z.infer<typeof adminProductFormSchema>;
