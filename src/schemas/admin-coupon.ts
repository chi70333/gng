import { z } from 'zod';

const moneyString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, '금액 형식이 올바르지 않습니다.');

const optionalMoneyString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  moneyString.optional(),
);

export const adminCouponFormSchema = z.object({
  id: z.coerce.bigint().optional(),
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  discountType: z.enum(['amount', 'percent']),
  discountValue: moneyString,
  minOrderAmount: optionalMoneyString,
  maxDiscount: optionalMoneyString,
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  totalQuota: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(1).max(1000000).optional(),
  ),
  isActive: z.coerce.boolean().default(false),
});
