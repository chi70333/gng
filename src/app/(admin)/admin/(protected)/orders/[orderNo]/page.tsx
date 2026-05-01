// Legacy sources: wb_admin/trade_order_view.php, wb_admin/trade_order_view_ok.php
// Cache: no-store. Order detail includes private payment, buyer, and shipment data.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { formatKRW } from '@/lib/format';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import {
  AdminPageHeader,
  AdminSection,
  adminFieldClass,
  adminPrimaryButtonClass,
} from '@/components/admin/AdminUI';
import { saveAdminShipment, updateAdminOrderStatus } from '../../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '주문 상세',
};

const STATUS_OPTIONS = [
  { value: 'pending', label: '주문접수' },
  { value: 'paid', label: '결제완료' },
  { value: 'preparing', label: '상품준비중' },
  { value: 'shipping', label: '배송시작' },
  { value: 'delivered', label: '배송완료' },
  { value: 'cancelled', label: '주문취소' },
  { value: 'refunded', label: '환불처리' },
] as const;

function readJsonString(value: unknown, keys: string[]): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const result = record[key];
    if (typeof result === 'string' && result.trim()) return result;
  }
  return '';
}

function statusLabel(status: string): string {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

export default async function AdminOrderDetailPage({ params }: { params: { orderNo: string } }) {
  await requireAdmin('order.read');
  const order = await prisma.order.findUnique({
    where: { orderNo: params.orderNo },
    include: {
      user: { select: { email: true, name: true, phone: true, loginId: true } },
      items: true,
      payments: { orderBy: { createdAt: 'desc' } },
      shipments: { orderBy: { createdAt: 'desc' } },
      history: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!order) notFound();
  const shipment = order.shipments[0];
  const buyerName =
    order.user?.name || readJsonString(order.buyerInfo, ['name', 'buyerName']) || '비회원';
  const buyerPhone = order.user?.phone || readJsonString(order.buyerInfo, ['phone', 'tel']) || '-';
  const receiver = readJsonString(order.shippingAddress, ['receiver', 'name']) || buyerName;
  const receiverPhone = readJsonString(order.shippingAddress, ['phone', 'tel']) || buyerPhone;
  const zipCode = readJsonString(order.shippingAddress, ['zipCode', 'zipcode', 'zip']);
  const address1 = readJsonString(order.shippingAddress, ['address1', 'address']);
  const address2 = readJsonString(order.shippingAddress, ['address2', 'detailAddress']);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="space-y-5">
        <AdminPageHeader
          title={order.orderNo}
          description={`주문일시 ${order.createdAt.toLocaleString('ko-KR')}`}
          actions={<AdminStatusBadge status={order.status} />}
        />

        <AdminSection title="주문 상품">
          <ul className="mt-3 divide-y divide-neutral-100">
            {order.items.map((item) => (
              <li key={item.id.toString()} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">{item.productName}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {item.optionSummary ?? item.skuCode ?? '-'} / {item.quantity}개
                    </p>
                  </div>
                  <p className="text-sm font-extrabold">{formatKRW(item.totalPrice.toString())}</p>
                </div>
              </li>
            ))}
          </ul>
        </AdminSection>

        <div className="grid gap-5 lg:grid-cols-2">
          <AdminSection title="주문자 정보">
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">이름</dt>
                <dd className="font-bold">{buyerName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">아이디</dt>
                <dd>{order.user?.loginId ?? order.user?.email ?? '비회원'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">연락처</dt>
                <dd>{buyerPhone}</dd>
              </div>
            </dl>
          </AdminSection>

          <AdminSection title="배송지 정보">
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">수령자</dt>
                <dd className="font-bold">{receiver}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">연락처</dt>
                <dd>{receiverPhone}</dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-neutral-500">주소</dt>
                <dd>
                  {zipCode ? `(${zipCode}) ` : ''}
                  {address1} {address2}
                </dd>
              </div>
            </dl>
          </AdminSection>
        </div>

        <AdminSection title="상태 이력">
          <ul className="mt-3 space-y-2">
            {order.history.length === 0 ? (
              <li className="text-sm text-neutral-500">상태 변경 이력이 없습니다.</li>
            ) : (
              order.history.map((history) => (
                <li key={history.id.toString()} className="text-sm text-neutral-600">
                  {history.fromStatus ? statusLabel(history.fromStatus) : '-'} →{' '}
                  {statusLabel(history.toStatus)} / {history.createdAt.toLocaleString('ko-KR')}
                  {history.reason ? ` / ${history.reason}` : ''}
                </li>
              ))
            )}
          </ul>
        </AdminSection>
      </section>

      <aside className="space-y-5">
        <AdminSection title="결제 금액">
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>상품금액</dt>
              <dd>{formatKRW(order.subtotal.toString())}</dd>
            </div>
            <div className="flex justify-between">
              <dt>할인</dt>
              <dd>{formatKRW(order.discount.toString())}</dd>
            </div>
            <div className="flex justify-between">
              <dt>배송비</dt>
              <dd>{formatKRW(order.shippingFee.toString())}</dd>
            </div>
            <div className="flex justify-between">
              <dt>마일리지 사용</dt>
              <dd>{order.pointsUsed.toLocaleString('ko-KR')}원</dd>
            </div>
            <div className="flex justify-between border-t border-neutral-100 pt-2 font-extrabold">
              <dt>총액</dt>
              <dd>{formatKRW(order.total.toString())}</dd>
            </div>
          </dl>
        </AdminSection>

        <AdminSection title="결제 내역">
          <ul className="mt-3 space-y-2 text-sm">
            {order.payments.length === 0 ? (
              <li className="text-neutral-500">결제 내역이 없습니다.</li>
            ) : (
              order.payments.map((payment) => (
                <li key={payment.id.toString()} className="rounded-md bg-neutral-50 p-3">
                  <p className="font-bold">{payment.method}</p>
                  <p className="mt-1 text-neutral-500">
                    {payment.status} / {formatKRW(payment.amount.toString())}
                  </p>
                </li>
              ))
            )}
          </ul>
        </AdminSection>

        <AdminSection title="주문 상태 변경">
          <form action={updateAdminOrderStatus} className="mt-3 space-y-3">
            <input type="hidden" name="orderNo" value={order.orderNo} />
            <select name="status" defaultValue={order.status} className={adminFieldClass}>
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <input name="reason" placeholder="변경 사유" className={adminFieldClass} />
            <button className={`${adminPrimaryButtonClass} w-full`}>상태 저장</button>
          </form>
        </AdminSection>

        <AdminSection title="배송 정보">
          <form action={saveAdminShipment} className="mt-3 space-y-3">
            <input type="hidden" name="orderNo" value={order.orderNo} />
            {shipment ? (
              <input type="hidden" name="shipmentId" value={shipment.id.toString()} />
            ) : null}
            <input
              name="carrier"
              defaultValue={shipment?.carrier ?? ''}
              placeholder="택배사"
              className={adminFieldClass}
            />
            <input
              name="trackingNo"
              defaultValue={shipment?.trackingNo ?? ''}
              placeholder="송장번호"
              className={adminFieldClass}
            />
            <select
              name="status"
              defaultValue={shipment?.status ?? 'ready'}
              className={adminFieldClass}
            >
              <option value="ready">배송대기</option>
              <option value="shipping">배송중</option>
              <option value="delivered">배송완료</option>
            </select>
            <button className={`${adminPrimaryButtonClass} w-full`}>배송 저장</button>
          </form>
        </AdminSection>
      </aside>
    </div>
  );
}
