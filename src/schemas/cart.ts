import { z } from 'zod';

const idSchema = z.string().regex(/^\d+$/);

export const addCartItemSchema = z.object({
  skuId: idSchema,
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({
  skuId: idSchema,
  quantity: z.coerce.number().int().min(0).max(99),
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

export const legacyCartChangeCountSchema = z.object({
  mode: z.literal('chang_cnt'),
  idx: idSchema,
  tar: z.string().default('cnt'),
  cnt: z.coerce.number().int().min(1).max(99),
});

export const legacyCartDeleteSchema = z.object({
  mode: z.enum(['single', 'arr']).default('single'),
  idx: z
    .string()
    .regex(/^\d+(,\d+)*$/)
    .transform((value) => value.split(',')),
});

export const legacyCartAddSchema = z.object({
  skuId: idSchema.optional(),
  goodsIdx: idSchema.optional(),
  goodsIdxSingle: idSchema.optional(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
  mode: z.string().optional(),
});

export type LegacyCartChangeCountInput = z.infer<typeof legacyCartChangeCountSchema>;
export type LegacyCartDeleteInput = z.infer<typeof legacyCartDeleteSchema>;
export type LegacyCartAddInput = z.infer<typeof legacyCartAddSchema>;
