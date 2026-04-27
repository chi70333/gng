import { z } from 'zod';

export const loginSchema = z.object({
  loginId: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const socialLoginSchema = z.object({
  provider: z.enum(['kakao', 'naver']),
  callbackUrl: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
      return value;
    }),
});

export type SocialLoginInput = z.infer<typeof socialLoginSchema>;

export const logoutSchema = z.object({
  callbackUrl: z
    .preprocess(
      (value) => (typeof value === 'string' ? value : undefined),
      z.string().trim().optional(),
    )
    .transform((value) => {
      if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
      return value;
    }),
});

export type LogoutInput = z.infer<typeof logoutSchema>;

export const registerSchema = z.object({
  loginId: z.string().trim().min(3).max(20).regex(/^[A-Za-z0-9]+$/),
  email: z.string().trim().email().max(255),
  name: z.string().trim().min(2).max(50),
  phone: z.string().trim().min(9).max(20).optional().or(z.literal('')),
  password: z.string().min(8).max(128),
  termsAccepted: z.literal('y'),
  privacyAccepted: z.literal('y'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const socialRegisterSchema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().min(2).max(50),
  phone: z.string().trim().min(9).max(20).optional().or(z.literal('')),
  termsAccepted: z.literal('y'),
  privacyAccepted: z.literal('y'),
});

export type SocialRegisterInput = z.infer<typeof socialRegisterSchema>;
