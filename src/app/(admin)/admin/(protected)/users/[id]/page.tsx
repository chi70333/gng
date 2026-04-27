// Legacy sources: wb_admin/member.php, wb_admin/member_point.php, wb_admin/member_trade.php
// Cache: no-store. Member detail is private operational data.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { formatKRW } from '@/lib/format';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import { recordAdminUserMessage, updateAdminUserStatus } from '../../../actions';
import { AdminUserPointsClient } from './AdminUserPointsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '회원 상세',
};

function maskPhone(phone: string | null): string {
  if (!phone) return '-';
  return phone.replace(/(\d{3})\d+(\d{4})/, '$1****$2');
}

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin('user.read');
  const id = BigInt(params.id);
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      grade: { select: { name: true, code: true } },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { orderNo: true, status: true, total: true, createdAt: true },
      },
      pointHistories: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      couponIssues: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { coupon: { select: { name: true, code: true } } },
      },
    },
  });

  if (!user) notFound();
  const pointBalance = user.pointHistories[0]?.balance ?? 0;
  const pointRows = user.pointHistories.map((point) => ({
    id: point.id.toString(),
    delta: point.delta,
    balance: point.balance,
    reason: point.reason,
    createdAt: point.createdAt.toISOString(),
  }));

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="space-y-5">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-extrabold text-neutral-950">{user.name}</h1>
              <p className="mt-1 break-all text-sm text-neutral-500">
                {user.loginId ?? '-'} / {user.email}
              </p>
              <p className="mt-1 text-sm text-neutral-500">{maskPhone(user.phone)}</p>
            </div>
            <AdminStatusBadge status={user.status} />
          </div>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <div>
              <dt className="text-neutral-500">회원등급</dt>
              <dd className="mt-1 font-bold">{user.grade?.name ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">가입일</dt>
              <dd className="mt-1 font-bold">{user.createdAt.toLocaleDateString('ko-KR')}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">최근 로그인</dt>
              <dd className="mt-1 font-bold">
                {user.lastLoginAt?.toLocaleString('ko-KR') ?? '이력 없음'}
              </dd>
            </div>
          </dl>
        </div>

        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-base font-extrabold">최근 주문</h2>
          <ul className="mt-3 divide-y divide-neutral-100">
            {user.orders.length === 0 ? (
              <li className="py-3 text-sm text-neutral-500">주문 이력이 없습니다.</li>
            ) : (
              user.orders.map((order) => (
                <li key={order.orderNo} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-bold">{order.orderNo}</p>
                    <p className="text-xs text-neutral-500">
                      {order.createdAt.toLocaleDateString('ko-KR')} / {order.status}
                    </p>
                  </div>
                  <p className="text-sm font-extrabold">{formatKRW(order.total.toString())}</p>
                </li>
              ))
            )}
          </ul>
        </section>

        <AdminUserPointsClient
          userId={user.id.toString()}
          initialBalance={pointBalance}
          initialPoints={pointRows}
        />
      </section>

      <aside className="space-y-5">
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-base font-extrabold">회원 상태</h2>
          <form action={updateAdminUserStatus} className="mt-3 space-y-3">
            <input type="hidden" name="userId" value={user.id.toString()} />
            <select
              name="status"
              defaultValue={user.status}
              className="min-h-11 w-full rounded-md border border-neutral-200 px-3"
            >
              <option value="active">정상</option>
              <option value="dormant">휴면</option>
              <option value="withdrawn">탈퇴</option>
              <option value="blocked">차단</option>
            </select>
            <button className="min-h-11 w-full rounded-md bg-neutral-900 text-sm font-bold text-white">
              상태 저장
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-base font-extrabold">메일/SMS 발송 요청</h2>
          <p className="mt-1 text-sm text-neutral-500">
            실제 발송 공급자 연결 전까지 요청 내용은 감사 로그로 기록합니다.
          </p>
          <form action={recordAdminUserMessage} className="mt-3 space-y-3">
            <input type="hidden" name="userId" value={user.id.toString()} />
            <select
              name="channel"
              defaultValue="sms"
              className="min-h-11 w-full rounded-md border border-neutral-200 px-3"
            >
              <option value="sms">SMS</option>
              <option value="email">메일</option>
            </select>
            <input
              name="subject"
              placeholder="메일 제목"
              className="min-h-11 w-full rounded-md border border-neutral-200 px-3"
            />
            <textarea
              name="content"
              rows={4}
              placeholder="발송 내용"
              className="w-full rounded-md border border-neutral-200 px-3 py-2"
              required
            />
            <button className="min-h-11 w-full rounded-md bg-neutral-900 text-sm font-bold text-white">
              요청 기록
            </button>
          </form>
        </section>
      </aside>
    </div>
  );
}
