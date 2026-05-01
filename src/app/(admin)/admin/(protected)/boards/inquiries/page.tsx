// Legacy sources: ask_list.php, ask_view.php, wb_admin/bbs_list.php.
// Cache: no-store. 1:1 inquiry answers are private operational data.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { Filter, RotateCcw } from 'lucide-react';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { formatNumber } from '@/lib/format';
import {
  AdminDataGrid,
  AdminMobileCard,
  AdminMobileField,
  adminGridButtonClass,
  adminGridCellClass,
  adminGridStickyCellClass,
} from '@/components/admin/AdminDataGrid';
import { AdminPageSizeSelect } from '@/components/admin/AdminPageSizeSelect';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import {
  AdminPageHeader,
  AdminSection,
  adminFieldClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminTextareaClass,
} from '@/components/admin/AdminUI';
import { answerInquiry } from '../../../actions';
import { BoardAdminNav } from '../BoardAdminNav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '1:1 문의 관리',
  description: '관리자 1:1 문의 답변을 관리합니다.',
};

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

type InquirySearchParams = {
  q?: string;
  status?: string;
  page?: string;
  pageSize?: string;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function inquiryStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: '미답변',
    answered: '답변완료',
    closed: '종료',
  };
  return labels[status] ?? status;
}

