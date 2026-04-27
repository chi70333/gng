import { z } from 'zod';

export const legacyRegisterMemberSchema = z.object({
  userid: z.string().trim().min(1).max(255),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(50).default('GNG Member'),
  email: z.string().trim().email().optional(),
  hp: z.string().trim().max(20).optional(),
});

export type LegacyRegisterMemberInput = z.infer<typeof legacyRegisterMemberSchema>;

export const legacyPointSyncSchema = z.object({
  userid: z.string().trim().min(1).max(255),
  amount: z.coerce.number().int().default(0),
  new_balance: z.coerce.number().int(),
  reason: z.string().trim().max(200).optional(),
});

export type LegacyPointSyncInput = z.infer<typeof legacyPointSyncSchema>;

export const legacyGoodsDetailQuerySchema = z.object({
  goodsIdx: z.coerce.number().int().positive().max(2_147_483_647),
});

export type LegacyGoodsDetailQueryInput = z.infer<
  typeof legacyGoodsDetailQuerySchema
>;
