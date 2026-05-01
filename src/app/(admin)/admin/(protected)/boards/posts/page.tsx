// Legacy sources: wb_admin/bbs_list.php, wb_admin/bbs_write.php, wb_admin/bbs_edit.php.
// Cache: no-store. Admin post management must reflect live operational state.

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
import {
  AdminPageHeader,
  AdminSection,
  adminDangerButtonClass,
  adminFieldClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminTextareaClass,
} from '@/components/admin/AdminUI';
import { deleteAdminPost, saveAdminPost } from '../../../actions';
import { BoardAdminNav } from '../BoardAdminNav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '게시글 관리',
  description: '관리자 게시글을 검색하고 수정합니다.',
};

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

type AdminPostSearchParams = {
  q?: string;
  boardId?: string;
  flag?: string;
  page?: string;
  pageSize?: string;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBigIntFilter(value: string | undefined): bigint | undefined {
  if (!value || !/^[0-9]+$/.test(value)) return undefined;
  return BigInt(value);
}

function postFlagLabel(post: { isNotice: boolean; isSecret: boolean }): string {
  if (post.isNotice && post.isSecret) return '공지/비밀';
  if (post.isNotice) return '공지';
  if (post.isSecret) return '비밀';
  return '일반';
}

function boardTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    free: '일반',
    notice: '공지',
    event: '이벤트',
    faq: 'FAQ',
  };
  return labels[type] ?? type;
}

