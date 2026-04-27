import { z } from 'zod';

export const paymentProviderSchema = z.enum(['legacy-payaction', 'ksnet', 'kiwoompay']);
export const paymentMethodSchema = z.enum(['card', 'bank', 'vbank', 'mobile', 'transfer', 'unknown']);
export const paymentStatusSchema = z.enum(['approved', 'failed', 'cancelled']);

export const paymentCallbackSchema = z.object({
  orderNo: z.string().trim().min(1).max(40),
  provider: paymentProviderSchema.default('legacy-payaction'),
  providerTxId: z.string().trim().min(1).max(120).optional(),
  method: paymentMethodSchema.default('card'),
  amount: z.coerce.number().int().min(0),
  status: paymentStatusSchema,
  responseCode: z.string().trim().max(40).optional(),
  responseMessage: z.string().trim().max(255).optional(),
  callbackHash: z.string().trim().length(64).optional(),
  eventAt: z.coerce.date().optional(),
  rawResponse: z.unknown().optional(),
});

export type PaymentCallbackInput = z.infer<typeof paymentCallbackSchema>;

export const paymentStartSchema = z.object({
  orderNo: z.string().trim().min(1).max(40),
  provider: paymentProviderSchema.default('legacy-payaction'),
  method: paymentMethodSchema.exclude(['unknown']).default('card'),
  returnUrl: z.string().trim().url().optional(),
});

export type PaymentStartInput = z.infer<typeof paymentStartSchema>;
