// Legacy sources: goods_qna_write.php, wb_admin/bbs_list.php.
// Cache: no-store. Product Q&A answers are private operational data.

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
import { answerProductQna } from '../../../actions';
import { BoardAdminNav } from '../BoardAdminNav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '상품문의 관리',
  description: '관리자 상품문의 답변을 관리합니다.',
};

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

type ProductQnaSearchParams = {
  q?: string;
  status?: string;
  page?: string;
  pageSize?: string;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function qnaStatusLabel(answer: string | null): string {
  return answer ? '답변완료' : '미답변';
}

function buildQnaWhere({ q, status }: { q: string; status: string }): Prisma.ProductQnaWhereInput {
  return {
    ...(status === 'answered' ? { answer: { not: null } } : {}),
    ...(status === 'unanswered' ? { answer: null } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { content: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { product: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } },
            { user: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } },
          ],
        }
      : {}),
  };
}

export default async function AdminProductQnaPage({
  searchParams,
}: {
  searchParams: ProductQnaSearchParams;
}) {
  await requireAdmin('content.read');

  const page = parsePositiveInt(searchParams.page, 1);
  const requestedPageSize = parsePositiveInt(searchParams.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize)
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE;
  const q = searchParams.q?.trim() ?? '';
  const status =
    searchParams.status === 'answered' || searchParams.status === 'all'
      ? searchParams.status
      : 'unanswered';
  const where = buildQnaWhere({ q, status });

  const [qnas, total, totalPosts, unansweredProductQna, unansweredInquiries] =
    await prisma.$transaction([
      prisma.productQna.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          content: true,
          answer: true,
          isPrivate: true,
          createdAt: true,
          answeredAt: true,
          product: { select: { name: true } },
          user: { select: { name: true } },
        },
      }),
      prisma.productQna.count({ where }),
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
  const baseHref = `/admin/boards/product-qna?${params.toString()}`;
  const currentParams = new URLSearchParams(params);
  if (page > 1) currentParams.set('page', String(page));
  const currentHref = `/admin/boards/product-qna?${currentParams.toString()}`;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="상품문의 관리"
        description={`조회 결과 ${formatNumber(total)}건을 관리합니다.`}
      />

      <BoardAdminNav
        active="product-qna"
        counts={{
          posts: totalPosts,
          productQna: unansweredProductQna,
          inquiries: unansweredInquiries,
        }}
      />

      <AdminSection
        title="조회 조건"
        description="상품명, 문의 제목, 내용, 작성자 기준으로 찾습니다."
        icon={Filter}
      >
        <form className="grid gap-2 md:grid-cols-[1fr_160px_auto_auto]" method="get">
          <input
            name="q"
            defaultValue={q}
            placeholder="상품명, 제목, 내용, 작성자"
            className={`${adminFieldClass} h-11`}
          />
          <select
            name="status"
            defaultValue={status}
            className={`${adminFieldClass} h-11`}
            aria-label="상품문의 답변 상태"
          >
            <option value="unanswered">미답변</option>
            <option value="answered">답변완료</option>
            <option value="all">전체</option>
          </select>
          <input type="hidden" name="pageSize" value={pageSize} />
          <button className={`${adminPrimaryButtonClass} h-11`}>검색</button>
          <Link href="/admin/boards/product-qna" className={`${adminSecondaryButtonClass} h-11`}>
            <RotateCcw size={17} />
            초기화
          </Link>
        </form>
      </AdminSection>

      <AdminSection
        title="상품문의 목록"
        description={`현재 페이지 ${formatNumber(qnas.length)}건 · ${formatNumber(page)} / 총 ${formatNumber(totalPages)}페이지`}
        bodyClassName="p-0"
        headerAction={
          <AdminPageSizeSelect
            action="/admin/boards/product-qna"
            name="pageSize"
            value={pageSize}
            options={PAGE_SIZE_OPTIONS}
            hiddenFields={Array.from(params.entries()).map(([name, value]) => ({ name, value }))}
          />
        }
      >
        <AdminDataGrid
          caption="상품문의 목록"
          columns={[
            { key: 'no', label: '번호', align: 'right', widthClassName: 'w-20' },
            { key: 'qna', label: '문의', widthClassName: 'min-w-[420px]', priority: 'primary' },
            { key: 'product', label: '상품', widthClassName: 'w-56' },
            { key: 'status', label: '상태', widthClassName: 'w-28' },
            { key: 'author', label: '작성자', widthClassName: 'w-32' },
            { key: 'created', label: '등록일', align: 'right', widthClassName: 'w-32' },
          ]}
          rows={qnas}
          rowKey={(qna) => qna.id.toString()}
          emptyText="조회된 상품문의가 없습니다."
          minWidthClassName="min-w-[1120px]"
          renderRow={(qna, index) => {
            const rowNo = total - (page - 1) * pageSize - index;
            return (
              <tr
                key={qna.id.toString()}
                className="bg-white align-top transition hover:bg-neutral-50"
              >
                <td className={`${adminGridCellClass} text-right font-bold text-neutral-500`}>
                  {formatNumber(rowNo)}
                </td>
                <td className={adminGridStickyCellClass}>
                  <details className="group">
                    <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded px-1 font-extrabold text-neutral-950 hover:bg-neutral-50">
                      <span className="line-clamp-1">{qna.title}</span>
                      <span className="shrink-0 text-[11px] font-bold text-blue-700 group-open:hidden">
                        답변 열기
                      </span>
                      <span className="hidden shrink-0 text-[11px] font-bold text-neutral-500 group-open:inline">
                        접기
                      </span>
                    </summary>
                    <div className="mt-3 grid gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                        {qna.content}
                      </p>
                      <form action={answerProductQna} className="grid gap-2">
                        <input type="hidden" name="qnaId" value={qna.id.toString()} />
                        <input type="hidden" name="redirectTo" value={currentHref} />
                        <textarea
                          name="answer"
                          rows={4}
                          defaultValue={qna.answer ?? ''}
                          placeholder="상품문의 답변"
                          className={adminTextareaClass}
                          required
                        />
                        <div className="flex justify-end">
                          <button className={`${adminGridButtonClass} h-10 px-4`}>답변 저장</button>
                        </div>
                      </form>
                    </div>
                  </details>
                </td>
                <td className={adminGridCellClass}>
                  <span className="line-clamp-2">{qna.product.name}</span>
                </td>
                <td className={adminGridCellClass}>
                  <AdminStatusBadge status={qna.answer ? 'answered' : 'unanswered'} />
                  <span className="sr-only">{qnaStatusLabel(qna.answer)}</span>
                </td>
                <td className={adminGridCellClass}>{qna.user?.name ?? '비회원'}</td>
                <td className={`${adminGridCellClass} text-right text-neutral-500`}>
                  {qna.createdAt.toLocaleDateString('ko-KR')}
                </td>
              </tr>
            );
          }}
          renderMobileCard={(qna) => (
            <AdminMobileCard>
              <details className="group">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-extrabold text-neutral-950">{qna.title}</p>
                      <p className="mt-1 line-clamp-1 text-xs font-semibold text-neutral-500">
                        {qna.product.name}
                      </p>
                    </div>
                    <AdminStatusBadge status={qna.answer ? 'answered' : 'unanswered'} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2">
                    <AdminMobileField label="작성자">{qna.user?.name ?? '비회원'}</AdminMobileField>
                    <AdminMobileField label="등록일" align="right">
                      {qna.createdAt.toLocaleDateString('ko-KR')}
                    </AdminMobileField>
                    <AdminMobileField label="공개 여부">
                      {qna.isPrivate ? '비공개' : '공개'}
                    </AdminMobileField>
                    <AdminMobileField label="답변일" align="right">
                      {qna.answeredAt?.toLocaleDateString('ko-KR') ?? '-'}
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
                    {qna.content}
                  </p>
                  <form action={answerProductQna} className="grid gap-3">
                    <input type="hidden" name="qnaId" value={qna.id.toString()} />
                    <input type="hidden" name="redirectTo" value={currentHref} />
                    <textarea
                      name="answer"
                      rows={5}
                      defaultValue={qna.answer ?? ''}
                      placeholder="상품문의 답변"
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
