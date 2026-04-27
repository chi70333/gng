// Legacy source: agree.php, member_article.php
// Cache: ISR 1h. Terms are DB-backed site policy content.

import type { Metadata } from 'next';
import PolicyText from '@/components/shop/PolicyText';
import { getCachedSitePolicy } from '@/server/services/site-policy.service';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '이용약관',
  description: '지앤지 이용약관',
};

export default async function TermsPage() {
  const policy = await getCachedSitePolicy();

  return (
    <div className="mx-auto max-w-screen-md px-4 py-8">
      <h1 className="text-2xl font-bold text-neutral-900">이용약관</h1>
      <section className="mt-6 rounded-lg bg-white p-5">
        <PolicyText content={policy.terms} htmlEnabled={policy.htmlEnabled} />
      </section>
    </div>
  );
}
