import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Kakao from 'next-auth/providers/kakao';
import Naver from 'next-auth/providers/naver';
import { cookies } from 'next/headers';
import { loginSchema } from '@/schemas/auth';
import { adminLoginSchema } from '@/schemas/admin-auth';
import { logger } from '@/lib/logger';
import { verifyAdminCredentials } from '@/server/admin/credentials';
import { prisma } from '@/server/db';
import {
  SocialAccountNotRegisteredError,
  type SocialProvider,
  linkSocialUser,
  verifyCredentials,
} from '@/server/services/auth.service';
import {
  SOCIAL_CALLBACK_COOKIE,
  SOCIAL_PENDING_COOKIE,
  SOCIAL_PENDING_MAX_AGE,
  decodeSocialRegistrationToken,
  encodePendingSocialProfile,
  sanitizeCallbackUrl,
} from '@/server/services/social-pending.service';

function isSocialProvider(provider: string): provider is SocialProvider {
  return provider === 'kakao' || provider === 'naver';
}

function isUserKind(value: unknown): value is 'member' | 'admin' {
  return value === 'member' || value === 'admin';
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asOptionalStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function canonicalSiteOrigin(): string | null {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') return null;
  if (process.env.NODE_ENV !== 'production') return null;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return null;

  try {
    const url = new URL(siteUrl);
    return url.origin;
  } catch {
    logger.warn({ siteUrl }, 'Invalid NEXT_PUBLIC_SITE_URL for auth redirect');
    return null;
  }
}

function isSafeRelativePath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}

function recordValue(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[key]
    : null;
}

function normalizeKakaoPhoneNumber(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const digits = value.replace(/[^0-9]/g, '');
  if (digits.startsWith('82') && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }

  if (digits.startsWith('010')) return digits;
  return null;
}

function kakaoProfilePhoneNumber(profile: unknown): string | null {
  const kakaoAccount = recordValue(profile, 'kakao_account');
  return normalizeKakaoPhoneNumber(recordValue(kakaoAccount, 'phone_number'));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    Credentials({
      id: 'credentials',
      credentials: {
        loginId: { label: 'Login ID', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        return verifyCredentials(parsed.data);
      },
    }),
    Credentials({
      id: 'admin-credentials',
      credentials: {
        loginId: { label: 'Admin ID', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = adminLoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        return verifyAdminCredentials(parsed.data);
      },
    }),
    Credentials({
      id: 'social-registration',
      credentials: {
        token: { label: 'Token', type: 'text' },
      },
      async authorize(credentials) {
        const token =
          typeof credentials?.token === 'string'
            ? decodeSocialRegistrationToken(credentials.token)
            : null;
        if (!token) return null;

        const user = await prisma.user.findUnique({
          where: { id: BigInt(token.userId) },
          select: { id: true, email: true, name: true, status: true },
        });

        if (!user || user.status !== 'active' || user.email !== token.email) return null;

        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          userKind: 'member',
        };
      },
    }),
    ...(process.env.KAKAO_CLIENT_ID
      ? [
          Kakao({
            clientId: process.env.KAKAO_CLIENT_ID,
            ...(process.env.KAKAO_CLIENT_SECRET
              ? { clientSecret: process.env.KAKAO_CLIENT_SECRET }
              : { client: { token_endpoint_auth_method: 'none' } }),
            authorization: {
              url: 'https://kauth.kakao.com/oauth/authorize',
              params: { scope: 'profile_nickname account_email phone_number' },
            },
          }),
        ]
      : []),
    ...(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET
      ? [
          Naver({
            clientId: process.env.NAVER_CLIENT_ID,
            clientSecret: process.env.NAVER_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      const siteOrigin = canonicalSiteOrigin() ?? baseUrl;

      if (isSafeRelativePath(url)) {
        return `${siteOrigin}${url}`;
      }

      try {
        const parsedUrl = new URL(url);
        const baseOrigin = new URL(baseUrl).origin;
        if (parsedUrl.origin === baseOrigin || parsedUrl.origin === siteOrigin) {
          return `${siteOrigin}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
        }
      } catch {
        return siteOrigin;
      }

      return siteOrigin;
    },
    async signIn({ user, account, profile }) {
      if (!account || !isSocialProvider(account.provider)) return true;

      if (!user.email) {
        return '/login?error=oauth_email';
      }

      try {
        const linkedUser = await linkSocialUser({
          provider: account.provider,
          providerUid: account.providerAccountId,
          email: user.email,
          name: user.name,
        });

        user.id = linkedUser.id;
        user.email = linkedUser.email;
        user.name = linkedUser.name;
        user.userKind = linkedUser.userKind;
        return true;
      } catch (err) {
        if (err instanceof SocialAccountNotRegisteredError) {
          const callbackUrl = sanitizeCallbackUrl(cookies().get(SOCIAL_CALLBACK_COOKIE)?.value);
          cookies().set(
            SOCIAL_PENDING_COOKIE,
            encodePendingSocialProfile({
              provider: account.provider,
              providerUid: account.providerAccountId,
              email: user.email,
              name: user.name ?? null,
              phone: account.provider === 'kakao' ? kakaoProfilePhoneNumber(profile) : null,
              callbackUrl,
            }),
            {
              httpOnly: true,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              maxAge: SOCIAL_PENDING_MAX_AGE,
              path: '/',
            },
          );
          return `/join/terms?social=${account.provider}`;
        }

        logger.error({ err, provider: account.provider }, 'Social sign-in link failed');
        return '/login?error=oauth';
      }
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      if (user?.email) token.email = user.email;
      if (user?.name) token.name = user.name;
      if (user?.userKind) token.userKind = user.userKind;
      if (user?.adminRole) token.adminRole = user.adminRole;
      if (user?.permissions) token.permissions = user.permissions;
      if (typeof user?.sessionVersion === 'number') {
        token.sessionVersion = user.sessionVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.userKind = isUserKind(token.userKind) ? token.userKind : undefined;
        session.user.adminRole = asOptionalString(token.adminRole);
        session.user.permissions = asOptionalStringArray(token.permissions);
        session.user.sessionVersion = asOptionalNumber(token.sessionVersion);
      }
      return session;
    },
  },
});
