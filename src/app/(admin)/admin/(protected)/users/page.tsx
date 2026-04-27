// Legacy sources: wb_admin/member.php, wb_admin/member_list.php, wb_admin/member_list_excel.php
// Cache: no-store. Admin member list is private operational data.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { Download, Trash2 } from 'lucide-react';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { formatNumber } from '@/lib/format';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { adminUserListQuerySchema } from '@/schemas/admin-user';
import { bulkDeleteAdminUsers } from '../../actions';
import { AdminUserMileageAdjustButton } from './AdminUserMileageAdjustButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '회원 관리',
};

const PAGE_SIZE = 30;

function maskPhone(phone: string | null): string {
  if (!phone) return '-';
  return phone.replace(/(\d{3})\d+(\d{4})/, '$1****$2');
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
  searchParams: { q?: string; status?: string; page?: string };
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
  const exportHref = `/api/admin/users/export${params.toString() ? `?${params.toString()}` : ''}`;

  return (
    <div>
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

      <form
        id="bulkUserDeleteForm"
        action={bulkDeleteAdminUsers}
        className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-xs"
      >
        <div>
          <span className="font-bold text-neutral-700">선택 회원</span>
          <span className="mt-1 block text-neutral-500">
            주문 이력은 보존하고 회원 개인정보와 개인 상태 데이터는 익명화/삭제합니다.
          </span>
        </div>
        <button
          name="intent"
          value="delete"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 font-bold text-red-700 hover:bg-red-100"
        >
          <Trash2 size={16} />
          그리드 삭제
        </button>
      </form>

      <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="min-w-[1060px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
              <th className="w-12 px-4 py-3 text-center">선택</th>
              <th className="px-4 py-3">회원 정보</th>
              <th className="w-28 px-4 py-3">상태</th>
              <th className="w-32 px-4 py-3">등급</th>
              <th className="w-40 px-4 py-3 text-right">마일리지</th>
              <th className="w-24 px-4 py-3 text-right">주문수</th>
              <th className="w-28 px-4 py-3 text-right">로그인</th>
              <th className="w-32 px-4 py-3 text-right">가입일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={8} className="h-24 px-4 text-center text-neutral-500">
                  조회된 회원이 없습니다.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id.toString()} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-center">
                    <input
                      form="bulkUserDeleteForm"
                      type="checkbox"
                      name="userId"
                      value={user.id.toString()}
                      aria-label={`${user.name} 선택`}
                      className="h-4 w-4 rounded border-neutral-300"
                    />
                  </td>
                  <td className="min-w-0 px-4 py-3">
                    <Link
                      href={`/admin/users/${user.id.toString()}`}
                      className="font-extrabold text-neutral-950 hover:underline"
                    >
                      {user.name}
                    </Link>
                    <p className="mt-1 break-all text-xs text-neutral-500">
                      {user.loginId ?? '-'} / {user.email}
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">{maskPhone(user.phone)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={user.status} />
                    <span className="sr-only">{statusLabel(user.status)}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{user.grade?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-right font-bold">
                    <AdminUserMileageAdjustButton
                      userId={user.id.toString()}
                      userName={user.name}
                      initialBalance={user.pointHistories[0]?.balance ?? 0}
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-600">
                    {formatNumber(user._count.orders)}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-500">
                    {formatNumber(user.loginCount)}
                    <span className="mt-1 block text-xs">
                      {user.lastLoginAt?.toLocaleDateString('ko-KR') ?? '이력 없음'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-500">
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
