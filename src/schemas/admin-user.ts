import { z } from 'zod';

export const adminUserStatusSchema = z.enum(['active', 'dormant', 'withdrawn', 'blocked']);

const emptyStringToUndefined = (value: unknown) => (value === '' ? undefined : value);

export const adminUserListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  status: z.preprocess(emptyStringToUndefined, adminUserStatusSchema.optional()),
  page: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().min(1).max(1000).optional().default(1),
  ),
  pageSize: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().min(10).max(200).optional().default(30),
  ),
});

export const adminUserStatusFormSchema = z.object({
  userId: z.coerce.bigint(),
  status: adminUserStatusSchema,
});

export const adminUserBulkDeleteFormSchema = z.object({
  userIds: z.array(z.bigint()).min(1, '삭제할 회원을 선택해주세요.').max(100),
});

const optionalPositiveIntSchema = z.preprocess(
  (value) => (value === '' || value == null ? undefined : value),
  z.coerce.number().int().min(1).max(10000000).optional(),
);

export const adminUserBulkPointFormSchema = z
  .object({
    intent: z.enum(['mileage-grant', 'mileage-reset']),
    userIds: z.array(z.bigint()).min(1, '마일리지를 변경할 회원을 선택해주세요.').max(500),
    delta: optionalPositiveIntSchema,
    reason: z.string().trim().max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.intent === 'mileage-grant' && value.delta == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '부여할 마일리지를 입력해주세요.',
        path: ['delta'],
      });
    }
  });

export const adminUserPointFormSchema = z.object({
  userId: z.coerce.bigint(),
  delta: z.coerce.number().int().min(-10000000).max(10000000),
  reason: z.string().trim().min(1).max(200),
});

export const adminUserPointResetFormSchema = z.object({
  userId: z.coerce.bigint(),
  intent: z.literal('reset'),
  reason: z.string().trim().min(1).max(200),
  confirm: z
    .string()
    .trim()
    .refine((value) => value === '초기화', {
      message: '초기화하려면 확인란에 초기화를 입력해주세요.',
    }),
});

export const adminUserPointDeleteSchema = z.object({
  userId: z.coerce.bigint(),
  pointId: z.coerce.bigint(),
});

export const adminUserPointHistoryQuerySchema = z.object({
  userId: z.coerce.bigint(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const adminUserMessageFormSchema = z.object({
  userId: z.coerce.bigint(),
  channel: z.enum(['email', 'sms']),
  subject: z.string().trim().max(120).optional().or(z.literal('')),
  content: z.string().trim().min(1, '발송 내용을 입력해주세요.').max(1000),
});
