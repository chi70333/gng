import { z } from 'zod';

const idSchema = z.string().regex(/^\d+$/);
const singleQuantitySchema = z.coerce.number().int().optional().transform(() => 1);
const cartUpdateQuantitySchema = z.coerce
  .number()
  .int()
  .min(0)
  .transform((value) => (value === 0 ? 0 : 1));

export const addCartItemSchema = z.object({
  skuId: idSchema,
  quantity: singleQuantitySchema,
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({
  skuId: idSchema,
  quantity: cartUpdateQuantitySchema,
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

export const legacyCartChangeCountSchema = z.object({
  mode: z.literal('chang_cnt'),
  idx: idSchema,
  tar: z.string().default('cnt'),
  cnt: singleQuantitySchema,
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
  quantity: singleQuantitySchema,
  mode: z.string().optional(),
});

export type LegacyCartChangeCountInput = z.infer<typeof legacyCartChangeCountSchema>;
export type LegacyCartDeleteInput = z.infer<typeof legacyCartDeleteSchema>;
export type LegacyCartAddInput = z.infer<typeof legacyCartAddSchema>;
