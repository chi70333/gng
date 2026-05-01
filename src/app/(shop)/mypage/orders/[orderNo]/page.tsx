// Legacy sources: mypage_order_detail.php, order_cancel.php
// Cache: no-store. Order detail is private member state.

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db';
import { formatKRW } from '@/lib/format';
import { getCachedSitePolicy } from '@/server/services/site-policy.service';
import { cancelOrderAction } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '주문상세',
  description: '주문 상품, 결제금액, 배송지와 진행상태를 확인합니다.',
};

type DetailPageProps = {
  params: { orderNo: string };
  searchParams: { phone?: string };
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

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '결제 대기',
    paid: '결제 완료',
    preparing: '상품 준비중',
    shipping: '배송중',
    delivered: '배송 완료',
    cancelled: '취소',
    refunded: '환불',
  };
  return labels[status] ?? status;
}

function paymentLabel(method: string): string {
  const labels: Record<string, string> = {
    bank: '무통장입금',
    card: '신용카드',
    vbank: '가상계좌',
    mobile: '휴대폰 결제',
    transfer: '계좌이체',
  };
  return labels[method] ?? method;
}

function normalizePhone(value: string | null): string {
  return (value ?? '').replace(/\D/g, '');
}

function GuestOrderLookup({ orderNo }: { orderNo: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-xl font-bold text-neutral-900">비회원 주문조회</h1>
      <p className="mt-2 text-sm text-neutral-500">
        주문자 연락처를 입력하면 주문상세를 확인할 수 있습니다.
      </p>
      <form action={`/mypage/orders/${orderNo}`} className="mt-5 rounded-lg bg-white p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">주문자 연락처</span>
          <input
            name="phone"
            type="tel"
            required
            className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
          />
        </label>
        <button
          type="submit"
          className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg bg-neutral-900 px-5 text-sm font-semibold text-white"
        >
          주문조회
        </button>
      </form>
    </div>
  );
}

export default async function MyOrderDetailPage({ params, searchParams }: DetailPageProps) {
  const session = await auth();
  const user = session?.user?.email
    ? await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
    : null;

  const order = await prisma.order.findFirst({
    where: { orderNo: params.orderNo, userId: user?.id ?? null },
    select: {
      orderNo: true,
      status: true,
      subtotal: true,
      discount: true,
      shippingFee: true,
      pointsUsed: true,
      total: true,
      memo: true,
      buyerInfo: true,
      shippingAddress: true,
      createdAt: true,
      items: {
        orderBy: { id: 'asc' },
        select: {
          productId: true,
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
  if (!order) notFound();
  const sitePolicy = await getCachedSitePolicy();
  const productIds = [...new Set(order.items.map((item) => item.productId))];
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, slug: true, thumbnail: true },
      })
    : [];
  const productMap = new Map<string, { slug: string; thumbnail: string | null }>(
    products.map((product) => [product.id.toString(), { slug: product.slug, thumbnail: product.thumbnail }]),
  );

  const shipping = asRecord(order.shippingAddress);
  const buyer = asRecord(order.buyerInfo);
  if (!user) {
    if (!searchParams.phone) return <GuestOrderLookup orderNo={params.orderNo} />;

    const requestedPhone = normalizePhone(searchParams.phone);
    const buyerPhone = normalizePhone(asString(buyer.buyerPhone) ?? asString(buyer.phone));
    const receiverPhone = normalizePhone(asString(shipping.phone));
    if (!requestedPhone || (requestedPhone !== buyerPhone && requestedPhone !== receiverPhone)) {
      notFound();
    }
  }

  const payment = order.payments[0];
  const rawPayment = asRecord(payment?.rawResponse);
  const bankDeposit = asRecord(rawPayment.bankDeposit);
  const isBankTransfer = payment?.method === 'bank';

  const depositAccount =
    asString(bankDeposit.account) ??
    asString(bankDeposit.accountNo) ??
    (isBankTransfer ? sitePolicy.bankAccount : null);
  const depositBankName =
    asString(bankDeposit.bankName) ??
    asString(rawPayment.bankName) ??
    (isBankTransfer ? sitePolicy.bankName : null);
  const depositorName = asString(bankDeposit.depositorName);
  const depositDisplayName =
    asString(depositBankName) !== null && asString(depositAccount) !== null
      ? `${asString(depositBankName)} ${asString(depositAccount)}`
      : asString(depositBankName) ?? asString(depositAccount);

  const canCancel = order.status === 'pending' || order.status === 'paid';
  const cancelAction = cancelOrderAction.bind(null, order.orderNo);

  return (
    <div className="mx-auto max-w-screen-md px-4 py-6">
      <div className="rounded-lg bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">주문상세</h1>
            <p className="mt-1 text-sm text-neutral-500">{order.orderNo}</p>
          </div>
          <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
            {statusLabel(order.status)}
          </span>
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          주문일 {order.createdAt.toLocaleString('ko-KR')}
        </p>
      </div>

      <section className="mt-4 rounded-lg bg-white p-5">
        <h2 className="text-base font-bold text-neutral-900">주문 상품</h2>
        <ul className="mt-4 space-y-3">
          {order.items.map((item) => (
            <li
              key={`${item.productId}-${item.productName}-${item.quantity}`}
              className="border-b border-neutral-100 pb-3 last:border-b-0 last:pb-0"
            >
              {(() => {
                const product = productMap.get(item.productId.toString());
                if (!product?.slug) {
                  return (
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
                  );
                }

                return (
                  <Link
                    href={`/goods/${product.slug}`}
                    className="flex items-start justify-between gap-3 text-sm transition-colors hover:text-blue-700"
                  >
                    <div className="min-w-0 flex min-h-12 flex-1 gap-3">
                      <span className="relative h-16 w-16 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
                        {product.thumbnail ? (
                          <Image
                            src={product.thumbnail}
                            alt={item.productName}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                            이미지 없음
                          </span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-neutral-900">{item.productName}</p>
                        {item.optionSummary && (
                          <p className="mt-1 text-xs text-neutral-500">{item.optionSummary}</p>
                        )}
                        <p className="mt-1 text-xs text-neutral-500">
                          {formatKRW(item.unitPrice.toString())} / {item.quantity}개
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 self-center font-bold text-neutral-900">
                      {formatKRW(item.totalPrice.toString())}
                    </span>
                  </Link>
                );
              })()}
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
          {(isBankTransfer || asString(depositDisplayName) || asString(depositorName)) && (
            <div className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
              <p className="font-semibold text-neutral-900">
                {isBankTransfer ? '입금해야 하는 계좌' : '입금 정보'}
              </p>
              {depositDisplayName && <p className="mt-1">{asString(depositDisplayName)}</p>}
              {depositorName && (
                <p className="mt-1">입금자명: {depositorName}</p>
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
          {order.memo && <p className="mt-2 text-neutral-500">배송 메모: {order.memo}</p>}
        </div>
      </section>

      {canCancel ? (
        <form action={cancelAction} className="mt-4 rounded-lg bg-white p-5">
          <h2 className="text-base font-bold text-neutral-900">주문취소</h2>
          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">취소 사유</span>
            <textarea
              name="reason"
              rows={3}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-lg border border-red-200 bg-red-50 px-5 text-sm font-semibold text-red-600"
          >
            주문취소
          </button>
        </form>
      ) : (
        <div className="mt-4 rounded-lg bg-white p-5 text-sm text-neutral-600">
          배송 준비 이후에는 고객센터로 취소를 요청해 주세요.
        </div>
      )}
    </div>
  );
}
