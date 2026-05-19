import { z } from 'zod';

export const accountRecoverSchema = z.object({
  email: z.string().trim().email().max(255),
});

export type AccountRecoverInput = z.infer<typeof accountRecoverSchema>;

export const passwordResetSchema = z
  .object({
    loginId: z.string().trim().min(1).max(255),
    email: z.string().trim().email().max(255),
    password: z.string().min(8, '비밀번호는 8자 이상 입력해 주세요.').max(128),
    passwordConfirm: z.string().min(1),
  })
  .refine((input) => input.password === input.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 일치하지 않습니다.',
  });

export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
