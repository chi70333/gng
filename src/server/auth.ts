import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Kakao from 'next-auth/providers/kakao';
import Naver from 'next-auth/providers/naver';
import { cookies } from 'next/headers';
import { loginSchema } from '@/schemas/auth';
import { adminLoginSchema } from '@/schemas/admin-auth';
import { logger } from '@/lib/logger';
import { verifyAdminCredentials } from '@/server/admin/credentials';
import {
  SocialAccountNotRegisteredError,
  type SocialProvider,
  linkSocialUser,
  verifyCredentials,
} from '@/server/services/auth.service';
import {
  SOCIAL_PENDING_COOKIE,
  SOCIAL_PENDING_MAX_AGE,
  encodePendingSocialProfile,
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
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
    ...(process.env.KAKAO_CLIENT_ID
      ? [
          Kakao({
            clientId: process.env.KAKAO_CLIENT_ID,
            ...(process.env.KAKAO_CLIENT_SECRET
              ? { clientSecret: process.env.KAKAO_CLIENT_SECRET }
              : { client: { token_endpoint_auth_method: 'none' } }),
            authorization: {
              url: 'https://kauth.kakao.com/oauth/authorize',
              params: { scope: 'profile_nickname account_email' },
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
    async signIn({ user, account }) {
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
        return true;
      } catch (err) {
        if (err instanceof SocialAccountNotRegisteredError) {
          cookies().set(
            SOCIAL_PENDING_COOKIE,
            encodePendingSocialProfile({
              provider: account.provider,
              providerUid: account.providerAccountId,
              email: user.email,
              name: user.name ?? null,
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

        logger.error(
          { err, provider: account.provider },
          'Social sign-in link failed',
        );
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
