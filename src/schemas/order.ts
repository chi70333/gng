import { z } from 'zod';

export const createOrderSchema = z.object({
  buyerName: z.string().trim().min(2).max(50).optional(),
  buyerEmail: z.string().trim().email().max(120).optional(),
  buyerPhone: z.string().trim().min(9).max(20).optional(),
  receiver: z.string().trim().min(2).max(50),
  phone: z.string().trim().min(9).max(20),
  receiverEmail: z.string().trim().email().max(120).optional(),
  receiverPhone2: z.string().trim().min(9).max(20).optional(),
  zipCode: z.string().trim().min(4).max(10),
  address1: z.string().trim().min(3).max(200),
  address2: z.string().trim().max(200).optional().or(z.literal('')),
  memo: z.string().trim().max(500).optional().or(z.literal('')),
  channel: z.string().trim().max(40).optional(),
  deliveryType: z.enum(['default', 'new', 'same_as_buyer']).optional(),
  paymentMethod: z.enum(['card', 'bank', 'vbank', 'mobile']).optional(),
  shippingBaseFee: z.coerce.number().int().min(0).optional(),
  shippingExtraFee: z.coerce.number().int().min(0).optional(),
  couponIssueId: z
    .preprocess((value) => (value === '' || value == null ? undefined : value), z.coerce.bigint().optional()),
  pointsToUse: z
    .preprocess((value) => (value === '' || value == null ? 0 : value), z.coerce.number().int().min(0))
    .default(0),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
