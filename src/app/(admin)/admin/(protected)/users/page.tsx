// Legacy sources: wb_admin/member.php, wb_admin/member_list.php, wb_admin/member_list_excel.php
// Cache: no-store. Admin member list is private operational data.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { Coins, Download, RotateCcw, Trash2 } from 'lucide-react';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { formatNumber, formatPhone } from '@/lib/format';
import {
  AdminDataGrid,
  type AdminSortDirection,
  AdminMobileCard,
  AdminMobileField,
  adminGridCellClass,
  adminGridStickyCellClass,
} from '@/components/admin/AdminDataGrid';
import { AdminGridSelectAll } from '@/components/admin/AdminGridSelectAll';
import { AdminPageSizeSelect } from '@/components/admin/AdminPageSizeSelect';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  AdminPageHeader,
  AdminSection,
  adminDangerButtonClass,
  adminFieldClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from '@/components/admin/AdminUI';
import { adminUserListQuerySchema } from '@/schemas/admin-user';
import { bulkUpdateAdminUsers, importAdminUserMileageExcel } from '../../actions';
import { AdminUserMileageAdjustButton } from './AdminUserMileageAdjustButton';
import { AdminUserMileageUploadButton } from './AdminUserMileageUploadButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '회원 관리',
};

const DEFAULT_PAGE_SIZE = 30;
const PAGE_SIZE_OPTIONS = [20, 30, 50, 100, 200];

type AdminUsersSearchParams = {
  q?: string;
  status?: string;
  page?: string;
  deleted?: string;
  mileageUpdated?: string;
  mileageImported?: string;
  mileageSkipped?: string;
  bulkError?: string;
  sort?: string;
  dir?: string;
  pageSize?: string;
};

const USER_SORT_KEYS = [
  'no',
  'name',
  'loginId',
  'email',
  'status',
  'loginCount',
  'lastLoginAt',
  'createdAt',
] as const;
type UserSortKey = (typeof USER_SORT_KEYS)[number];

function parseUserSort(searchParams: AdminUsersSearchParams): {
  sort?: UserSortKey;
  dir: AdminSortDirection;
} {
  const sort = USER_SORT_KEYS.includes(searchParams.sort as UserSortKey)
    ? (searchParams.sort as UserSortKey)
    : undefined;
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc';
  return { sort, dir };
}

