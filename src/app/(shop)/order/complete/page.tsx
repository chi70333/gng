// Legacy source: order_ok.php
// Cache: no-cache. Completion is per-order/user state.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db';
import { formatKRW } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '주문 완료',
};

type CompletePageProps = {
  searchParams: {
    orderNo?: string;
  };
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function paymentLabel(method: string): string {
  const labels: Record<string, string> = {
    bank: '무통장입금',
    card: '신용카드',
    vbank: '가상계좌',
    mobile: '휴대폰 결제',
    transfer: '계좌이체',
    point: '포인트 결제',
  };
  return labels[method] ?? method;
}

async function getCompleteOrder(orderNo: string) {
  return prisma.order.findUnique({
    where: { orderNo },
    select: {
      orderNo: true,
      status: true,
      subtotal: true,
      discount: true,
      shippingFee: true,
      pointsUsed: true,
      total: true,
      shippingAddress: true,
      createdAt: true,
      items: {
        orderBy: { id: 'asc' },
        select: {
          productName: true,
          optionSummary: true,
          unitPrice: true,
          quantity: true,
          totalPrice: true,
        },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          method: true,
          status: true,
          rawResponse: true,
        },
      },
    },
  });
}

export default async function OrderCompletePage({ searchParams }: CompletePageProps) {
  if (!searchParams.orderNo) notFound();

  const order = await getCompleteOrder(searchParams.orderNo);
  if (!order) notFound();

  const shipping = asRecord(order.shippingAddress);
  const payment = order.payments[0];
  const rawPayment = asRecord(payment?.rawResponse);
  const bankDeposit = asRecord(rawPayment.bankDeposit);
  const bankAccount = asString(bankDeposit.account);
  const depositorName = asString(bankDeposit.depositorName);
  const depositDueDate = asString(bankDeposit.depositDueDate);

  return (
    <div className="mx-auto max-w-screen-md px-4 py-8">
      <div className="rounded-lg bg-white p-5">
        <h1 className="text-xl font-bold text-neutral-900">주문이 접수되었습니다.</h1>
        <p className="mt-2 text-sm text-neutral-500">
          주문번호 <span className="font-semibold text-neutral-900">{order.orderNo}</span>
        </p>
      </div>

      <section className="mt-4 rounded-lg bg-white p-5">
        <h2 className="text-base font-bold text-neutral-900">주문 상품</h2>
        <ul className="mt-4 space-y-3">
          {order.items.map((item) => (
            <li key={`${item.productName}-${item.quantity}`} className="border-b border-neutral-100 pb-3 last:border-b-0 last:pb-0">
              <div className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-900">{item.productName}</p>
                  {item.optionSummary && (
                    <p className="mt-1 text-xs text-neutral-500">{item.optionSummary}</p>
                  )}
                  <p className="mt-1 text-xs text-neutral-500">
                    {formatKRW(item.unitPrice.toString())} / {item.quantity}개
                  </p>
                </div>
                <span className="shrink-0 font-bold text-neutral-900">
                  {formatKRW(item.totalPrice.toString())}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-lg bg-white p-5">
        <h2 className="text-base font-bold text-neutral-900">결제 정보</h2>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">상품금액</span>
            <span className="font-medium text-neutral-900">{formatKRW(order.subtotal.toString())}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">배송비</span>
            <span className="font-medium text-neutral-900">{formatKRW(order.shippingFee.toString())}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">할인</span>
            <span className="font-medium text-neutral-900">-{formatKRW(order.discount.toString())}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">포인트 사용</span>
            <span className="font-medium text-neutral-900">-{order.pointsUsed.toLocaleString('ko-KR')} P</span>
          </div>
          <div className="flex justify-between border-t border-neutral-100 pt-3 text-base">
            <span className="font-bold text-neutral-900">최종 결제금액</span>
            <span className="font-extrabold text-neutral-950">{formatKRW(order.total.toString())}</span>
          </div>
          {payment && (
            <p className="pt-2 text-sm text-neutral-600">
              결제수단: {paymentLabel(payment.method)} / 상태: {payment.status}
            </p>
          )}
          {bankAccount && (
            <div className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
              <p className="font-semibold text-neutral-900">입금 계좌</p>
              <p className="mt-1">{bankAccount}</p>
              {depositorName && <p className="mt-1">입금자명: {depositorName}</p>}
              {depositDueDate && (
                <p className="mt-1">입금 예정일: {new Date(depositDueDate).toLocaleDateString('ko-KR')}</p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-lg bg-white p-5">
        <h2 className="text-base font-bold text-neutral-900">배송지</h2>
        <div className="mt-3 text-sm text-neutral-700">
          <p>{asString(shipping.receiver) ?? '받는 분'} / {asString(shipping.phone) ?? '-'}</p>
          <p className="mt-1">
            [{asString(shipping.zipCode) ?? '-'}] {asString(shipping.address1) ?? ''} {asString(shipping.address2) ?? ''}
          </p>
        </div>
      </section>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-neutral-900 px-5 text-sm font-semibold text-white"
        >
          쇼핑 계속하기
        </Link>
        <Link
          href="/mypage/orders"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-neutral-300 px-5 text-sm font-semibold text-neutral-900"
        >
          주문내역 보기
        </Link>
      </div>
    </div>
  );
}
