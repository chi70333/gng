// Legacy sources: wb_admin/bbs_admin_list.php, wb_admin/bbs_admin_write.php, wb_admin/bbs_list.php, wb_admin/bbs_write.php
// Cache: no-store. Board settings, posts, and unanswered inquiries are operational data.

import type { Metadata } from 'next';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import {
  AdminDataGrid,
  AdminMobileCard,
  AdminMobileField,
  adminGridButtonClass,
  adminGridCellClass,
  adminGridInputClass,
  adminGridStickyCellClass,
} from '@/components/admin/AdminDataGrid';
import {
  compareAdminValues,
  createAdminSortHref,
  parseAdminSort,
} from '@/components/admin/admin-grid-sort';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import {
  AdminPageHeader,
  AdminSection,
  adminFieldClass,
  adminPrimaryButtonClass,
  adminTextareaClass,
} from '@/components/admin/AdminUI';
import {
  answerInquiry,
  answerProductQna,
  deleteAdminPost,
  saveAdminBoard,
  saveAdminPost,
} from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '게시판 관리',
};

const BOARD_TYPES = [
  { value: 'free', label: '일반' },
  { value: 'notice', label: '공지' },
  { value: 'event', label: '이벤트' },
  { value: 'faq', label: 'FAQ' },
];

const BOARD_SORT_KEYS = ['no', 'name', 'code', 'type', 'isActive', 'posts'] as const;

type BoardSearchParams = {
  sort?: string;
  dir?: string;
};

function boardTypeLabel(type: string): string {
  return BOARD_TYPES.find((item) => item.value === type)?.label ?? type;
}

