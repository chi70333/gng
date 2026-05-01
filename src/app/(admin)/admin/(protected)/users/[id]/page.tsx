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
import type { LucideIcon } from 'lucide-react';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { formatKRW, formatNumber } from '@/lib/format';
import {
  AdminDataGrid,
  AdminMobileCard,
  AdminMobileField,
  adminGridCellClass,
  adminGridStickyCellClass,
} from '@/components/admin/AdminDataGrid';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import {
  AdminInfoTile,
  AdminPageHeader,
  AdminSection,
  adminFieldClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminTextareaClass,
} from '@/components/admin/AdminUI';
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
    <div className="grid gap-1 rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm shadow-neutral-950/[0.025]">
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
  icon: LucideIcon;
}) {
  return <AdminInfoTile label={label} value={value} icon={Icon} />;
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
        orderBy: { id: 'desc' },
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
      <AdminPageHeader
        title={user.name}
        description={`${user.loginId ?? '아이디 없음'} / ${user.email} / ${displayPhone(user.phone)}`}
        actions={
          <Link href="/admin/users" className={adminSecondaryButtonClass}>
            <ArrowLeft size={16} />
            회원 목록
          </Link>
        }
      />
      <div className="-mt-3">
        <AdminStatusBadge status={user.status} />
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
          <AdminSection title="회원 기본 정보" icon={UserRound}>
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
          </AdminSection>

          <AdminSection
            title="최근 주문"
            description={`전체 ${formatNumber(user._count.orders)}건 중 최근 10건`}
            icon={PackageCheck}
            bodyClassName="p-0"
          >
            <AdminDataGrid
              caption="최근 주문"
              columns={[
                { key: 'no', label: 'No', align: 'right', widthClassName: 'w-16' },
                {
                  key: 'order',
                  label: '주문번호',
                  widthClassName: 'min-w-[220px]',
                  priority: 'primary',
                },
                { key: 'date', label: '주문일', widthClassName: 'w-36' },
                { key: 'status', label: '상태', widthClassName: 'w-32' },
                { key: 'amount', label: '결제금액', align: 'right', widthClassName: 'w-36' },
              ]}
              rows={user.orders}
              rowKey={(order) => order.orderNo}
              emptyText="주문 이력이 없습니다."
              minWidthClassName="min-w-[720px]"
              className="rounded-none border-0 shadow-none"
              renderRow={(order, index) => (
                <tr key={order.orderNo} className="bg-white transition hover:bg-neutral-50">
                  <td className={`${adminGridCellClass} text-right font-bold text-neutral-500`}>
                    {user.orders.length - index}
                  </td>
                  <td className={adminGridStickyCellClass}>
                    <Link
                      href={`/admin/orders/${order.orderNo}`}
                      className="font-extrabold text-blue-700 hover:underline"
                    >
                      {order.orderNo}
                    </Link>
                  </td>
                  <td className={`${adminGridCellClass} text-neutral-600`}>
                    {order.createdAt.toLocaleDateString('ko-KR')}
                  </td>
                  <td className={adminGridCellClass}>
                    <AdminStatusBadge status={order.status} />
                  </td>
                  <td className={`${adminGridCellClass} text-right font-extrabold`}>
                    {formatKRW(order.total.toString())}
                  </td>
                </tr>
              )}
              renderMobileCard={(order) => (
                <AdminMobileCard>
                  <Link
                    href={`/admin/orders/${order.orderNo}`}
                    className="font-extrabold text-blue-700"
                  >
                    {order.orderNo}
                  </Link>
                  <dl className="mt-3 grid grid-cols-2 gap-2">
                    <AdminMobileField label="주문일">
                      {order.createdAt.toLocaleDateString('ko-KR')}
                    </AdminMobileField>
                    <AdminMobileField label="결제금액" align="right">
                      {formatKRW(order.total.toString())}
                    </AdminMobileField>
                    <AdminMobileField label="상태">
                      <AdminStatusBadge status={order.status} />
                    </AdminMobileField>
                  </dl>
                </AdminMobileCard>
              )}
            />
          </AdminSection>

          <AdminUserPointsClient
            userId={user.id.toString()}
            initialBalance={pointBalance}
            initialPoints={pointRows}
          />
        </section>

        <aside className="space-y-5">
          <AdminSection title="회원 상태" icon={ShieldCheck}>
            <form action={updateAdminUserStatus} className="grid gap-3 p-4">
              <input type="hidden" name="userId" value={user.id.toString()} />
              <label className="grid gap-1 text-sm font-bold text-neutral-700">
                상태
                <select
                  name="status"
                  defaultValue={user.status}
                  className={`${adminFieldClass} h-11`}
                >
                  <option value="active">정상</option>
                  <option value="dormant">휴면</option>
                  <option value="withdrawn">탈퇴</option>
                  <option value="blocked">차단</option>
                </select>
              </label>
              <button className={`${adminPrimaryButtonClass} h-11`}>
                <Save size={16} />
                상태 저장
              </button>
            </form>
          </AdminSection>

          <AdminSection title="최근 쿠폰" icon={TicketPercent} bodyClassName="p-0">
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
          </AdminSection>

          <AdminSection title="메일/SMS 발송 요청" icon={MessageSquareText}>
            <form action={recordAdminUserMessage} className="grid gap-3 p-4">
              <input type="hidden" name="userId" value={user.id.toString()} />
              <label className="grid gap-1 text-sm font-bold text-neutral-700">
                발송 채널
                <select name="channel" defaultValue="sms" className={`${adminFieldClass} h-11`}>
                  <option value="sms">SMS</option>
                  <option value="email">메일</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-bold text-neutral-700">
                제목
                <input
                  name="subject"
                  placeholder="메일 제목"
                  className={`${adminFieldClass} h-11`}
                />
              </label>
              <label className="grid gap-1 text-sm font-bold text-neutral-700">
                내용
                <textarea
                  name="content"
                  rows={5}
                  placeholder="발송 내용"
                  className={adminTextareaClass}
                  required
                />
              </label>
              <button className={`${adminPrimaryButtonClass} h-11`}>
                <Mail size={16} />
                요청 기록
              </button>
            </form>
          </AdminSection>
        </aside>
      </div>
    </div>
  );
}
