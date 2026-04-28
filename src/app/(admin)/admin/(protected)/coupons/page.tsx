// Legacy sources: wb_admin/coupon.php, wb_admin/coupon_list.php, wb_admin/coupon_edit.php
// Cache: no-store. Coupon state is operational data.

import type { Metadata } from 'next';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { formatKRW, formatNumber } from '@/lib/format';
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
import { FormattedNumberInput } from '@/components/ui/FormattedNumberInput';
import { saveAdminCoupon } from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '쿠폰 관리',
};

const COUPON_SORT_KEYS = [
  'no',
  'code',
  'name',
  'discountValue',
  'minOrderAmount',
  'maxDiscount',
  'startAt',
  'endAt',
  'isActive',
  'issues',
] as const;

type CouponSearchParams = {
  sort?: string;
  dir?: string;
};

function dateInputValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function DiscountValue({ type, value }: { type: string; value: string }) {
  return type === 'amount' ? formatKRW(value) : `${value}%`;
}

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: CouponSearchParams;
}) {
  await requireAdmin('coupon.read');
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { _count: { select: { issues: true } } },
  });
  const today = dateInputValue(new Date());
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const sortState = parseAdminSort(searchParams, COUPON_SORT_KEYS);
  const effectiveSort = sortState.sort ?? 'no';
  const sortedCoupons = [...coupons].sort((a, b) => {
    if (effectiveSort === 'no') return compareAdminValues(a.createdAt, b.createdAt, sortState.dir);
    if (effectiveSort === 'issues')
      return compareAdminValues(a._count.issues, b._count.issues, sortState.dir);
    return compareAdminValues(a[effectiveSort], b[effectiveSort], sortState.dir);
  });
  const params = new URLSearchParams();
  if (sortState.sort) {
    params.set('sort', sortState.sort);
    params.set('dir', sortState.dir);
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="쿠폰 관리"
        description="쿠폰을 상단에서 등록하고 목록에서 바로 수정합니다."
      />

      <AdminSection title="쿠폰 등록" description="할인 조건과 사용 기간을 함께 관리합니다.">
        <form action={saveAdminCoupon}>
          <div className="mt-4 grid gap-3 md:grid-cols-[140px_1fr_120px_120px_140px_140px]">
            <input
              name="code"
              placeholder="쿠폰 코드"
              className={`${adminFieldClass} h-11`}
              required
            />
            <input
              name="name"
              placeholder="쿠폰명"
              className={`${adminFieldClass} h-11`}
              required
            />
            <select name="discountType" defaultValue="amount" className={`${adminFieldClass} h-11`}>
              <option value="amount">금액 할인</option>
              <option value="percent">정률 할인</option>
            </select>
            <FormattedNumberInput
              name="discountValue"
              placeholder="할인값"
              defaultValue="0"
              allowDecimal
              className={`${adminFieldClass} h-11`}
              required
            />
            <input
              name="startAt"
              type="date"
              defaultValue={today}
              className={`${adminFieldClass} h-11`}
              required
            />
            <input
              name="endAt"
              type="date"
              defaultValue={dateInputValue(nextMonth)}
              className={`${adminFieldClass} h-11`}
              required
            />
            <FormattedNumberInput
              name="minOrderAmount"
              placeholder="최소주문금액"
              allowDecimal
              className={`${adminFieldClass} h-11`}
            />
            <FormattedNumberInput
              name="maxDiscount"
              placeholder="최대할인금액"
              allowDecimal
              className={`${adminFieldClass} h-11`}
            />
            <input
              name="totalQuota"
              type="number"
              min={1}
              placeholder="발급수량"
              className={`${adminFieldClass} h-11`}
            />
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
              <input type="checkbox" name="isActive" defaultChecked />
              사용
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button className={`${adminPrimaryButtonClass} h-11`}>등록</button>
          </div>
        </form>
      </AdminSection>

      <AdminSection
        title="쿠폰 목록"
        description="행에서 바로 수정할 수 있습니다."
        bodyClassName="p-0"
      >
        <AdminDataGrid
          caption="쿠폰 목록"
          columns={[
            { key: 'no', label: 'No', align: 'right', widthClassName: 'w-14', sortKey: 'no' },
            { key: 'code', label: '쿠폰 코드', widthClassName: 'w-44', sortKey: 'code' },
            {
              key: 'name',
              label: '쿠폰명',
              widthClassName: 'min-w-[190px]',
              priority: 'primary',
              sortKey: 'name',
            },
            { key: 'discountType', label: '유형', widthClassName: 'w-28' },
            {
              key: 'discount',
              label: '할인',
              align: 'right',
              widthClassName: 'w-28',
              sortKey: 'discountValue',
            },
            {
              key: 'min',
              label: '최소주문',
              align: 'right',
              widthClassName: 'w-28',
              sortKey: 'minOrderAmount',
            },
            {
              key: 'max',
              label: '최대할인',
              align: 'right',
              widthClassName: 'w-28',
              sortKey: 'maxDiscount',
            },
            { key: 'startAt', label: '시작일', widthClassName: 'w-40', sortKey: 'startAt' },
            { key: 'endAt', label: '종료일', widthClassName: 'w-40', sortKey: 'endAt' },
            {
              key: 'status',
              label: '상태',
              align: 'center',
              widthClassName: 'w-24',
              sortKey: 'isActive',
            },
            {
              key: 'quota',
              label: '발급',
              align: 'right',
              widthClassName: 'w-28',
              sortKey: 'issues',
            },
            { key: 'save', label: '수정', align: 'right', widthClassName: 'w-28' },
          ]}
          rows={sortedCoupons}
          rowKey={(coupon) => coupon.id.toString()}
          emptyText="등록된 쿠폰이 없습니다."
          minWidthClassName="min-w-[1180px]"
          currentSortKey={sortState.sort}
          currentSortDirection={sortState.dir}
          getSortHref={createAdminSortHref('/admin/coupons', params)}
          renderRow={(coupon, index) => (
            <tr
              key={coupon.id.toString()}
              className="bg-white align-top transition hover:bg-neutral-50"
            >
              <td className={`${adminGridCellClass} text-right font-bold text-neutral-500`}>
                {sortedCoupons.length - index}
              </td>
              <td className={adminGridCellClass}>
                <form id={`coupon-${coupon.id.toString()}`} action={saveAdminCoupon}>
                  <input type="hidden" name="id" value={coupon.id.toString()} />
                  <input name="code" defaultValue={coupon.code} className={adminGridInputClass} />
                </form>
              </td>
              <td className={adminGridStickyCellClass}>
                <input
                  form={`coupon-${coupon.id.toString()}`}
                  name="name"
                  defaultValue={coupon.name}
                  className={`${adminGridInputClass} font-bold`}
                />
              </td>
              <td className={adminGridCellClass}>
                <select
                  form={`coupon-${coupon.id.toString()}`}
                  name="discountType"
                  defaultValue={coupon.discountType}
                  className={adminGridInputClass}
                >
                  <option value="amount">금액</option>
                  <option value="percent">정률</option>
                </select>
              </td>
              <td className={`${adminGridCellClass} text-right`}>
                <FormattedNumberInput
                  form={`coupon-${coupon.id.toString()}`}
                  name="discountValue"
                  defaultValue={coupon.discountValue.toString()}
                  allowDecimal
                  className={adminGridInputClass}
                />
              </td>
              <td className={`${adminGridCellClass} text-right`}>
                <FormattedNumberInput
                  form={`coupon-${coupon.id.toString()}`}
                  name="minOrderAmount"
                  defaultValue={coupon.minOrderAmount?.toString() ?? ''}
                  allowDecimal
                  className={`${adminGridInputClass} text-right`}
                />
              </td>
              <td className={`${adminGridCellClass} text-right`}>
                <FormattedNumberInput
                  form={`coupon-${coupon.id.toString()}`}
                  name="maxDiscount"
                  defaultValue={coupon.maxDiscount?.toString() ?? ''}
                  allowDecimal
                  className={`${adminGridInputClass} text-right`}
                />
              </td>
              <td className={adminGridCellClass}>
                <input
                  form={`coupon-${coupon.id.toString()}`}
                  name="startAt"
                  type="date"
                  defaultValue={dateInputValue(coupon.startAt)}
                  className={adminGridInputClass}
                />
              </td>
              <td className={adminGridCellClass}>
                <input
                  form={`coupon-${coupon.id.toString()}`}
                  name="endAt"
                  type="date"
                  defaultValue={dateInputValue(coupon.endAt)}
                  className={adminGridInputClass}
                />
              </td>
              <td className={`${adminGridCellClass} text-center`}>
                <div className="flex flex-col items-center gap-2">
                  <AdminStatusBadge status={coupon.isActive ? 'active' : 'hidden'} />
                  <label className="text-xs font-bold text-neutral-500">
                    <input
                      form={`coupon-${coupon.id.toString()}`}
                      type="checkbox"
                      name="isActive"
                      defaultChecked={coupon.isActive}
                      className="mr-1"
                    />
                    사용
                  </label>
                </div>
              </td>
              <td className={`${adminGridCellClass} text-right`}>
                <input
                  form={`coupon-${coupon.id.toString()}`}
                  name="totalQuota"
                  type="number"
                  min={1}
                  defaultValue={coupon.totalQuota ?? ''}
                  className={`${adminGridInputClass} mb-2 text-right`}
                />
                <p className="text-xs text-neutral-500">
                  발급 {formatNumber(coupon._count.issues)}
                </p>
              </td>
              <td className={`${adminGridCellClass} text-right`}>
                <button form={`coupon-${coupon.id.toString()}`} className={adminGridButtonClass}>
                  저장
                </button>
              </td>
            </tr>
          )}
          renderMobileCard={(coupon) => (
            <AdminMobileCard>
              <form
                id={`coupon-mobile-${coupon.id.toString()}`}
                action={saveAdminCoupon}
                className="grid gap-3"
              >
                <input type="hidden" name="id" value={coupon.id.toString()} />
                <input
                  name="code"
                  defaultValue={coupon.code}
                  className={adminGridInputClass}
                  aria-label="쿠폰 코드"
                />
                <input
                  name="name"
                  defaultValue={coupon.name}
                  className={`${adminGridInputClass} font-bold`}
                  aria-label="쿠폰명"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    name="discountType"
                    defaultValue={coupon.discountType}
                    className={adminGridInputClass}
                    aria-label="할인 유형"
                  >
                    <option value="amount">금액</option>
                    <option value="percent">정률</option>
                  </select>
                  <FormattedNumberInput
                    name="discountValue"
                    defaultValue={coupon.discountValue.toString()}
                    allowDecimal
                    className={adminGridInputClass}
                    aria-label="할인값"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FormattedNumberInput
                    name="minOrderAmount"
                    defaultValue={coupon.minOrderAmount?.toString() ?? ''}
                    allowDecimal
                    className={`${adminGridInputClass} text-right`}
                    aria-label="최소주문"
                  />
                  <FormattedNumberInput
                    name="maxDiscount"
                    defaultValue={coupon.maxDiscount?.toString() ?? ''}
                    allowDecimal
                    className={`${adminGridInputClass} text-right`}
                    aria-label="최대할인"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="startAt"
                    type="date"
                    defaultValue={dateInputValue(coupon.startAt)}
                    className={adminGridInputClass}
                    aria-label="시작일"
                  />
                  <input
                    name="endAt"
                    type="date"
                    defaultValue={dateInputValue(coupon.endAt)}
                    className={adminGridInputClass}
                    aria-label="종료일"
                  />
                </div>
                <input
                  name="totalQuota"
                  type="number"
                  min={1}
                  defaultValue={coupon.totalQuota ?? ''}
                  className={`${adminGridInputClass} text-right`}
                  aria-label="발급수량"
                />
                <dl className="grid grid-cols-2 gap-2">
                  <AdminMobileField label="현재 할인">
                    <DiscountValue
                      type={coupon.discountType}
                      value={coupon.discountValue.toString()}
                    />
                  </AdminMobileField>
                  <AdminMobileField label="발급" align="right">
                    {formatNumber(coupon._count.issues)}
                  </AdminMobileField>
                </dl>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-bold text-neutral-600">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={coupon.isActive}
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
