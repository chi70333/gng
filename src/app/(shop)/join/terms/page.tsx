// Legacy source: member_article.php
// Cache: no-cache. Join agreement sets a short-lived per-user cookie.

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import JoinTermsForm from '@/components/shop/JoinTermsForm';
import { getCachedSitePolicy } from '@/server/services/site-policy.service';
import {
  SOCIAL_PENDING_COOKIE,
  decodePendingSocialProfile,
} from '@/server/services/social-pending.service';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '회원가입 약관동의',
  description: '지앤지 회원가입 약관 및 개인정보 수집 이용 동의',
};

type JoinTermsPageProps = {
  searchParams: { error?: string; social?: string };
};

export default async function JoinTermsPage({ searchParams }: JoinTermsPageProps) {
  const policy = await getCachedSitePolicy();
  const social =
    searchParams.social === 'kakao' || searchParams.social === 'naver'
      ? searchParams.social
      : undefined;
  const pendingSocial = decodePendingSocialProfile(cookies().get(SOCIAL_PENDING_COOKIE)?.value);
  const pendingSocialProvider =
    pendingSocial && pendingSocial.provider === social ? pendingSocial.provider : undefined;

  return (
    <div className="mx-auto w-full max-w-screen-md px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">약관동의</h1>
        <p className="mt-1 text-sm text-neutral-500">
          필수 약관에 동의해야 회원가입을 진행할 수 있습니다.
        </p>
      </div>
      <JoinTermsForm
        terms={policy.terms}
        privacy={policy.privacy}
        collectionConsent={policy.collectionConsent}
        error={searchParams.error}
        social={social}
        pendingSocialProvider={pendingSocialProvider}
      />
    </div>
  );
}