function buildPostWhere({
  q,
  boardId,
  flag,
}: {
  q: string;
  boardId?: bigint;
  flag: string;
}): Prisma.PostWhereInput {
  return {
    deletedAt: null,
    ...(boardId ? { boardId } : {}),
    ...(flag === 'notice' ? { isNotice: true } : {}),
    ...(flag === 'secret' ? { isSecret: true } : {}),
    ...(flag === 'normal' ? { isNotice: false, isSecret: false } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { content: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { authorName: { contains: q, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
  };
}

export default async function AdminBoardPostsPage({
  searchParams,
}: {
  searchParams: AdminPostSearchParams;
}) {
  await requireAdmin('content.read');

  const page = parsePositiveInt(searchParams.page, 1);
  const requestedPageSize = parsePositiveInt(searchParams.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize)
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE;
  const q = searchParams.q?.trim() ?? '';
  const boardId = parseBigIntFilter(searchParams.boardId);
  const flag = searchParams.flag ?? '';
  const where = buildPostWhere({ q, boardId, flag });

  const [boards, posts, total, totalPosts, unansweredProductQna, unansweredInquiries] =
    await prisma.$transaction([
      prisma.board.findMany({
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, name: true, type: true },
      }),
      prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          boardId: true,
          title: true,
          content: true,
          authorName: true,
          isNotice: true,
          isSecret: true,
          viewCount: true,
          createdAt: true,
          board: { select: { name: true } },
        },
      }),
      prisma.post.count({ where }),
      prisma.post.count({ where: { deletedAt: null } }),
      prisma.productQna.count({ where: { answer: null } }),
      prisma.inquiry.count({ where: { status: 'open', deletedAt: null } }),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasNext = page < totalPages;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (boardId) params.set('boardId', boardId.toString());
  if (flag) params.set('flag', flag);
  params.set('pageSize', String(pageSize));
  const baseHref = `/admin/boards/posts?${params.toString()}`;
  const currentParams = new URLSearchParams(params);
  if (page > 1) currentParams.set('page', String(page));
  const currentHref = `/admin/boards/posts?${currentParams.toString()}`;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="게시글 관리"
        description={`조회 결과 ${formatNumber(total)}건을 관리합니다.`}
      />

      <BoardAdminNav
        active="posts"
        counts={{
          posts: totalPosts,
          productQna: unansweredProductQna,
          inquiries: unansweredInquiries,
        }}
      />

      <AdminSection
        title="조회 조건"
        description="게시판, 제목, 내용, 작성자 기준으로 게시글을 찾습니다."
        icon={Filter}
      >
        <form className="grid gap-2 md:grid-cols-[1fr_180px_140px_auto_auto]" method="get">
          <input
            name="q"
            defaultValue={q}
            placeholder="제목, 내용, 작성자"
            className={`${adminFieldClass} h-11`}
          />
          <select
            name="boardId"
            defaultValue={boardId?.toString() ?? ''}
            className={`${adminFieldClass} h-11`}
            aria-label="게시판 선택"
          >
            <option value="">전체 게시판</option>
            {boards.map((board) => (
              <option key={board.id.toString()} value={board.id.toString()}>
                {board.name}
              </option>
            ))}
          </select>
          <select
            name="flag"
            defaultValue={flag}
            className={`${adminFieldClass} h-11`}
            aria-label="게시글 구분"
          >
            <option value="">전체 구분</option>
            <option value="notice">공지글</option>
            <option value="secret">비밀글</option>
            <option value="normal">일반글</option>
          </select>
          <input type="hidden" name="pageSize" value={pageSize} />
          <button className={`${adminPrimaryButtonClass} h-11`}>검색</button>
          <Link href="/admin/boards/posts" className={`${adminSecondaryButtonClass} h-11`}>
            <RotateCcw size={17} />
            초기화
          </Link>
        </form>
      </AdminSection>

      <AdminSection
        title="게시글 등록"
        description="게시판을 선택하고 공지/비밀 옵션을 지정합니다."
      >
        <form action={saveAdminPost} className="grid gap-3">
          <input type="hidden" name="redirectTo" value={currentHref} />
          <div className="grid gap-3 md:grid-cols-[180px_1fr_90px_90px]">
            <select name="boardId" className={`${adminFieldClass} h-11`} required>
              {boards.map((board) => (
                <option key={board.id.toString()} value={board.id.toString()}>
                  {board.name} ({boardTypeLabel(board.type)})
                </option>
              ))}
            </select>
            <input name="title" placeholder="제목" className={`${adminFieldClass} h-11`} required />
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
              <input type="checkbox" name="isNotice" />
              공지
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
              <input type="checkbox" name="isSecret" />
              비밀
            </label>
          </div>
          <textarea
            name="content"
            rows={5}
            placeholder="내용"
            className={adminTextareaClass}
            required
          />
          <div className="flex justify-end">
            <button className={`${adminPrimaryButtonClass} h-11`}>등록</button>
          </div>
        </form>
      </AdminSection>

      <AdminSection
        title="게시글 목록"
        description={`현재 페이지 ${formatNumber(posts.length)}건 · ${formatNumber(page)} / 총 ${formatNumber(totalPages)}페이지`}
        bodyClassName="p-0"
        headerAction={
          <AdminPageSizeSelect
            action="/admin/boards/posts"
            name="pageSize"
            value={pageSize}
            options={PAGE_SIZE_OPTIONS}
            hiddenFields={Array.from(params.entries()).map(([name, value]) => ({ name, value }))}
          />
        }
      >
        <AdminDataGrid
          caption="게시글 목록"
          columns={[
            { key: 'no', label: '번호', align: 'right', widthClassName: 'w-20' },
            {
              key: 'title',
              label: '게시글',
              widthClassName: 'min-w-[360px]',
              priority: 'primary',
            },
            { key: 'board', label: '게시판', widthClassName: 'w-40' },
            { key: 'flag', label: '구분', widthClassName: 'w-28' },
            { key: 'author', label: '작성자', widthClassName: 'w-32' },
            { key: 'views', label: '조회', align: 'right', widthClassName: 'w-24' },
            { key: 'created', label: '작성일', align: 'right', widthClassName: 'w-32' },
          ]}
          rows={posts}
          rowKey={(post) => post.id.toString()}
          emptyText="조회된 게시글이 없습니다."
          minWidthClassName="min-w-[1120px]"
          renderRow={(post, index) => {
            const rowNo = total - (page - 1) * pageSize - index;
            return (
              <tr
                key={post.id.toString()}
                className="bg-white align-top transition hover:bg-neutral-50"
              >
                <td className={`${adminGridCellClass} text-right font-bold text-neutral-500`}>
                  {formatNumber(rowNo)}
                </td>
                <td className={adminGridStickyCellClass}>
                  <details className="group">
                    <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded px-1 font-extrabold text-neutral-950 hover:bg-neutral-50">
                      <span className="line-clamp-1">{post.title}</span>
                      <span className="shrink-0 text-[11px] font-bold text-blue-700 group-open:hidden">
                        펼치기
                      </span>
                      <span className="hidden shrink-0 text-[11px] font-bold text-neutral-500 group-open:inline">
                        접기
                      </span>
                    </summary>
                    <div className="mt-3 grid gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                      <form action={saveAdminPost} className="grid gap-2">
                        <input type="hidden" name="id" value={post.id.toString()} />
                        <input type="hidden" name="redirectTo" value={currentHref} />
                        <div className="grid gap-2 md:grid-cols-[160px_1fr_80px_80px]">
                          <select
                            name="boardId"
                            defaultValue={post.boardId.toString()}
                            className={`${adminFieldClass} h-10`}
                            aria-label={`${post.title} 게시판`}
                          >
                            {boards.map((board) => (
                              <option key={board.id.toString()} value={board.id.toString()}>
                                {board.name}
                              </option>
                            ))}
                          </select>
                          <input
                            name="title"
                            defaultValue={post.title}
                            className={`${adminFieldClass} h-10 font-bold`}
                            aria-label={`${post.title} 제목`}
                          />
                          <label className="flex min-h-10 items-center gap-2 text-sm font-bold">
                            <input type="checkbox" name="isNotice" defaultChecked={post.isNotice} />
                            공지
                          </label>
                          <label className="flex min-h-10 items-center gap-2 text-sm font-bold">
                            <input type="checkbox" name="isSecret" defaultChecked={post.isSecret} />
                            비밀
                          </label>
                        </div>
                        <textarea
                          name="content"
                          defaultValue={post.content}
                          rows={5}
                          className={adminTextareaClass}
                          aria-label={`${post.title} 내용`}
                        />
                        <div className="flex justify-end">
                          <button className={`${adminGridButtonClass} h-10 px-4`}>저장</button>
                        </div>
                      </form>
                      <form action={deleteAdminPost} className="flex justify-end">
                        <input type="hidden" name="postId" value={post.id.toString()} />
                        <input type="hidden" name="redirectTo" value={currentHref} />
                        <button className={`${adminDangerButtonClass} h-10`}>삭제</button>
                      </form>
                    </div>
                  </details>
                </td>
                <td className={adminGridCellClass}>{post.board.name}</td>
                <td className={adminGridCellClass}>{postFlagLabel(post)}</td>
                <td className={adminGridCellClass}>{post.authorName}</td>
                <td className={`${adminGridCellClass} text-right font-bold`}>
                  {formatNumber(post.viewCount)}
                </td>
                <td className={`${adminGridCellClass} text-right text-neutral-500`}>
                  {post.createdAt.toLocaleDateString('ko-KR')}
                </td>
              </tr>
            );
          }}
          renderMobileCard={(post) => (
            <AdminMobileCard>
              <details className="group">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-extrabold text-neutral-950">{post.title}</p>
                      <p className="mt-1 text-xs font-semibold text-neutral-500">
                        {post.board.name} / {post.authorName}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-600">
                      {postFlagLabel(post)}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2">
                    <AdminMobileField label="작성일">
                      {post.createdAt.toLocaleDateString('ko-KR')}
                    </AdminMobileField>
                    <AdminMobileField label="조회" align="right">
                      {formatNumber(post.viewCount)}
                    </AdminMobileField>
                  </dl>
                  <p className="mt-3 text-right text-xs font-bold text-blue-700 group-open:hidden">
                    수정 열기
                  </p>
                  <p className="mt-3 hidden text-right text-xs font-bold text-neutral-500 group-open:block">
                    수정 닫기
                  </p>
                </summary>
                <div className="mt-3 grid gap-3 border-t border-neutral-100 pt-3">
                  <form action={saveAdminPost} className="grid gap-3">
                    <input type="hidden" name="id" value={post.id.toString()} />
                    <input type="hidden" name="redirectTo" value={currentHref} />
                    <select
                      name="boardId"
                      defaultValue={post.boardId.toString()}
                      className={`${adminFieldClass} h-11`}
                      aria-label={`${post.title} 게시판`}
                    >
                      {boards.map((board) => (
                        <option key={board.id.toString()} value={board.id.toString()}>
                          {board.name}
                        </option>
                      ))}
                    </select>
                    <input
                      name="title"
                      defaultValue={post.title}
                      className={`${adminFieldClass} h-11 font-bold`}
                      aria-label={`${post.title} 제목`}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
                        <input type="checkbox" name="isNotice" defaultChecked={post.isNotice} />
                        공지
                      </label>
                      <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
                        <input type="checkbox" name="isSecret" defaultChecked={post.isSecret} />
                        비밀
                      </label>
                    </div>
                    <textarea
                      name="content"
                      defaultValue={post.content}
                      rows={6}
                      className={adminTextareaClass}
                      aria-label={`${post.title} 내용`}
                    />
                    <button className={`${adminGridButtonClass} h-11`}>저장</button>
                  </form>
                  <form action={deleteAdminPost}>
                    <input type="hidden" name="postId" value={post.id.toString()} />
                    <input type="hidden" name="redirectTo" value={currentHref} />
                    <button className={`${adminDangerButtonClass} h-11 w-full`}>삭제</button>
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