function buildInquiryWhere({ q, status }: { q: string; status: string }): Prisma.InquiryWhereInput {
  return {
    deletedAt: null,
    ...(status !== 'all' ? { status } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { content: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { email: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { phone: { contains: q } },
            { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
  };
}

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: InquirySearchParams;
}) {
  await requireAdmin('content.read');

  const page = parsePositiveInt(searchParams.page, 1);
  const requestedPageSize = parsePositiveInt(searchParams.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize)
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE;
  const q = searchParams.q?.trim() ?? '';
  const status =
    searchParams.status === 'answered' ||
    searchParams.status === 'closed' ||
    searchParams.status === 'all'
      ? searchParams.status
      : 'open';
  const where = buildInquiryWhere({ q, status });

  const [inquiries, total, totalPosts, unansweredProductQna, unansweredInquiries] =
    await prisma.$transaction([
      prisma.inquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          content: true,
          answer: true,
          status: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
          answeredAt: true,
        },
      }),
      prisma.inquiry.count({ where }),
      prisma.post.count({ where: { deletedAt: null } }),
      prisma.productQna.count({ where: { answer: null } }),
      prisma.inquiry.count({ where: { status: 'open', deletedAt: null } }),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasNext = page < totalPages;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('status', status);
  params.set('pageSize', String(pageSize));
  const baseHref = `/admin/boards/inquiries?${params.toString()}`;
  const currentParams = new URLSearchParams(params);
  if (page > 1) currentParams.set('page', String(page));
  const currentHref = `/admin/boards/inquiries?${currentParams.toString()}`;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="1:1 문의 관리"
        description={`조회 결과 ${formatNumber(total)}건을 관리합니다.`}
      />

      <BoardAdminNav
        active="inquiries"
        counts={{
          posts: totalPosts,
          productQna: unansweredProductQna,
          inquiries: unansweredInquiries,
        }}
      />

      <AdminSection
        title="조회 조건"
        description="제목, 내용, 이름, 이메일, 연락처 기준으로 찾습니다."
        icon={Filter}
      >
        <form className="grid gap-2 md:grid-cols-[1fr_160px_auto_auto]" method="get">
          <input
            name="q"
            defaultValue={q}
            placeholder="제목, 내용, 이름, 이메일, 연락처"
            className={`${adminFieldClass} h-11`}
          />
          <select
            name="status"
            defaultValue={status}
            className={`${adminFieldClass} h-11`}
            aria-label="1:1 문의 답변 상태"
          >
            <option value="open">미답변</option>
            <option value="answered">답변완료</option>
            <option value="closed">종료</option>
            <option value="all">전체</option>
          </select>
          <input type="hidden" name="pageSize" value={pageSize} />
          <button className={`${adminPrimaryButtonClass} h-11`}>검색</button>
          <Link href="/admin/boards/inquiries" className={`${adminSecondaryButtonClass} h-11`}>
            <RotateCcw size={17} />
            초기화
          </Link>
        </form>
      </AdminSection>

      <AdminSection
        title="1:1 문의 목록"
        description={`현재 페이지 ${formatNumber(inquiries.length)}건 · ${formatNumber(page)} / 총 ${formatNumber(totalPages)}페이지`}
        bodyClassName="p-0"
        headerAction={
          <AdminPageSizeSelect
            action="/admin/boards/inquiries"
            name="pageSize"
            value={pageSize}
            options={PAGE_SIZE_OPTIONS}
            hiddenFields={Array.from(params.entries()).map(([name, value]) => ({ name, value }))}
          />
        }
      >
        <AdminDataGrid
          caption="1:1 문의 목록"
          columns={[
            { key: 'no', label: '번호', align: 'right', widthClassName: 'w-20' },
            {
              key: 'inquiry',
              label: '문의',
              widthClassName: 'min-w-[420px]',
              priority: 'primary',
            },
            { key: 'customer', label: '고객', widthClassName: 'w-40' },
            { key: 'status', label: '상태', widthClassName: 'w-28' },
            { key: 'contact', label: '연락처', widthClassName: 'w-56' },
            { key: 'created', label: '등록일', align: 'right', widthClassName: 'w-32' },
          ]}
          rows={inquiries}
          rowKey={(inquiry) => inquiry.id.toString()}
          emptyText="조회된 1:1 문의가 없습니다."
          minWidthClassName="min-w-[1160px]"
          renderRow={(inquiry, index) => {
            const rowNo = total - (page - 1) * pageSize - index;
            return (
              <tr
                key={inquiry.id.toString()}
                className="bg-white align-top transition hover:bg-neutral-50"
              >
                <td className={`${adminGridCellClass} text-right font-bold text-neutral-500`}>
                  {formatNumber(rowNo)}
                </td>
                <td className={adminGridStickyCellClass}>
                  <details className="group">
                    <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded px-1 font-extrabold text-neutral-950 hover:bg-neutral-50">
                      <span className="line-clamp-1">{inquiry.title}</span>
                      <span className="shrink-0 text-[11px] font-bold text-blue-700 group-open:hidden">
                        답변 열기
                      </span>
                      <span className="hidden shrink-0 text-[11px] font-bold text-neutral-500 group-open:inline">
                        접기
                      </span>
                    </summary>
                    <div className="mt-3 grid gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                        {inquiry.content}
                      </p>
                      <form action={answerInquiry} className="grid gap-2">
                        <input type="hidden" name="inquiryId" value={inquiry.id.toString()} />
                        <input type="hidden" name="redirectTo" value={currentHref} />
                        <textarea
                          name="answer"
                          rows={4}
                          defaultValue={inquiry.answer ?? ''}
                          placeholder="1:1 문의 답변"
                          className={adminTextareaClass}
                          required
                        />
                        <div className="flex justify-end">
                          <button className={`${adminGridButtonClass} h-10 px-4`}>
                            답변 저장
                          </button>
                        </div>
                      </form>
                    </div>
                  </details>
                </td>
                <td className={adminGridCellClass}>{inquiry.name}</td>
                <td className={adminGridCellClass}>
                  <AdminStatusBadge status={inquiry.status} />
                  <span className="sr-only">{inquiryStatusLabel(inquiry.status)}</span>
                </td>
                <td className={`${adminGridCellClass} break-all text-xs`}>
                  {inquiry.email}
                  <br />
                  {inquiry.phone ?? '-'}
                </td>
                <td className={`${adminGridCellClass} text-right text-neutral-500`}>
                  {inquiry.createdAt.toLocaleDateString('ko-KR')}
                </td>
              </tr>
            );
          }}
          renderMobileCard={(inquiry) => (
            <AdminMobileCard>
              <details className="group">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-extrabold text-neutral-950">
                        {inquiry.title}
                      </p>
                      <p className="mt-1 break-all text-xs font-semibold text-neutral-500">
                        {inquiry.email}
                      </p>
                    </div>
                    <AdminStatusBadge status={inquiry.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2">
                    <AdminMobileField label="고객">{inquiry.name}</AdminMobileField>
                    <AdminMobileField label="등록일" align="right">
                      {inquiry.createdAt.toLocaleDateString('ko-KR')}
                    </AdminMobileField>
                    <AdminMobileField label="연락처">{inquiry.phone ?? '-'}</AdminMobileField>
                    <AdminMobileField label="답변일" align="right">
                      {inquiry.answeredAt?.toLocaleDateString('ko-KR') ?? '-'}
                    </AdminMobileField>
                  </dl>
                  <p className="mt-3 text-right text-xs font-bold text-blue-700 group-open:hidden">
                    답변 열기
                  </p>
                  <p className="mt-3 hidden text-right text-xs font-bold text-neutral-500 group-open:block">
                    답변 닫기
                  </p>
                </summary>
                <div className="mt-3 grid gap-3 border-t border-neutral-100 pt-3">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                    {inquiry.content}
                  </p>
                  <form action={answerInquiry} className="grid gap-3">
                    <input type="hidden" name="inquiryId" value={inquiry.id.toString()} />
                    <input type="hidden" name="redirectTo" value={currentHref} />
                    <textarea
                      name="answer"
                      rows={5}
                      defaultValue={inquiry.answer ?? ''}
                      placeholder="1:1 문의 답변"
                      className={adminTextareaClass}
                      required
                    />
                    <button className={`${adminGridButtonClass} h-11`}>답변 저장</button>
                  </form>
                </div>
              </details>
            </AdminMobileCard>
          )}
        />
      </AdminSection>

      <AdminPagination baseHref={baseHref} page={page} hasNext={hasNext} totalPages={totalPages} />
    </div>
  );
}
