// Legacy source: legacy/www/include/footer.php
// Summary: renders CS, company, and bank footer data. Hosting/WebBridge is intentionally omitted.
// Cache: public site settings are read through getCachedSitePolicy with ISR 1h.

import Link from 'next/link';
import { getCachedSitePolicy } from '@/server/services/site-policy.service';

const LABELS = {
  privacyOfficer: '개인정보보호책임자. ',
  businessNumber: '사업자등록번호 ',
  businessCheck: '사업자정보확인',
  mailOrderNumber: '통신판매업신고 ',
} as const;

const FOOTER_LINKS = [
  { href: '/company', label: '회사소개' },
  { href: '/faq', label: '고객센터' },
  { href: '/legal/terms', label: '이용약관' },
  { href: '/legal/privacy', label: '개인정보처리방침' },
] as const;

export default async function Footer() {
  const policy = await getCachedSitePolicy();

  return (
    <footer className="mt-auto border-t border-neutral-200 bg-neutral-50 text-neutral-700">
      <div className="mx-auto grid max-w-screen-xl grid-cols-1 gap-8 px-4 py-8 text-center text-[13px] leading-relaxed md:grid-cols-[280px_1fr_280px] md:items-start md:gap-6 md:px-6 md:py-10">
        <section aria-labelledby="footer-cs">
          <h2 id="footer-cs" className="mb-4 text-sm font-extrabold text-neutral-950">
            고객센터
          </h2>
          <p className="mb-4 text-lg font-extrabold text-neutral-950">{policy.customerCenterTel}</p>
          <div className="space-y-0.5 text-neutral-600">
            <p>{policy.weekdayHours}</p>
            <p>{policy.saturdayHours}</p>
            <p>{policy.lunchHours}</p>
          </div>
        </section>

        <section aria-labelledby="footer-company" className="md:px-2">
          <h2 id="footer-company" className="mb-4 text-sm font-extrabold text-neutral-950">
            회사 정보
          </h2>
          <div className="space-y-1 text-neutral-600">
            <p>
              <span>{policy.companyName}</span>
              <span className="mx-2">대표 {policy.companyCeo}</span>
              <span>{policy.companyAddress}</span>
            </p>
            <p>
              {LABELS.privacyOfficer}
              {policy.privacyOfficer}
            </p>
            <p>
              <span>
                {LABELS.businessNumber}
                {policy.businessNumber}
              </span>
              <a
                className="mx-1 inline-flex min-h-11 items-center rounded-md border border-neutral-300 bg-white px-2 text-[11px] font-semibold text-neutral-600 transition-colors hover:border-neutral-500 hover:text-neutral-900 md:min-h-6"
                href={`https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${policy.businessNumber.replaceAll('-', '')}`}
                target="_blank"
                rel="noreferrer"
              >
                {LABELS.businessCheck}
              </a>
              <span>
                {LABELS.mailOrderNumber}
                {policy.mailOrderNumber}
              </span>
            </p>
            <p>
              <span>전화 {policy.companyTel}</span>
              {policy.companyFax ? <span className="mx-3">팩스 {policy.companyFax}</span> : null}
            </p>
            <p>
              이메일{' '}
              <a
                className="inline-flex min-h-11 items-center hover:text-neutral-900 md:min-h-6"
                href={`mailto:${policy.companyEmail}`}
              >
                {policy.companyEmail}
              </a>
            </p>
          </div>
        </section>

        <section aria-labelledby="footer-bank">
          <h2 id="footer-bank" className="mb-4 text-sm font-extrabold text-neutral-950">
            입금 계좌
          </h2>
          <div className="flex items-center justify-center gap-3">
            <span
              className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-sky-100 px-2 text-base font-extrabold tracking-normal text-sky-700"
              aria-hidden="true"
            >
              {policy.bankLogoText}
            </span>
            <span className="text-base font-semibold text-neutral-800">{policy.bankName}</span>
          </div>
          <p className="mt-3 text-base font-bold text-neutral-950">{policy.bankAccount}</p>
        </section>
      </div>

      <nav aria-label="푸터 바로가기" className="border-t border-neutral-200 bg-white/80">
        <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-center gap-x-0 gap-y-1 px-3 py-3 text-xs font-semibold text-neutral-700 md:py-4 md:text-sm">
          {FOOTER_LINKS.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative flex min-h-11 items-center px-3 transition-colors hover:text-neutral-950 md:min-h-6 md:px-4"
            >
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 h-3 -translate-y-1/2 border-l border-neutral-300"
                />
              ) : null}
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </footer>
  );
}