export default async function AdminBoardsPage({
  searchParams,
}: {
  searchParams: BoardSearchParams;
}) {
  await requireAdmin('content.read');
  const [boards, posts, qnas, inquiries] = await prisma.$transaction([
    prisma.board.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { posts: true } } },
    }),
    prisma.post.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { board: { select: { name: true } } },
    }),
    prisma.productQna.findMany({
      where: { answer: null },
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { name: true } }, user: { select: { name: true } } },
    }),
    prisma.inquiry.findMany({
      where: { status: 'open' },
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, content: true, email: true, phone: true, createdAt: true },
    }),
  ]);
  const sortState = parseAdminSort(searchParams, BOARD_SORT_KEYS);
  const effectiveSort = sortState.sort ?? 'no';
  const sortedBoards = [...boards].sort((a, b) => {
    if (effectiveSort === 'no') return compareAdminValues(a.createdAt, b.createdAt, sortState.dir);
    if (effectiveSort === 'posts')
      return compareAdminValues(a._count.posts, b._count.posts, sortState.dir);
    return compareAdminValues(a[effectiveSort], b[effectiveSort], sortState.dir);
  });
  const params = new URLSearchParams();
  if (sortState.sort) {
    params.set('sort', sortState.sort);
    params.set('dir', sortState.dir);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_520px]">
      <section className="space-y-5">
        <AdminPageHeader
          title="게시판 관리"
          description="게시판 설정, 게시글 등록/수정, 상품문의와 1:1 문의 답변을 한 화면에서 처리합니다."
        />

        <AdminSection title="게시판 등록" description="게시판 코드, 유형, 사용 여부를 등록합니다.">
          <form action={saveAdminBoard}>
            <div className="mt-4 grid gap-3 md:grid-cols-[140px_1fr_120px_90px_auto]">
              <input
                name="code"
                placeholder="게시판 코드"
                className={`${adminFieldClass} h-11`}
                required
              />
              <input
                name="name"
                placeholder="게시판명"
                className={`${adminFieldClass} h-11`}
                required
              />
              <select name="type" defaultValue="free" className={`${adminFieldClass} h-11`}>
                {BOARD_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
                <input type="checkbox" name="isActive" defaultChecked />
                사용
              </label>
              <button className={`${adminPrimaryButtonClass} h-11`}>등록</button>
            </div>
          </form>
        </AdminSection>

        <AdminSection
          title="게시판 목록"
          description="행에서 바로 수정할 수 있습니다."
          bodyClassName="p-0"
        >
          <AdminDataGrid
            caption="게시판 목록"
            columns={[
              { key: 'no', label: 'No', align: 'right', widthClassName: 'w-20', sortKey: 'no' },
              {
                key: 'board',
                label: '게시판',
                widthClassName: 'min-w-[260px]',
                priority: 'primary',
                sortKey: 'name',
              },
              { key: 'code', label: '코드', widthClassName: 'w-36', sortKey: 'code' },
              { key: 'type', label: '유형', widthClassName: 'w-32', sortKey: 'type' },
              {
                key: 'status',
                label: '상태',
                align: 'center',
                widthClassName: 'w-28',
                sortKey: 'isActive',
              },
              {
                key: 'posts',
                label: '글',
                align: 'right',
                widthClassName: 'w-20',
                sortKey: 'posts',
              },
              { key: 'save', label: '수정', align: 'right', widthClassName: 'w-28' },
            ]}
            rows={sortedBoards}
            rowKey={(board) => board.id.toString()}
            emptyText="등록된 게시판이 없습니다."
            minWidthClassName="min-w-[820px]"
            currentSortKey={sortState.sort}
            currentSortDirection={sortState.dir}
            getSortHref={createAdminSortHref('/admin/boards', params)}
            className="rounded-none border-0 shadow-none"
            renderRow={(board, index) => (
              <tr
                key={board.id.toString()}
                className="bg-white align-top transition hover:bg-neutral-50"
              >
                <td className={`${adminGridCellClass} text-right font-bold text-neutral-500`}>
                  {sortedBoards.length - index}
                </td>
                <td className={adminGridStickyCellClass}>
                  <form id={`board-${board.id.toString()}`} action={saveAdminBoard}>
                    <input type="hidden" name="id" value={board.id.toString()} />
                    <input
                      name="name"
                      defaultValue={board.name}
                      className={`${adminGridInputClass} font-bold`}
                    />
                  </form>
                </td>
                <td className={adminGridCellClass}>
                  <input
                    form={`board-${board.id.toString()}`}
                    name="code"
                    defaultValue={board.code}
                    className={adminGridInputClass}
                  />
                </td>
                <td className={adminGridCellClass}>
                  <select
                    form={`board-${board.id.toString()}`}
                    name="type"
                    defaultValue={board.type}
                    className={adminGridInputClass}
                  >
                    {BOARD_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={`${adminGridCellClass} text-center`}>
                  <div className="flex flex-col items-center gap-2">
                    <AdminStatusBadge status={board.isActive ? 'active' : 'hidden'} />
                    <label className="text-xs font-bold text-neutral-500">
                      <input
                        form={`board-${board.id.toString()}`}
                        type="checkbox"
                        name="isActive"
                        defaultChecked={board.isActive}
                        className="mr-1"
                      />
                      사용
                    </label>
                  </div>
                </td>
                <td className={`${adminGridCellClass} text-right font-bold`}>
                  {board._count.posts}
                </td>
                <td className={`${adminGridCellClass} text-right`}>
                  <button form={`board-${board.id.toString()}`} className={adminGridButtonClass}>
                    저장
                  </button>
                </td>
              </tr>
            )}
            renderMobileCard={(board) => (
              <AdminMobileCard>
                <form
                  id={`board-mobile-${board.id.toString()}`}
                  action={saveAdminBoard}
                  className="grid gap-3"
                >
                  <input type="hidden" name="id" value={board.id.toString()} />
                  <input
                    name="name"
                    defaultValue={board.name}
                    className={`${adminGridInputClass} font-bold`}
                    aria-label="게시판명"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      name="code"
                      defaultValue={board.code}
                      className={adminGridInputClass}
                      aria-label="게시판 코드"
                    />
                    <select
                      name="type"
                      defaultValue={board.type}
                      className={adminGridInputClass}
                      aria-label="게시판 유형"
                    >
                      {BOARD_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <dl className="grid grid-cols-2 gap-2">
                    <AdminMobileField label="상태">
                      <AdminStatusBadge status={board.isActive ? 'active' : 'hidden'} />
                    </AdminMobileField>
                    <AdminMobileField label="글" align="right">
                      {board._count.posts}
                    </AdminMobileField>
                  </dl>
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-bold text-neutral-600">
                      <input
                        type="checkbox"
                        name="isActive"
                        defaultChecked={board.isActive}
                        className="mr-2"
                      />
                      사용
                    </label>
                    <button className={adminGridButtonClass}>저장</button>
                  </div>
                </form>
              </AdminMobileCard>
            )}
          />
        </AdminSection>

        <AdminSection title="게시글 등록" description="공지/비밀글 옵션을 함께 등록합니다.">
          <form action={saveAdminPost}>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 md:grid-cols-[180px_1fr_90px_90px]">
                <select name="boardId" className={`${adminFieldClass} h-11`} required>
                  {boards.map((board) => (
                    <option key={board.id.toString()} value={board.id.toString()}>
                      {board.name} ({boardTypeLabel(board.type)})
                    </option>
                  ))}
                </select>
                <input
                  name="title"
                  placeholder="제목"
                  className={`${adminFieldClass} h-11`}
                  required
                />
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
            </div>
          </form>
        </AdminSection>

        <AdminSection title="최근 게시글" description="최근 작성된 게시글을 바로 수정합니다.">
          <ul className="divide-y divide-neutral-100">
            {posts.length === 0 ? (
              <li className="p-4 text-sm text-neutral-500">등록된 게시글이 없습니다.</li>
            ) : (
              posts.map((post) => (
                <li key={post.id.toString()} className="p-4">
                  <form action={saveAdminPost} className="grid gap-3">
                    <input type="hidden" name="id" value={post.id.toString()} />
                    <div className="grid gap-3 md:grid-cols-[180px_1fr_90px_90px]">
                      <select
                        name="boardId"
                        defaultValue={post.boardId.toString()}
                        className={adminFieldClass}
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
                        className={`${adminFieldClass} font-bold`}
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
                      rows={3}
                      className={adminTextareaClass}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                      <span>
                        {post.board.name} / 조회 {post.viewCount} /{' '}
                        {post.createdAt.toLocaleDateString('ko-KR')}
                      </span>
                      <div className="flex gap-2">
                        <button className={adminGridButtonClass}>저장</button>
                        <button
                          formAction={deleteAdminPost}
                          name="postId"
                          value={post.id.toString()}
                          className="min-h-10 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </form>
                </li>
              ))
            )}
          </ul>
        </AdminSection>
      </section>

      <aside className="space-y-5">
        <AdminSection title="상품문의 미답변" description="상품 문의에 답변을 남깁니다.">
          <h2 className="text-base font-extrabold">미답변 상품문의</h2>
          <ul className="mt-3 divide-y divide-neutral-100">
            {qnas.length === 0 ? (
              <li className="py-3 text-sm text-neutral-500">미답변 상품문의가 없습니다.</li>
            ) : (
              qnas.map((qna) => (
                <li key={qna.id.toString()} className="py-3">
                  <p className="line-clamp-1 text-sm font-bold">{qna.title}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-neutral-500">
                    {qna.product.name} / {qna.user?.name ?? '비회원'} /{' '}
                    {qna.createdAt.toLocaleDateString('ko-KR')}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{qna.content}</p>
                  <form action={answerProductQna} className="mt-3 grid gap-2">
                    <input type="hidden" name="qnaId" value={qna.id.toString()} />
                    <textarea
                      name="answer"
                      rows={3}
                      placeholder="상품문의 답변"
                      className={adminTextareaClass}
                      required
                    />
                    <button className={adminPrimaryButtonClass}>답변 저장</button>
                  </form>
                </li>
              ))
            )}
          </ul>
        </AdminSection>

        <AdminSection title="1:1 문의 미답변" description="고객 문의에 답변을 남깁니다.">
          <h2 className="text-base font-extrabold">미답변 1:1 문의</h2>
          <ul className="mt-3 divide-y divide-neutral-100">
            {inquiries.length === 0 ? (
              <li className="py-3 text-sm text-neutral-500">미답변 1:1 문의가 없습니다.</li>
            ) : (
              inquiries.map((inquiry) => (
                <li key={inquiry.id.toString()} className="py-3">
                  <p className="line-clamp-1 text-sm font-bold">{inquiry.title}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-neutral-500">
                    {inquiry.email} / {inquiry.phone ?? '-'} /{' '}
                    {inquiry.createdAt.toLocaleDateString('ko-KR')}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{inquiry.content}</p>
                  <form action={answerInquiry} className="mt-3 grid gap-2">
                    <input type="hidden" name="inquiryId" value={inquiry.id.toString()} />
                    <textarea
                      name="answer"
                      rows={3}
                      placeholder="1:1 문의 답변"
                      className={adminTextareaClass}
                      required
                    />
                    <button className={adminPrimaryButtonClass}>답변 저장</button>
                  </form>
                </li>
              ))
            )}
          </ul>
        </AdminSection>
      </aside>
    </div>
  );
}
