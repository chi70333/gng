import { z } from 'zod';

export const legacyRegisterMemberSchema = z.object({
  userid: z.string().trim().min(1).max(255),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(50).default('GNG Member'),
  email: z.string().trim().email().optional(),
  hp: z.string().trim().max(20).optional(),
});

export type LegacyRegisterMemberInput = z.infer<typeof legacyRegisterMemberSchema>;

const legacyPointFields = {
  userid: z.string().trim().min(1).max(255),
  amount: z.coerce.number().int().default(0),
  reason: z.string().trim().max(200).optional(),
};

export const legacyPointSyncSchema = z.object({
  ...legacyPointFields,
  new_balance: z.coerce.number().int(),
});

export const legacyPointAddSchema = z.object({
  ...legacyPointFields,
  action: z.literal('add'),
});

export const legacyPointMutationSchema = z.union([
  legacyPointSyncSchema,
  legacyPointAddSchema,
]);

export type LegacyPointSyncInput = z.infer<typeof legacyPointMutationSchema>;

export const legacyGoodsDetailQuerySchema = z.object({
  goodsIdx: z.coerce.number().int().positive().max(2_147_483_647),
});

export type LegacyGoodsDetailQueryInput = z.infer<
  typeof legacyGoodsDetailQuerySchema
>;
