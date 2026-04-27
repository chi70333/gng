// Legacy source: company.php
// Cache: ISR 1h. Company information is DB-backed site policy content.

import type { Metadata } from 'next';
import PolicyText from '@/components/shop/PolicyText';
import { getCachedSitePolicy } from '@/server/services/site-policy.service';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '회사소개',
};

export default async function CompanyPage() {
  const policy = await getCachedSitePolicy();

  return (
    <div className="mx-auto max-w-screen-md px-4 py-8">
      <h1 className="text-2xl font-bold text-neutral-900">회사소개</h1>
      <section className="mt-6 rounded-lg bg-white p-5">
        <PolicyText content={policy.companyInfo} htmlEnabled={policy.htmlEnabled} />
      </section>
    </div>
  );
}
