// Legacy sources: wb_admin/coupon.php, wb_admin/coupon_list.php, wb_admin/coupon_edit.php
// Cache: no-store. Coupon state is operational data.

import type { Metadata } from 'next';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { formatKRW, formatNumber } from '@/lib/format';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import { FormattedNumberInput } from '@/components/ui/FormattedNumberInput';
import { saveAdminCoupon } from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '쿠폰 관리',
};

function dateInputValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function DiscountValue({ type, value }: { type: string; value: string }) {
  return type === 'amount' ? formatKRW(value) : `${value}%`;
}

export default async function AdminCouponsPage() {
  await requireAdmin('coupon.read');
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { _count: { select: { issues: true } } },
  });
  const today = dateInputValue(new Date());
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-neutral-950">쿠폰 관리</h1>
        <p className="mt-1 text-sm text-neutral-500">
          레거시 쿠폰 등록/목록처럼 상단에서 등록하고 목록에서 바로 수정합니다.
        </p>
      </div>

      <form action={saveAdminCoupon} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-extrabold">쿠폰 등록</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-[140px_1fr_120px_120px_140px_140px]">
          <input name="code" placeholder="쿠폰 코드" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" required />
          <input name="name" placeholder="쿠폰명" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" required />
          <select name="discountType" defaultValue="amount" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm">
            <option value="amount">금액 할인</option>
            <option value="percent">정률 할인</option>
          </select>
          <FormattedNumberInput name="discountValue" placeholder="할인값" defaultValue="0" allowDecimal className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" required />
          <input name="startAt" type="date" defaultValue={today} className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" required />
          <input name="endAt" type="date" defaultValue={dateInputValue(nextMonth)} className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" required />
          <FormattedNumberInput name="minOrderAmount" placeholder="최소주문금액" allowDecimal className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" />
          <FormattedNumberInput name="maxDiscount" placeholder="최대할인금액" allowDecimal className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" />
          <input name="totalQuota" type="number" min={1} placeholder="발급수량" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" />
          <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
            <input type="checkbox" name="isActive" defaultChecked />
            사용
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button className="min-h-11 rounded-md bg-neutral-900 px-5 text-sm font-extrabold text-white">
            등록
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-neutral-50 text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-3 text-left">쿠폰</th>
              <th className="w-28 px-4 py-3 text-left">할인</th>
              <th className="w-32 px-4 py-3 text-right">최소주문</th>
              <th className="w-32 px-4 py-3 text-right">최대할인</th>
              <th className="w-40 px-4 py-3 text-left">기간</th>
              <th className="w-24 px-4 py-3 text-center">상태</th>
              <th className="w-24 px-4 py-3 text-right">발급</th>
              <th className="w-24 px-4 py-3 text-right">수정</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {coupons.map((coupon) => (
              <tr key={coupon.id.toString()} className="align-top hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <form id={`coupon-${coupon.id.toString()}`} action={saveAdminCoupon} className="grid gap-2">
                    <input type="hidden" name="id" value={coupon.id.toString()} />
                    <input name="code" defaultValue={coupon.code} className="min-h-10 rounded-md border border-neutral-200 px-3 text-sm" />
                    <input name="name" defaultValue={coupon.name} className="min-h-10 rounded-md border border-neutral-200 px-3 text-sm font-bold" />
                  </form>
                </td>
                <td className="px-4 py-3">
                  <select form={`coupon-${coupon.id.toString()}`} name="discountType" defaultValue={coupon.discountType} className="mb-2 min-h-10 w-full rounded-md border border-neutral-200 px-3 text-sm">
                    <option value="amount">금액</option>
                    <option value="percent">정률</option>
                  </select>
                  <FormattedNumberInput form={`coupon-${coupon.id.toString()}`} name="discountValue" defaultValue={coupon.discountValue.toString()} allowDecimal className="min-h-10 w-full rounded-md border border-neutral-200 px-3 text-sm" />
                  <p className="mt-1 text-xs text-neutral-500">
                    현재 <DiscountValue type={coupon.discountType} value={coupon.discountValue.toString()} />
                  </p>
                </td>
                <td className="px-4 py-3 text-right">
                  <FormattedNumberInput form={`coupon-${coupon.id.toString()}`} name="minOrderAmount" defaultValue={coupon.minOrderAmount?.toString() ?? ''} allowDecimal className="min-h-10 w-full rounded-md border border-neutral-200 px-3 text-right text-sm" />
                </td>
                <td className="px-4 py-3 text-right">
                  <FormattedNumberInput form={`coupon-${coupon.id.toString()}`} name="maxDiscount" defaultValue={coupon.maxDiscount?.toString() ?? ''} allowDecimal className="min-h-10 w-full rounded-md border border-neutral-200 px-3 text-right text-sm" />
                </td>
                <td className="px-4 py-3">
                  <input form={`coupon-${coupon.id.toString()}`} name="startAt" type="date" defaultValue={dateInputValue(coupon.startAt)} className="mb-2 min-h-10 w-full rounded-md border border-neutral-200 px-3 text-sm" />
                  <input form={`coupon-${coupon.id.toString()}`} name="endAt" type="date" defaultValue={dateInputValue(coupon.endAt)} className="min-h-10 w-full rounded-md border border-neutral-200 px-3 text-sm" />
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <AdminStatusBadge status={coupon.isActive ? 'active' : 'hidden'} />
                    <label className="text-xs font-bold text-neutral-500">
                      <input form={`coupon-${coupon.id.toString()}`} type="checkbox" name="isActive" defaultChecked={coupon.isActive} className="mr-1" />
                      사용
                    </label>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <input form={`coupon-${coupon.id.toString()}`} name="totalQuota" type="number" min={1} defaultValue={coupon.totalQuota ?? ''} className="mb-2 min-h-10 w-full rounded-md border border-neutral-200 px-3 text-right text-sm" />
                  <p className="text-xs text-neutral-500">발급 {formatNumber(coupon._count.issues)}</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <button form={`coupon-${coupon.id.toString()}`} className="min-h-10 rounded-md border border-neutral-200 px-4 text-sm font-bold hover:bg-neutral-100">
                    저장
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
