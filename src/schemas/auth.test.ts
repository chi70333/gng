import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './auth';

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
  it('requires both legacy join agreements', () => {
    const parsed = registerSchema.safeParse({
      loginId: 'user01',
      email: 'user@example.com',
      name: '홍길동',
      phone: '01012345678',
      password: 'Password123!',
      termsAccepted: 'y',
      privacyAccepted: 'n',
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts registration input after required agreements', () => {
    const parsed = registerSchema.parse({
      loginId: 'user01',
      email: 'user@example.com',
      name: '홍길동',
      phone: '01012345678',
      password: 'Password123!',
      termsAccepted: 'y',
      privacyAccepted: 'y',
    });

    expect(parsed.loginId).toBe('user01');
  });
});