function userOrderBy(
  sort: UserSortKey,
  dir: AdminSortDirection,
): Prisma.UserOrderByWithRelationInput {
  if (sort === 'no' || sort === 'createdAt') return { createdAt: dir };
  if (sort === 'name') return { name: dir };
  if (sort === 'loginId') return { loginId: dir };
  if (sort === 'email') return { email: dir };
  if (sort === 'status') return { status: dir };
  if (sort === 'loginCount') return { loginCount: dir };
  if (sort === 'lastLoginAt') return { lastLoginAt: dir };
  return { createdAt: dir };
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: '정상',
    dormant: '휴면',
    withdrawn: '탈퇴',
    blocked: '차단',
  };
  return labels[status] ?? status;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: AdminUsersSearchParams;
}) {
  await requireAdmin('user.read');
  const query = adminUserListQuerySchema.parse(searchParams);
  const pageSize = PAGE_SIZE_OPTIONS.includes(query.pageSize) ? query.pageSize : DEFAULT_PAGE_SIZE;
  const sortState = parseUserSort(searchParams);
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { loginId: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
            { name: { contains: query.q, mode: 'insensitive' } },
            { phone: { contains: query.q } },
          ],
        }
      : {}),
  };

  // Count(*) is expensive on large member tables, so fetch one extra row to detect next page.
  const usersWithExtra = await prisma.user.findMany({
    where,
    orderBy: userOrderBy(sortState.sort ?? 'no', sortState.dir),
    skip: (query.page - 1) * pageSize,
    take: pageSize + 1,
    select: {
      id: true,
      loginId: true,
      email: true,
      name: true,
      phone: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      loginCount: true,
      grade: { select: { name: true } },
      pointHistories: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { balance: true },
      },
      _count: { select: { orders: true } },
    },
  });
  const hasNext = usersWithExtra.length > pageSize;
  const users = usersWithExtra.slice(0, pageSize);
  const visibleResultCount = (query.page - 1) * pageSize + users.length;

  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.status) params.set('status', query.status);
  params.set('pageSize', String(pageSize));
  if (sortState.sort) {
    params.set('sort', sortState.sort);
    params.set('dir', sortState.dir);
  }
  const baseHref = `/admin/users${params.toString() ? `?${params.toString()}` : ''}`;
  const currentParams = new URLSearchParams(params);
  if (query.page > 1) currentParams.set('page', String(query.page));
  const currentHref = `/admin/users${currentParams.toString() ? `?${currentParams.toString()}` : ''}`;
  const exportHref = `/api/admin/users/export${params.toString() ? `?${params.toString()}` : ''}`;
  const mileageChanged =
    Number(searchParams.mileageUpdated ?? searchParams.mileageImported ?? 0) || 0;
  const mileageSkipped = Number(searchParams.mileageSkipped ?? 0) || 0;
  const deleted = Number(searchParams.deleted ?? 0) || 0;
  const bulkError = searchParams.bulkError?.trim() ?? '';
  const getSortHref = (sort: string, dir: AdminSortDirection) => {
    const nextParams = new URLSearchParams(params);
    if (nextParams.get('sort') === sort) {
      nextParams.delete('sort');
      nextParams.delete('dir');
    } else {
      nextParams.set('sort', sort);
      nextParams.set('dir', dir);
    }
    nextParams.delete('page');
    const nextQuery = nextParams.toString();
    return nextQuery ? `/admin/users?${nextQuery}` : '/admin/users';
  };

  return (
    <div className="w-full space-y-4">
      <AdminPageHeader
        title="회원 관리"
        description={`최신순으로 ${formatNumber(visibleResultCount)}명까지 조회했습니다.`}
        actions={
          <>
            <AdminUserMileageUploadButton
              action={importAdminUserMileageExcel}
              redirectTo={currentHref}
            />
            <Link href={exportHref} className={`${adminSecondaryButtonClass} h-11`}>
              <Download size={18} />
              엑셀 다운로드
            </Link>
          </>
        }
      />

      <form className="grid gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.045)] ring-1 ring-white md:grid-cols-[1fr_160px_auto]">
        <input
          name="q"
          defaultValue={query.q}
          placeholder="이름, 아이디, 이메일, 전화번호"
          className={`${adminFieldClass} h-11`}
        />
        <select
          name="status"
          defaultValue={query.status ?? ''}
          className={`${adminFieldClass} h-11`}
        >
          <option value="">전체 상태</option>
          <option value="active">정상</option>
          <option value="dormant">휴면</option>
          <option value="withdrawn">탈퇴</option>
          <option value="blocked">차단</option>
        </select>
        <button className={`${adminPrimaryButtonClass} h-11`}>검색</button>
      </form>

      {mileageChanged > 0 || mileageSkipped > 0 || deleted > 0 ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {mileageChanged > 0 ? `마일리지 반영 ${formatNumber(mileageChanged)}건` : null}
          {mileageChanged > 0 && mileageSkipped > 0 ? ', ' : null}
          {mileageSkipped > 0 ? `건너뜀 ${formatNumber(mileageSkipped)}건` : null}
          {deleted > 0 ? `선택 삭제 ${formatNumber(deleted)}건` : null}
        </div>
      ) : null}

      {bulkError ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {bulkError}
        </div>
      ) : null}

      <form
        id="bulkUserActionForm"
        action={bulkUpdateAdminUsers}
        className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-xs shadow-[0_8px_24px_rgba(15,23,42,0.045)] ring-1 ring-white"
      >
        <input type="hidden" name="redirectTo" value={currentHref} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="font-bold text-neutral-700">선택 회원 마일리지</span>
            <span className="mt-1 block text-neutral-500">
              선택한 회원의 마일리지를 0으로 초기화하거나 같은 금액을 일괄 부여합니다.
            </span>
          </div>
          <span className="mt-1 block text-neutral-500">
            주문 이력은 보존하고 회원 개인정보와 개인 상태 데이터는 익명화/삭제합니다.
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-[160px_minmax(220px,1fr)_auto_auto_auto]">
          <input
            name="bulkMileageAmount"
            type="number"
            min="1"
            max="10000000"
            placeholder="부여 마일리지"
            className={`${adminFieldClass} h-11`}
          />
          <input
            name="bulkMileageReason"
            defaultValue="관리자 마일리지 일괄 처리"
            placeholder="처리 사유"
            className={`${adminFieldClass} h-11`}
          />
          <button name="intent" value="mileage-grant" className={`${adminPrimaryButtonClass} h-11`}>
            <Coins size={17} />
            일괄 부여
          </button>
          <button
            name="intent"
            value="mileage-reset"
            className={`${adminSecondaryButtonClass} h-11`}
          >
            <RotateCcw size={17} />
            일괄 초기화
          </button>
          <button name="intent" value="delete" className={`${adminDangerButtonClass} h-11`}>
            <Trash2 size={17} />
            선택 삭제
          </button>
        </div>
      </form>

      <AdminSection
        title="회원 목록"
        description={`현재 페이지 ${formatNumber(users.length)}명`}
        bodyClassName="p-0"
      >
        <AdminDataGrid
          caption="회원 목록"
          columns={[
            { key: 'no', label: 'No', align: 'right', widthClassName: 'w-20', sortKey: 'no' },
            {
              key: 'select',
              label: <AdminGridSelectAll name="userId" formId="bulkUserActionForm" />,
              align: 'center',
              widthClassName: 'w-16',
            },
            {
              key: 'name',
              label: '이름',
              widthClassName: 'min-w-[180px]',
              priority: 'primary',
              sortKey: 'name',
            },
            { key: 'loginId', label: '아이디', widthClassName: 'w-44', sortKey: 'loginId' },
            { key: 'email', label: '이메일', widthClassName: 'w-64', sortKey: 'email' },
            { key: 'phone', label: '휴대전화', widthClassName: 'w-40' },
            { key: 'status', label: '상태', widthClassName: 'w-28', sortKey: 'status' },
            { key: 'grade', label: '등급', widthClassName: 'w-32' },
            { key: 'mileage', label: '마일리지', align: 'right', widthClassName: 'w-48' },
            { key: 'orders', label: '주문', align: 'right', widthClassName: 'w-24' },
            {
              key: 'loginCount',
              label: '로그인수',
              align: 'right',
              widthClassName: 'w-28',
              sortKey: 'loginCount',
            },
            {
              key: 'lastLoginAt',
              label: '최근 로그인',
              align: 'right',
              widthClassName: 'w-36',
              sortKey: 'lastLoginAt',
            },
            {
              key: 'created',
              label: '가입일',
              align: 'right',
              widthClassName: 'w-32',
              sortKey: 'createdAt',
            },
          ]}
          rows={users}
          rowKey={(user) => user.id.toString()}
          emptyText="조회된 회원이 없습니다."
          minWidthClassName="min-w-[1260px]"
          toolbarEnd={
            <AdminPageSizeSelect
              action="/admin/users"
              name="pageSize"
              value={pageSize}
              options={PAGE_SIZE_OPTIONS}
              hiddenFields={Array.from(params.entries()).map(([name, value]) => ({ name, value }))}
            />
          }
          currentSortKey={sortState.sort}
          currentSortDirection={sortState.dir}
          getSortHref={getSortHref}
          renderRow={(user, index) => {
            const rowNo = visibleResultCount - index;
            return (
              <tr key={user.id.toString()} className="bg-white transition hover:bg-neutral-50">
                <td className={`${adminGridCellClass} text-right font-bold text-neutral-500`}>
                  {formatNumber(rowNo)}
                </td>
                <td className={`${adminGridCellClass} text-center`}>
                  <input
                    form="bulkUserActionForm"
                    type="checkbox"
                    name="userId"
                    value={user.id.toString()}
                    aria-label={`${user.name} 선택`}
                    className="h-4 w-4 rounded border-neutral-300 accent-neutral-900"
                  />
                </td>
                <td className={adminGridStickyCellClass}>
                  <Link
                    href={`/admin/users/${user.id.toString()}`}
                    className="font-extrabold text-neutral-950 hover:text-blue-700 hover:underline"
                  >
                    {user.name}
                  </Link>
                </td>
                <td
                  className={`${adminGridCellClass} break-all font-mono text-xs font-semibold text-neutral-600`}
                >
                  {user.loginId ?? '-'}
                </td>
                <td className={`${adminGridCellClass} break-all text-xs`}>{user.email}</td>
                <td className={`${adminGridCellClass} whitespace-nowrap font-mono text-xs`}>
                  {formatPhone(user.phone)}
                </td>
                <td className={adminGridCellClass}>
                  <AdminStatusBadge status={user.status} />
                  <span className="sr-only">{statusLabel(user.status)}</span>
                </td>
                <td className={adminGridCellClass}>{user.grade?.name ?? '등급 없음'}</td>
                <td className={`${adminGridCellClass} text-right font-bold`}>
                  <AdminUserMileageAdjustButton
                    userId={user.id.toString()}
                    userName={user.name}
                    initialBalance={user.pointHistories[0]?.balance ?? 0}
                  />
                </td>
                <td className={`${adminGridCellClass} text-right font-bold text-neutral-800`}>
                  {formatNumber(user._count.orders)}
                </td>
                <td className={`${adminGridCellClass} text-right font-bold text-neutral-800`}>
                  {formatNumber(user.loginCount)}
                </td>
                <td className={`${adminGridCellClass} text-right text-neutral-500`}>
                  {user.lastLoginAt?.toLocaleDateString('ko-KR') ?? '이력 없음'}
                </td>
                <td className={`${adminGridCellClass} text-right text-neutral-500`}>
                  {user.createdAt.toLocaleDateString('ko-KR')}
                </td>
              </tr>
            );
          }}
          renderMobileCard={(user) => (
            <AdminMobileCard>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/admin/users/${user.id.toString()}`}
                    className="font-extrabold text-neutral-950"
                  >
                    {user.name}
                  </Link>
                  <p className="mt-1 break-all font-mono text-xs font-semibold text-neutral-500">
                    {user.loginId ?? '-'} / {user.email}
                  </p>
                </div>
                <input
                  form="bulkUserActionForm"
                  type="checkbox"
                  name="userId"
                  value={user.id.toString()}
                  aria-label={`${user.name} 선택`}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-neutral-300 accent-neutral-900"
                />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2">
                <AdminMobileField label="상태">
                  <AdminStatusBadge status={user.status} />
                  <span className="sr-only">{statusLabel(user.status)}</span>
                </AdminMobileField>
                <AdminMobileField label="등급">{user.grade?.name ?? '등급 없음'}</AdminMobileField>
                <AdminMobileField label="연락처">{formatPhone(user.phone)}</AdminMobileField>
                <AdminMobileField label="주문" align="right">
                  {formatNumber(user._count.orders)}
                </AdminMobileField>
                <AdminMobileField label="로그인" align="right">
                  {formatNumber(user.loginCount)}
                </AdminMobileField>
                <AdminMobileField label="가입일" align="right">
                  {user.createdAt.toLocaleDateString('ko-KR')}
                </AdminMobileField>
              </dl>
              <div className="mt-3 rounded-md border border-neutral-100 bg-neutral-50 p-3 text-right">
                <p className="mb-2 text-left text-[11px] font-extrabold text-neutral-500">
                  마일리지
                </p>
                <AdminUserMileageAdjustButton
                  userId={user.id.toString()}
                  userName={user.name}
                  initialBalance={user.pointHistories[0]?.balance ?? 0}
                />
              </div>
            </AdminMobileCard>
          )}
        />
      </AdminSection>
      <AdminPagination baseHref={baseHref} page={query.page} hasNext={hasNext} />
    </div>
  );
}
