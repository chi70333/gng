import { z } from 'zod';

export const paymentMethodSchema = z.enum(['card', 'bank', 'vbank', 'mobile', 'transfer']);

function blankToUndefined(value: unknown) {
  if (value == null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

export const createOrderSchema = z.object({
  buyerName: z.preprocess(blankToUndefined, z.string().trim().min(2).max(50).optional()),
  buyerEmail: z.preprocess(blankToUndefined, z.string().trim().email().max(120).optional()),
  buyerPhone: z.preprocess(blankToUndefined, z.string().trim().min(9).max(20).optional()),
  receiver: z.string().trim().min(2).max(50),
  phone: z.string().trim().min(9).max(20),
  receiverEmail: z.preprocess(blankToUndefined, z.string().trim().email().max(120).optional()),
  receiverPhone2: z.preprocess(blankToUndefined, z.string().trim().min(9).max(20).optional()),
  zipCode: z.string().trim().min(4).max(10),
  address1: z.string().trim().min(3).max(200),
  address2: z.string().trim().max(200).optional().or(z.literal('')),
  memo: z.string().trim().max(500).optional().or(z.literal('')),
  channel: z.preprocess(blankToUndefined, z.string().trim().max(40).optional()),
  deliveryType: z.preprocess(
    blankToUndefined,
    z.enum(['default', 'new', 'same_as_buyer']).optional(),
  ),
  paymentMethod: z.preprocess(blankToUndefined, paymentMethodSchema.optional()),
  depositorName: z.string().trim().max(50).optional().or(z.literal('')),
  depositDueDate: z.preprocess(blankToUndefined, z.coerce.date().optional()),
  cashReceiptType: z.enum(['none', 'personal', 'business']).default('none'),
  cashReceiptIdentity: z.string().trim().max(40).optional().or(z.literal('')),
  taxInvoiceRequested: z.coerce.boolean().default(false),
  taxInvoiceCompanyName: z.string().trim().max(100).optional().or(z.literal('')),
  taxInvoiceBusinessNumber: z.string().trim().max(20).optional().or(z.literal('')),
  saveShippingAddress: z.coerce.boolean().default(false),
  shippingBaseFee: z.coerce.number().int().min(0).optional(),
  shippingExtraFee: z.coerce.number().int().min(0).optional(),
  couponIssueId: z
    .preprocess((value) => (value === '' || value == null ? undefined : value), z.coerce.bigint().optional()),
  pointsToUse: z
    .preprocess((value) => (value === '' || value == null ? 0 : value), z.coerce.number().int().min(0))
    .default(0),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const userAddressSchema = z.object({
  label: z.string().trim().max(40).optional().or(z.literal('')),
  receiver: z.string().trim().min(2).max(50),
  phone: z.string().trim().min(9).max(20),
  zipCode: z.string().trim().min(4).max(10),
  address1: z.string().trim().min(3).max(200),
  address2: z.string().trim().max(200).optional().or(z.literal('')),
  isDefault: z.coerce.boolean().default(false),
});

export const updateUserAddressSchema = userAddressSchema.partial().extend({
  isDefault: z.coerce.boolean().optional(),
});

export type UserAddressInput = z.infer<typeof userAddressSchema>;
