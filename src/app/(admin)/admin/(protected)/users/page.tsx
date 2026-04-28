// Legacy sources: wb_admin/member.php, wb_admin/member_list.php, wb_admin/member_list_excel.php
// Cache: no-store. Admin member list is private operational data.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { Coins, Download, RotateCcw, Trash2, Upload } from 'lucide-react';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { formatNumber, formatPhone } from '@/lib/format';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { adminUserListQuerySchema } from '@/schemas/admin-user';
import { bulkUpdateAdminUsers, importAdminUserMileageExcel } from '../../actions';
import { AdminUserMileageAdjustButton } from './AdminUserMileageAdjustButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '회원 관리',
};

const PAGE_SIZE = 30;

type AdminUsersSearchParams = {
  q?: string;
  status?: string;
  page?: string;
  deleted?: string;
  mileageUpdated?: string;
  mileageImported?: string;
  mileageSkipped?: string;
};

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
    orderBy: { createdAt: 'desc' },
    skip: (query.page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
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
  const hasNext = usersWithExtra.length > PAGE_SIZE;
  const users = usersWithExtra.slice(0, PAGE_SIZE);
  const visibleResultCount = (query.page - 1) * PAGE_SIZE + users.length;

  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.status) params.set('status', query.status);
  const baseHref = `/admin/users${params.toString() ? `?${params.toString()}` : ''}`;
  const currentParams = new URLSearchParams(params);
  if (query.page > 1) currentParams.set('page', String(query.page));
  const currentHref = `/admin/users${currentParams.toString() ? `?${currentParams.toString()}` : ''}`;
  const exportHref = `/api/admin/users/export${params.toString() ? `?${params.toString()}` : ''}`;
  const mileageChanged = Number(searchParams.mileageUpdated ?? searchParams.mileageImported ?? 0) || 0;
  const mileageSkipped = Number(searchParams.mileageSkipped ?? 0) || 0;
  const deleted = Number(searchParams.deleted ?? 0) || 0;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-neutral-950">회원 관리</h1>
          <p className="mt-1 text-sm text-neutral-500">
            최신순으로 {formatNumber(visibleResultCount)}명까지 조회했습니다.
          </p>
        </div>
        <Link
          href={exportHref}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-800 hover:bg-neutral-50"
        >
          <Download size={18} />
          엑셀 다운로드
        </Link>
      </div>

      <form className="mt-5 grid gap-2 rounded-lg border border-neutral-200 bg-white p-3 md:grid-cols-[1fr_160px_auto]">
        <input
          name="q"
          defaultValue={query.q}
          placeholder="이름, 아이디, 이메일, 전화번호"
          className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm"
        />
        <select
          name="status"
          defaultValue={query.status ?? ''}
          className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm"
        >
          <option value="">전체 상태</option>
          <option value="active">정상</option>
          <option value="dormant">휴면</option>
          <option value="withdrawn">탈퇴</option>
          <option value="blocked">차단</option>
        </select>
        <button className="min-h-11 rounded-md bg-neutral-900 px-4 text-sm font-bold text-white">
          검색
        </button>
      </form>

      {mileageChanged > 0 || mileageSkipped > 0 || deleted > 0 ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {mileageChanged > 0 ? `마일리지 반영 ${formatNumber(mileageChanged)}건` : null}
          {mileageChanged > 0 && mileageSkipped > 0 ? ', ' : null}
          {mileageSkipped > 0 ? `건너뜀 ${formatNumber(mileageSkipped)}건` : null}
          {deleted > 0 ? `선택 삭제 ${formatNumber(deleted)}건` : null}
        </div>
      ) : null}

      <form
        id="bulkUserActionForm"
        action={bulkUpdateAdminUsers}
        className="mt-5 grid gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-xs shadow-sm"
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
            className="min-h-11 rounded-md border border-neutral-300 px-3 text-sm font-medium text-neutral-950"
          />
          <input
            name="bulkMileageReason"
            defaultValue="관리자 마일리지 일괄 처리"
            placeholder="처리 사유"
            className="min-h-11 rounded-md border border-neutral-300 px-3 text-sm font-medium text-neutral-950"
          />
          <button
            name="intent"
            value="mileage-grant"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 text-sm font-bold text-white hover:bg-neutral-800"
          >
            <Coins size={17} />
            일괄 부여
          </button>
          <button
            name="intent"
            value="mileage-reset"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-800 hover:bg-neutral-50"
          >
            <RotateCcw size={17} />
            일괄 초기화
          </button>
          <button
            name="intent"
            value="delete"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 hover:bg-red-100"
          >
            <Trash2 size={17} />
            선택 삭제
          </button>
        </div>
      </form>

      <details className="mt-3 rounded-lg border border-neutral-200 bg-white shadow-sm">
        <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 text-sm font-extrabold text-neutral-950">
          마일리지 엑셀 업로드
          <span className="text-xs font-semibold text-neutral-500">.xlsx, .xls, .csv 지원</span>
        </summary>
        <form
          action={importAdminUserMileageExcel}
          className="grid gap-3 border-t border-neutral-100 p-4 lg:grid-cols-[minmax(260px,1fr)_auto]"
        >
          <input type="hidden" name="redirectTo" value={currentHref} />
          <p className="text-sm text-neutral-500">
            회원ID, 아이디, 이메일 중 하나와 마일리지, 처리방식을 입력한 파일을 업로드합니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/api/admin/users/mileage-template"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-800 hover:bg-neutral-50"
            >
              <Download size={18} />
              양식 다운로드
            </Link>
            <input
              type="file"
              name="mileageFile"
              accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              required
              className="min-h-11 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm sm:w-80"
            />
            <button className="inline-flex min-h-11 items-center gap-2 rounded-md bg-neutral-900 px-4 text-sm font-bold text-white hover:bg-neutral-800">
              <Upload size={18} />
              업로드
            </button>
          </div>
        </form>
      </details>

      <div className="mt-3 w-full overflow-x-auto rounded-md border border-neutral-300 bg-white">
        <table className="w-full min-w-[1520px] table-fixed border-collapse text-[13px]">
          <thead>
            <tr className="bg-neutral-100 text-left text-xs font-bold text-neutral-700">
              <th className="w-12 border border-neutral-300 px-3 py-2 text-center">선택</th>
              <th className="w-32 border border-neutral-300 px-3 py-2">이름</th>
              <th className="w-36 border border-neutral-300 px-3 py-2">아이디</th>
              <th className="w-64 border border-neutral-300 px-3 py-2">이메일</th>
              <th className="w-36 border border-neutral-300 px-3 py-2">휴대전화</th>
              <th className="w-24 border border-neutral-300 px-3 py-2">상태</th>
              <th className="w-32 border border-neutral-300 px-3 py-2">등급</th>
              <th className="w-44 border border-neutral-300 px-3 py-2 text-right">마일리지</th>
              <th className="w-20 border border-neutral-300 px-3 py-2 text-right">주문수</th>
              <th className="w-24 border border-neutral-300 px-3 py-2 text-right">로그인수</th>
              <th className="w-32 border border-neutral-300 px-3 py-2 text-right">최근 로그인</th>
              <th className="w-32 border border-neutral-300 px-3 py-2 text-right">가입일</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={12} className="h-24 border border-neutral-200 px-4 text-center text-neutral-500">
                  조회된 회원이 없습니다.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id.toString()} className="hover:bg-neutral-50">
                  <td className="border border-neutral-200 px-3 py-2 text-center align-middle">
                    <input
                      form="bulkUserActionForm"
                      type="checkbox"
                      name="userId"
                      value={user.id.toString()}
                      aria-label={`${user.name} 선택`}
                      className="h-4 w-4 rounded border-neutral-300"
                    />
                  </td>
                  <td className="truncate border border-neutral-200 px-3 py-2 align-middle">
                    <Link
                      href={`/admin/users/${user.id.toString()}`}
                      className="font-extrabold text-neutral-950 hover:underline"
                    >
                      {user.name}
                    </Link>
                  </td>
                  <td className="break-all border border-neutral-200 px-3 py-2 align-middle font-mono text-xs text-neutral-700">
                    {user.loginId ?? '-'}
                  </td>
                  <td className="break-all border border-neutral-200 px-3 py-2 align-middle text-xs text-neutral-700">
                    {user.email}
                  </td>
                  <td className="whitespace-nowrap border border-neutral-200 px-3 py-2 align-middle font-mono text-xs text-neutral-700">
                    {formatPhone(user.phone)}
                  </td>
                  <td className="border border-neutral-200 px-3 py-2 align-middle">
                    <AdminStatusBadge status={user.status} />
                    <span className="sr-only">{statusLabel(user.status)}</span>
                  </td>
                  <td className="border border-neutral-200 px-3 py-2 align-middle text-neutral-600">
                    {user.grade?.name ?? '-'}
                  </td>
                  <td className="border border-neutral-200 px-3 py-2 text-right align-middle font-bold">
                    <AdminUserMileageAdjustButton
                      userId={user.id.toString()}
                      userName={user.name}
                      initialBalance={user.pointHistories[0]?.balance ?? 0}
                    />
                  </td>
                  <td className="border border-neutral-200 px-3 py-2 text-right align-middle text-neutral-600">
                    {formatNumber(user._count.orders)}
                  </td>
                  <td className="border border-neutral-200 px-3 py-2 text-right align-middle text-neutral-600">
                    {formatNumber(user.loginCount)}
                  </td>
                  <td className="border border-neutral-200 px-3 py-2 text-right align-middle text-neutral-500">
                    {user.lastLoginAt?.toLocaleDateString('ko-KR') ?? '이력 없음'}
                  </td>
                  <td className="border border-neutral-200 px-3 py-2 text-right align-middle text-neutral-500">
                    {user.createdAt.toLocaleDateString('ko-KR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <AdminPagination baseHref={baseHref} page={query.page} hasNext={hasNext} />
    </div>
  );
}
