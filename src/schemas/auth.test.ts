import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema, socialRegisterSchema } from './auth';

describe('loginSchema', () => {
  it('accepts member id login without join-time format hints', () => {
    const parsed = loginSchema.parse({
      loginId: 'user01',
      password: 'pw',
    });

    expect(parsed.loginId).toBe('user01');
  });

  it('accepts email login for existing accounts', () => {
    const parsed = loginSchema.parse({
      loginId: 'user@example.com',
      password: 'pw',
    });

    expect(parsed.loginId).toBe('user@example.com');
  });

  it('rejects empty login fields only', () => {
    const parsed = loginSchema.safeParse({
      loginId: '',
      password: '',
    });

    expect(parsed.success).toBe(false);
  });
});

describe('registerSchema', () => {
  const validRegisterInput = {
    loginId: 'user01',
    email: 'user@example.com',
    name: '홍길동',
    phone: '01012345678',
    zipCode: '06234',
    address1: '서울시 강남구 테헤란로 1',
    address2: '101호',
    password: 'Password123!',
    termsAccepted: 'y',
    privacyAccepted: 'y',
  };

  it('requires both legacy join agreements', () => {
    const parsed = registerSchema.safeParse({
      ...validRegisterInput,
      termsAccepted: 'y',
      privacyAccepted: 'n',
    });

    expect(parsed.success).toBe(false);
  });

  it('requires default shipping address fields at join time', () => {
    const parsed = registerSchema.safeParse({
      ...validRegisterInput,
      zipCode: '',
      address1: '',
      address2: '',
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts registration input after required agreements', () => {
    const parsed = registerSchema.parse(validRegisterInput);

    expect(parsed.loginId).toBe('user01');
    expect(parsed.zipCode).toBe('06234');
  });

  it('requires business profile fields for business members', () => {
    const parsed = registerSchema.safeParse({
      ...validRegisterInput,
      memberType: 'D',
      companyName: '',
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts business member registration fields', () => {
    const parsed = registerSchema.parse({
      ...validRegisterInput,
      memberType: 'D',
      companyName: '지앤지',
      ceoName: '대표자',
      businessNumber: '123-45-67890',
      businessType: '도소매',
      businessItem: '상품',
      businessZipCode: '06234',
      businessAddress1: '서울시 강남구 테헤란로',
      businessAddress2: '사업장 1층',
      marketingAccepted: 'y',
      smsAccepted: 'y',
    });

    expect(parsed.memberType).toBe('D');
    expect(parsed.marketingAccepted).toBe('y');
  });
});

describe('socialRegisterSchema', () => {
  it('requires a default shipping address for social registration', () => {
    const parsed = socialRegisterSchema.safeParse({
      email: 'social@example.com',
      name: '홍길동',
      phone: '010-1234-5678',
      termsAccepted: 'y',
      privacyAccepted: 'y',
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts social registration input and normalizes mobile phone digits', () => {
    const parsed = socialRegisterSchema.parse({
      email: 'social@example.com',
      name: '홍길동',
      phone: '010-1234-5678',
      zipCode: '06234',
      address1: '서울시 강남구 테헤란로 1',
      address2: '101호',
      termsAccepted: 'y',
      privacyAccepted: 'y',
    });

    expect(parsed.phone).toBe('01012345678');
    expect(parsed.address2).toBe('101호');
  });
});
