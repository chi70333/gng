// Legacy sources: wb_admin/member.php, wb_admin/member_point.php, wb_admin/member_trade.php
// Cache: no-store. Member detail is private operational data.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Coins,
  Mail,
  MessageSquareText,
  PackageCheck,
  Save,
  ShieldCheck,
  TicketPercent,
  UserRound,
} from 'lucide-react';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { formatKRW, formatNumber } from '@/lib/format';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import { recordAdminUserMessage, updateAdminUserStatus } from '../../../actions';
import { AdminUserPointsClient } from './AdminUserPointsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '회원 상세',
};

function displayPhone(value: string | null): string {
  if (!value) return '-';
  const digits = value.replace(/[^0-9]/g, '');

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return value;
}

function formatDate(value: Date | null): string {
  return value ? value.toLocaleDateString('ko-KR') : '이력 없음';
}

function formatDateTime(value: Date | null): string {
  return value ? value.toLocaleString('ko-KR') : '이력 없음';
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: '정상',
    dormant: '휴면',
    withdrawn: '탈퇴',
    blocked: '차단',
    pending: '주문접수',
    paid: '결제완료',
    preparing: '상품준비중',
    shipping: '배송중',
    delivered: '배송완료',
    cancelled: '주문취소',
    refunded: '환불',
  };
  return labels[status] ?? status;
}

function memberTypeLabel(memberType: string): string {
  const labels: Record<string, string> = {
    M: '개인회원',
    A: '관리회원',
    D: '도매회원',
    B: '사업자회원',
    E: '임직원',
    W: '대기회원',
  };
  return labels[memberType] ?? memberType;
}

function agreementLabel(value: Date | null): string {
  return value ? `동의 (${value.toLocaleDateString('ko-KR')})` : '미동의';
}

function InfoRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="grid gap-1 rounded-md bg-neutral-50 px-3 py-2">
      <dt className="text-xs font-bold text-neutral-500">{label}</dt>
      <dd
        className={`min-h-5 break-all text-sm ${strong ? 'font-extrabold text-neutral-950' : 'font-medium text-neutral-800'}`}
      >
        {value}
      </dd>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; size?: number | string }>;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-neutral-500">{label}</p>
        <Icon className="text-neutral-300" size={22} />
      </div>
      <p className="mt-3 text-2xl font-extrabold text-neutral-950">{value}</p>
    </div>
  );
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
      _count: { select: { orders: true, couponIssues: true } },
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/admin/users"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 text-sm font-bold text-neutral-700 shadow-sm hover:bg-neutral-50"
          >
            <ArrowLeft size={16} />
            회원 목록
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="break-all text-2xl font-extrabold text-neutral-950">{user.name}</h1>
            <AdminStatusBadge status={user.status} />
          </div>
          <p className="mt-1 break-all text-sm text-neutral-500">
            {user.loginId ?? '아이디 없음'} / {user.email} / {displayPhone(user.phone)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="마일리지" value={`${formatNumber(pointBalance)} P`} icon={Coins} />
        <StatCard
          label="전체 주문"
          value={`${formatNumber(user._count.orders)}건`}
          icon={PackageCheck}
        />
        <StatCard
          label="보유 쿠폰"
          value={`${formatNumber(user._count.couponIssues)}장`}
          icon={TicketPercent}
        />
        <StatCard
          label="로그인 횟수"
          value={`${formatNumber(user.loginCount)}회`}
          icon={ShieldCheck}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-5">
          <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
              <UserRound className="text-neutral-300" size={20} />
              <h2 className="text-base font-extrabold text-neutral-950">회원 기본 정보</h2>
            </div>
            <dl className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              <InfoRow label="회원명" value={user.name} strong />
              <InfoRow label="아이디" value={user.loginId ?? '-'} />
              <InfoRow label="이메일" value={user.email} />
              <InfoRow label="연락처" value={displayPhone(user.phone)} />
              <InfoRow label="회원등급" value={user.grade?.name ?? '-'} strong />
              <InfoRow label="회원 유형" value={memberTypeLabel(user.memberType)} />
              <InfoRow label="가입일" value={formatDate(user.createdAt)} />
              <InfoRow label="최근 로그인" value={formatDateTime(user.lastLoginAt)} />
              <InfoRow label="마케팅 수신" value={agreementLabel(user.marketingAgreedAt)} />
              <InfoRow label="SMS 수신" value={agreementLabel(user.smsAgreedAt)} />
              <InfoRow label="최근 로그인 IP" value={user.lastLoginIp ?? '-'} />
              <InfoRow label="상태" value={statusLabel(user.status)} strong />
            </dl>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
              <div>
                <h2 className="text-base font-extrabold text-neutral-950">최근 주문</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  전체 {formatNumber(user._count.orders)}건 중 최근 10건
                </p>
              </div>
              <PackageCheck className="text-neutral-300" size={22} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-neutral-50 text-xs text-neutral-500">
                  <tr>
                    <th className="px-4 py-3 text-left">주문번호</th>
                    <th className="px-4 py-3 text-left">주문일</th>
                    <th className="px-4 py-3 text-left">상태</th>
                    <th className="px-4 py-3 text-right">결제금액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {user.orders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="h-24 px-4 text-center text-neutral-500">
                        주문 이력이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    user.orders.map((order) => (
                      <tr key={order.orderNo} className="hover:bg-neutral-50">
                        <td className="px-4 py-3 font-extrabold text-blue-700">
                          <Link href={`/admin/orders/${order.orderNo}`}>{order.orderNo}</Link>
                        </td>
                        <td className="px-4 py-3 text-neutral-600">
                          {order.createdAt.toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-4 py-3">
                          <AdminStatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold">
                          {formatKRW(order.total.toString())}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <AdminUserPointsClient
            userId={user.id.toString()}
            initialBalance={pointBalance}
            initialPoints={pointRows}
          />
        </section>

        <aside className="space-y-5">
          <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
              <ShieldCheck className="text-neutral-300" size={20} />
              <h2 className="text-base font-extrabold text-neutral-950">회원 상태</h2>
            </div>
            <form action={updateAdminUserStatus} className="grid gap-3 p-4">
              <input type="hidden" name="userId" value={user.id.toString()} />
              <label className="grid gap-1 text-sm font-bold text-neutral-700">
                상태
                <select
                  name="status"
                  defaultValue={user.status}
                  className="min-h-11 w-full rounded-md border border-neutral-200 px-3 font-normal text-neutral-900"
                >
                  <option value="active">정상</option>
                  <option value="dormant">휴면</option>
                  <option value="withdrawn">탈퇴</option>
                  <option value="blocked">차단</option>
                </select>
              </label>
              <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 text-sm font-bold text-white hover:bg-neutral-800">
                <Save size={16} />
                상태 저장
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
              <TicketPercent className="text-neutral-300" size={20} />
              <h2 className="text-base font-extrabold text-neutral-950">최근 쿠폰</h2>
            </div>
            <ul className="divide-y divide-neutral-100">
              {user.couponIssues.length === 0 ? (
                <li className="p-4 text-sm text-neutral-500">발급된 쿠폰이 없습니다.</li>
              ) : (
                user.couponIssues.map((issue) => (
                  <li key={issue.id.toString()} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-extrabold text-neutral-950">
                          {issue.coupon.name}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">{issue.coupon.code}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${
                          issue.usedAt
                            ? 'bg-neutral-100 text-neutral-600'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {issue.usedAt ? '사용완료' : '사용가능'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-neutral-500">
                      만료일 {issue.expireAt.toLocaleDateString('ko-KR')}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
              <MessageSquareText className="text-neutral-300" size={20} />
              <h2 className="text-base font-extrabold text-neutral-950">메일/SMS 발송 요청</h2>
            </div>
            <form action={recordAdminUserMessage} className="grid gap-3 p-4">
              <input type="hidden" name="userId" value={user.id.toString()} />
              <label className="grid gap-1 text-sm font-bold text-neutral-700">
                발송 채널
                <select
                  name="channel"
                  defaultValue="sms"
                  className="min-h-11 w-full rounded-md border border-neutral-200 px-3 font-normal text-neutral-900"
                >
                  <option value="sms">SMS</option>
                  <option value="email">메일</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-bold text-neutral-700">
                제목
                <input
                  name="subject"
                  placeholder="메일 제목"
                  className="min-h-11 w-full rounded-md border border-neutral-200 px-3 font-normal text-neutral-900"
                />
              </label>
              <label className="grid gap-1 text-sm font-bold text-neutral-700">
                내용
                <textarea
                  name="content"
                  rows={5}
                  placeholder="발송 내용"
                  className="w-full rounded-md border border-neutral-200 px-3 py-2 font-normal text-neutral-900"
                  required
                />
              </label>
              <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 text-sm font-bold text-white hover:bg-neutral-800">
                <Mail size={16} />
                요청 기록
              </button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
