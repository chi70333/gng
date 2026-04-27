import { z } from 'zod';

export const adminPermissionSchema = z.enum([
  'admin.manage',
  'product.read',
  'product.write',
  'order.read',
  'order.write',
  'user.read',
  'user.write',
  'coupon.read',
  'coupon.write',
  'content.read',
  'content.write',
  'settings.read',
  'settings.write',
]);

export type AdminPermission = z.infer<typeof adminPermissionSchema>;

export const adminLoginSchema = z.object({
  loginId: z.string().trim().min(3).max(80),
  password: z.string().min(8).max(128),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const adminAccountRoleSchema = z.enum(['super_admin', 'manager', 'operator', 'viewer']);
export const adminAccountStatusSchema = z.enum(['active', 'inactive', 'blocked']);

export const adminAccountFormSchema = z
  .object({
    id: z.coerce.bigint().optional(),
    loginId: z.string().trim().min(3, '관리자 ID를 입력해주세요.').max(80),
    email: z.string().trim().email('올바른 이메일을 입력해주세요.').max(120),
    name: z.string().trim().min(1, '관리자명을 입력해주세요.').max(80),
    password: z.string().min(8).max(128).optional().or(z.literal('')),
    role: adminAccountRoleSchema.default('operator'),
    permissions: z.array(adminPermissionSchema).default([]),
    status: adminAccountStatusSchema.default('active'),
  })
  .superRefine((value, ctx) => {
    if (!value.id && !value.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: '신규 관리자는 비밀번호가 필요합니다.',
      });
    }
  });

export type AdminAccountFormInput = z.infer<typeof adminAccountFormSchema>;
