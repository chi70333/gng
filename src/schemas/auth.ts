import { z } from 'zod';

export const loginSchema = z.object({
  loginId: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

function safeCallbackUrl(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export const socialLoginSchema = z.object({
  provider: z.enum(['kakao', 'naver']),
  callbackUrl: z
    .string()
    .trim()
    .optional()
    .transform((value) => safeCallbackUrl(value)),
});

export type SocialLoginInput = z.infer<typeof socialLoginSchema>;

export const logoutSchema = z.object({
  callbackUrl: z
    .preprocess(
      (value) => (typeof value === 'string' ? value : undefined),
      z.string().trim().optional(),
    )
    .transform((value) => safeCallbackUrl(value)),
});

export type LogoutInput = z.infer<typeof logoutSchema>;

const mobilePhoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[^0-9]/g, ''))
  .refine((value) => /^01[016789]\d{7,8}$/.test(value), {
    message: '휴대전화번호를 정확히 입력해 주세요.',
  });

const koreanZipCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, '우편번호를 5자리 숫자로 입력해 주세요.');

const optionalTrimmedString = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(''));

const addressFields = {
  zipCode: koreanZipCodeSchema,
  address1: z.string().trim().min(3, '주소를 입력해 주세요.').max(200),
  address2: z.string().trim().min(1, '상세주소를 입력해 주세요.').max(200),
};

const businessFields = {
  memberType: z.enum(['M', 'D']).default('M'),
  companyName: optionalTrimmedString(80),
  ceoName: optionalTrimmedString(50),
  businessNumber: optionalTrimmedString(20),
  businessType: optionalTrimmedString(50),
  businessItem: optionalTrimmedString(50),
  businessZipCode: optionalTrimmedString(10),
  businessAddress1: optionalTrimmedString(200),
  businessAddress2: optionalTrimmedString(200),
};

const marketingConsentFields = {
  marketingAccepted: z.enum(['y', 'n']).default('n'),
  smsAccepted: z.enum(['y', 'n']).default('n'),
};

type BusinessProfileInput = {
  memberType: 'M' | 'D';
} & Partial<Record<keyof typeof businessFields, string>>;

function requireBusinessField(
  ctx: z.RefinementCtx,
  data: Record<string, unknown>,
  field: keyof typeof businessFields,
  message: string,
) {
  if (typeof data[field] !== 'string' || data[field].trim().length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
  }
}

const businessProfileRefinement = (
  data: BusinessProfileInput,
  ctx: z.RefinementCtx,
) => {
  if (data.memberType !== 'D') return;

  requireBusinessField(ctx, data, 'companyName', '회사명을 입력해 주세요.');
  requireBusinessField(ctx, data, 'ceoName', '대표자명을 입력해 주세요.');
  requireBusinessField(ctx, data, 'businessNumber', '사업자등록번호를 입력해 주세요.');
  requireBusinessField(ctx, data, 'businessType', '업태를 입력해 주세요.');
  requireBusinessField(ctx, data, 'businessItem', '종목을 입력해 주세요.');
  requireBusinessField(ctx, data, 'businessZipCode', '사업장 우편번호를 입력해 주세요.');
  requireBusinessField(ctx, data, 'businessAddress1', '사업장 주소를 입력해 주세요.');
  requireBusinessField(ctx, data, 'businessAddress2', '사업장 상세주소를 입력해 주세요.');
};

export const registerSchema = z
  .object({
    loginId: z
      .string()
      .trim()
      .min(3, '3~20자의 영문과 숫자만 입력해 주세요.')
      .max(20, '3~20자의 영문과 숫자만 입력해 주세요.')
      .regex(/^[A-Za-z0-9]+$/, '3~20자의 영문과 숫자만 입력해 주세요.'),
    email: z.string().trim().email().max(255),
    name: z.string().trim().min(2).max(50),
    phone: mobilePhoneSchema,
    ...addressFields,
    password: z.string().min(8, '8자 이상 입력해 주세요.').max(128),
    ...businessFields,
    ...marketingConsentFields,
    termsAccepted: z.literal('y'),
    privacyAccepted: z.literal('y'),
  })
  .superRefine(businessProfileRefinement);

export type RegisterInput = z.infer<typeof registerSchema>;

export const socialRegisterSchema = z
  .object({
    email: z.string().trim().email().max(255),
    name: z.string().trim().min(2).max(50),
    phone: mobilePhoneSchema,
    ...addressFields,
    ...businessFields,
    ...marketingConsentFields,
    termsAccepted: z.literal('y'),
    privacyAccepted: z.literal('y'),
  })
  .superRefine(businessProfileRefinement);

export type SocialRegisterInput = z.infer<typeof socialRegisterSchema>;
