// Legacy sources: wb_admin/bbs_admin_list.php, wb_admin/bbs_admin_write.php
// Cache: no-store. Board settings are operational admin data.

import type { Metadata } from 'next';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { formatNumber } from '@/lib/format';
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
} from '@/components/admin/AdminUI';
import { saveAdminBoard } from '../../actions';
import { BoardAdminNav } from './BoardAdminNav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '게시판 설정',
  description: '관리자 게시판 설정을 관리합니다.',
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

async function getBoardAdminCounts() {
  const [posts, productQna, inquiries] = await prisma.$transaction([
    prisma.post.count({ where: { deletedAt: null } }),
    prisma.productQna.count({ where: { answer: null } }),
    prisma.inquiry.count({ where: { status: 'open', deletedAt: null } }),
  ]);

  return { posts, productQna, inquiries };
}

function currentRedirectTo(searchParams: BoardSearchParams): string {
  const params = new URLSearchParams();
  if (searchParams.sort) params.set('sort', searchParams.sort);
  if (searchParams.dir) params.set('dir', searchParams.dir);
  const query = params.toString();
  return query ? `/admin/boards?${query}` : '/admin/boards';
}

export default async function AdminBoardsPage({
  searchParams,
}: {
  searchParams: BoardSearchParams;
}) {
  await requireAdmin('content.read');
  const [boards, counts] = await Promise.all([
    prisma.board.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { posts: true } } },
    }),
    getBoardAdminCounts(),
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
  const redirectTo = currentRedirectTo(searchParams);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="게시판 설정"
        description={`게시판 ${formatNumber(boards.length)}개를 관리합니다.`}
      />
      <BoardAdminNav active="settings" counts={counts} />

      <AdminSection title="게시판 등록" description="게시판 코드, 유형, 사용 여부를 등록합니다.">
        <form action={saveAdminBoard}>
          <input type="hidden" name="redirectTo" value="/admin/boards" />
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
        description="게시판 이름, 코드, 유형, 사용 여부를 행에서 바로 수정합니다."
        bodyClassName="p-0"
      >
        <AdminDataGrid
          caption="게시판 목록"
          columns={[
            { key: 'no', label: '번호', align: 'right', widthClassName: 'w-20', sortKey: 'no' },
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
            { key: 'posts', label: '글', align: 'right', widthClassName: 'w-20', sortKey: 'posts' },
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
                  <input type="hidden" name="redirectTo" value={redirectTo} />
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
              <td className={`${adminGridCellClass} text-right font-bold`}>{board._count.posts}</td>
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
                <input type="hidden" name="redirectTo" value={redirectTo} />
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
    </div>
  );
}
