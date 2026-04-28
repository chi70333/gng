// Legacy sources: wb_admin/trade_order.php, wb_admin/status_change.php
// Cache: no-store. Admin order list must reflect live payment/shipping state.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { Download } from 'lucide-react';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { formatKRW, formatNumber } from '@/lib/format';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { adminOrderListQuerySchema } from '@/schemas/admin-order';
import { bulkUpdateAdminOrders, updateAdminOrderStatus } from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '주문 관리',
  description: '레거시 관리자 주문 조회 화면과 동일한 조건으로 주문을 관리합니다.',
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

const PAYMENT_LABELS: Record<string, string> = {
  card: '카드결제',
  hand: '휴대폰',
  iche: '계좌이체',
  cyber: '가상계좌',
  bank: '무통장입금',
  vbank: '가상계좌',
  npay: '네이버페이',
  kakao: '간편결제',
  point: '마일리지',
};

const LIST_COUNTS = [20, 50, 100, 200, 500, 1000];

type OrderSearchParams = {
  card?: string;
  paym?: string;
  status?: string;
  search?: string;
  searchstring?: string;
  year?: string;
  month?: string;
  day?: string;
  year2?: string;
  month2?: string;
  day2?: string;
  serhs?: string;
  fis?: string;
  trade_list_cnt?: string;
  page?: string;
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function defaultDateParts() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: 1,
    year2: now.getFullYear(),
    month2: now.getMonth() + 1,
    day2: now.getDate(),
  };
}

function dateValue(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function getDateRange(query: ReturnType<typeof adminOrderListQuerySchema.parse>) {
  const defaults = defaultDateParts();
  const startParts = {
    year: query.year ?? defaults.year,
    month: query.month ?? defaults.month,
    day: query.day ?? defaults.day,
  };
  const endParts = {
    year: query.year2 ?? defaults.year2,
    month: query.month2 ?? defaults.month2,
    day: query.day2 ?? defaults.day2,
  };
  const start = new Date(startParts.year, startParts.month - 1, startParts.day);
  const endExclusive = new Date(endParts.year, endParts.month - 1, endParts.day + 1);
  return { startParts, endParts, start, endExclusive };
}

function buildSearchWhere(field: string, keyword: string): Prisma.OrderWhereInput | null {
  if (!keyword) return null;
  const contains = { contains: keyword, mode: Prisma.QueryMode.insensitive };

  if (field === 't.tradecode') return { orderNo: contains };
  if (field === 't.userid') return { user: { OR: [{ loginId: contains }, { email: contains }] } };
  if (field === 't.name') return { user: { name: contains } };
  if (field === 'g.name') return { items: { some: { productName: contains } } };
  if (field === 't.ceo_name') return { memo: contains };
  if (field === 't.rname') return { OR: [{ user: { name: contains } }, { memo: contains }] };

  return {
    OR: [
      { orderNo: contains },
      { user: { name: contains } },
      { user: { loginId: contains } },
      { user: { email: contains } },
      { memo: contains },
      { items: { some: { productName: contains } } },
    ],
  };
}

function buildPayMethodWhere(paym: string): Prisma.OrderWhereInput | null {
  if (paym === '0') return null;
  const methodMap: Record<string, string[]> = {
    card: ['card'],
    hand: ['hand'],
    iche: ['iche', 'transfer'],
    cyber: ['cyber', 'vbank'],
    bank: ['bank', 'vbank'],
    point: ['point'],
  };
  return { payments: { some: { method: { in: methodMap[paym] ?? [paym] } } } };
}

function buildSimplePayWhere(card: string): Prisma.OrderWhereInput | null {
  if (card === '0') return null;
  const simpleProviders = ['npay', 'naverpay', 'kakao', 'kakaopay', 'payco', 'tosspay'];
  if (card === '1') return { payments: { some: { provider: { in: simpleProviders } } } };
  return {
    OR: [
      { payments: { none: { provider: { in: simpleProviders } } } },
      { payments: { some: { provider: null } } },
    ],
  };
}

function readJsonString(value: unknown, keys: string[]): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const result = record[key];
    if (typeof result === 'string' && result.trim()) return result;
  }
  return '';
}

function orderSourceLabel(order: { payments: { provider: string | null }[]; userId: bigint | null }) {
  if (order.payments.some((payment) => payment.provider?.toLowerCase().includes('npay'))) return 'N';
  return order.userId ? 'PC' : '비회원';
}

function appendParams(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value === undefined || value === '' || value === '0') return;
  params.set(key, String(value));
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: OrderSearchParams;
}) {
  await requireAdmin('order.read');
  const query = adminOrderListQuerySchema.parse(searchParams);
  const { startParts, endParts, start, endExclusive } = getDateRange(query);

  const and: Prisma.OrderWhereInput[] = [{ deletedAt: null }];
  if (query.status !== '-' && query.status !== '11') and.push({ status: query.status });
  if (query.serhs) and.push({ createdAt: { gte: start, lt: endExclusive } });

  const searchWhere = buildSearchWhere(query.search, query.searchstring);
  if (searchWhere) and.push(searchWhere);

  const paymentWhere = buildPayMethodWhere(query.paym);
  if (paymentWhere) and.push(paymentWhere);

  const simplePayWhere = buildSimplePayWhere(query.card);
  if (simplePayWhere) and.push(simplePayWhere);

  const where: Prisma.OrderWhereInput = { AND: and };
  const pageSize = query.trade_list_cnt;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [orderRows, todayCount] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * pageSize,
      take: pageSize + 1,
      select: {
        id: true,
        orderNo: true,
        status: true,
        subtotal: true,
        pointsUsed: true,
        total: true,
        createdAt: true,
        userId: true,
        buyerInfo: true,
        user: { select: { loginId: true, email: true, name: true } },
        items: { select: { productName: true, quantity: true }, orderBy: { id: 'asc' } },
        payments: { select: { method: true, provider: true }, orderBy: { createdAt: 'desc' } },
        shipments: { select: { carrier: true, trackingNo: true, status: true }, take: 1 },
      },
    }),
    prisma.order.count({ where: { deletedAt: null, createdAt: { gte: todayStart, lt: todayEnd } } }),
  ]);
  const hasNext = orderRows.length > pageSize;
  const orders = orderRows.slice(0, pageSize);
  const [total, totals] =
    query.page > 1 || hasNext || orders.length > 0
      ? await Promise.all([
          prisma.order.count({ where }),
          prisma.order.aggregate({ where, _sum: { total: true, subtotal: true, pointsUsed: true } }),
        ])
      : [
          0,
          { _sum: { total: null, subtotal: null, pointsUsed: null } },
        ];

  const params = new URLSearchParams();
  appendParams(params, 'card', query.card);
  appendParams(params, 'paym', query.paym);
  if (query.status !== '-') params.set('status', query.status);
  if (query.search !== 'total') params.set('search', query.search);
  appendParams(params, 'searchstring', query.searchstring);
  params.set('year', String(startParts.year));
  params.set('month', pad2(startParts.month));
  params.set('day', pad2(startParts.day));
  params.set('year2', String(endParts.year));
  params.set('month2', pad2(endParts.month));
  params.set('day2', pad2(endParts.day));
  params.set('serhs', String(query.serhs));
  params.set('fis', query.fis);
  params.set('trade_list_cnt', String(pageSize));
  const baseHref = `/admin/orders?${params.toString()}`;
  const exportHref = `/api/admin/orders/export?${params.toString()}`;
  const totalAmount = totals._sum.total ?? new Prisma.Decimal(0);
  const mileageIncludedTotal = totalAmount.plus(totals._sum.pointsUsed ?? 0);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-neutral-950">주문 관리</h1>
        </div>
        <p className="text-sm font-bold text-blue-700">
          오늘 주문: <span className="text-base">{formatNumber(todayCount)}</span>건
        </p>
      </div>
      <div className="mt-3 flex justify-end">
        <Link
          href={exportHref}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-800 hover:bg-neutral-50"
        >
          <Download size={18} />
          엑셀 다운로드
        </Link>
      </div>

      <form className="mt-5 border border-neutral-300 bg-[#f5f5f5] p-3 text-xs" method="get">
        <div className="flex flex-wrap items-center gap-2">
          <select name="card" defaultValue={query.card} className="h-7 w-[104px] border border-neutral-400 bg-white px-1">
            <option value="0">결제구분</option>
            <option value="2">일반결제</option>
            <option value="1">간편결제</option>
          </select>
          <select name="paym" defaultValue={query.paym} className="h-7 w-[104px] border border-neutral-400 bg-white px-1">
            <option value="0">결제방법</option>
            <option value="card">카드결제</option>
            <option value="hand">휴대폰</option>
            <option value="iche">계좌이체</option>
            <option value="cyber">가상계좌</option>
            <option value="bank">무통장입금</option>
          </select>
          <select name="status" defaultValue={query.status} className="h-7 w-[112px] border border-neutral-400 bg-white px-1">
            <option value="-">전체 상태</option>
            <option value="11">주문통합</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <select name="search" defaultValue={query.search} className="ml-0 h-7 w-[112px] border border-neutral-400 bg-white px-1 md:ml-5">
            <option value="total">통합검색</option>
            <option value="t.name">주문자명</option>
            <option value="t.ceo_name">회사명</option>
            <option value="t.tradecode">주문코드</option>
            <option value="t.userid">주문자 아이디</option>
            <option value="t.rname">수령자</option>
            <option value="g.name">상품명</option>
          </select>
          <input
            name="searchstring"
            defaultValue={query.searchstring}
            className="h-7 w-[130px] border border-neutral-400 bg-white px-2"
            aria-label="검색어"
          />
          <button className="h-12 w-[60px] rounded bg-black text-xs font-bold text-white">
            검색
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1">
          <input type="hidden" name="serhs" value="1" />
          <input type="hidden" name="fis" value="2" />
          <select name="year" defaultValue={startParts.year} className="h-7 w-[72px] border border-neutral-400 bg-white px-1">
            {Array.from({ length: new Date().getFullYear() - 2017 }, (_, index) => 2018 + index).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <span>년</span>
          <select name="month" defaultValue={startParts.month} className="h-7 w-[52px] border border-neutral-400 bg-white px-1">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
              <option key={month} value={month}>
                {pad2(month)}
              </option>
            ))}
          </select>
          <span>월</span>
          <select name="day" defaultValue={startParts.day} className="h-7 w-[52px] border border-neutral-400 bg-white px-1">
            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>
                {pad2(day)}
              </option>
            ))}
          </select>
          <span>일</span>
          <span className="mx-1">~</span>
          <select name="year2" defaultValue={endParts.year} className="h-7 w-[72px] border border-neutral-400 bg-white px-1">
            {Array.from({ length: new Date().getFullYear() - 2017 }, (_, index) => 2018 + index).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <span>년</span>
          <select name="month2" defaultValue={endParts.month} className="h-7 w-[52px] border border-neutral-400 bg-white px-1">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
              <option key={month} value={month}>
                {pad2(month)}
              </option>
            ))}
          </select>
          <span>월</span>
          <select name="day2" defaultValue={endParts.day} className="h-7 w-[52px] border border-neutral-400 bg-white px-1">
            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>
                {pad2(day)}
              </option>
            ))}
          </select>
          <span>일</span>
          <select name="trade_list_cnt" defaultValue={pageSize} className="ml-0 h-7 w-[120px] border border-neutral-400 bg-white px-1 md:ml-auto">
            {LIST_COUNTS.map((count) => (
              <option key={count} value={count}>
                목록 {count}개씩
              </option>
            ))}
          </select>
        </div>
      </form>

      <form id="bulkOrderForm" action={bulkUpdateAdminOrders} className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-xs">
        <input type="hidden" name="card" value={query.card} />
        <input type="hidden" name="paym" value={query.paym} />
        <input type="hidden" name="status" value={query.status} />
        <input type="hidden" name="search" value={query.search} />
        <input type="hidden" name="searchstring" value={query.searchstring} />
        <input type="hidden" name="year" value={startParts.year} />
        <input type="hidden" name="month" value={pad2(startParts.month)} />
        <input type="hidden" name="day" value={pad2(startParts.day)} />
        <input type="hidden" name="year2" value={endParts.year} />
        <input type="hidden" name="month2" value={pad2(endParts.month)} />
        <input type="hidden" name="day2" value={pad2(endParts.day)} />
        <input type="hidden" name="serhs" value={query.serhs} />
        <input type="hidden" name="fis" value={query.fis} />
        <input type="hidden" name="trade_list_cnt" value={pageSize} />
        <span className="font-bold text-neutral-700">선택 주문</span>
        <select name="bulkStatus" defaultValue="paid" className="h-8 rounded border border-neutral-300 bg-white px-2">
          {STATUS_OPTIONS.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
        <button name="intent" value="status" className="h-8 rounded bg-neutral-900 px-3 font-bold text-white">
          상태 일괄변경
        </button>
        <button name="intent" value="delete" className="h-8 rounded border border-red-200 bg-red-50 px-3 font-bold text-red-700">
          선택 삭제
        </button>
        <button
          formAction="/api/admin/orders/export"
          formMethod="get"
          className="h-8 rounded border border-neutral-200 bg-white px-3 font-bold text-neutral-800 hover:bg-neutral-50"
        >
          선택 엑셀
        </button>
      </form>

      <div className="mt-4 w-full overflow-x-auto border border-neutral-300 bg-white">
        <table className="w-full min-w-[1180px] border-collapse text-xs">
          <thead>
            <tr className="h-8 bg-[#d7f0fa] text-center font-bold">
              <th className="w-10 border border-neutral-300">선택</th>
              <th className="min-w-[170px] border border-neutral-300">주문상품</th>
              <th className="w-[130px] border border-neutral-300">주문일시</th>
              <th className="w-[100px] border border-neutral-300">회사명</th>
              <th className="w-[110px] border border-neutral-300">주문자</th>
              <th className="w-[80px] border border-neutral-300">회원구분</th>
              <th className="w-[150px] border border-neutral-300">
                <span className="block text-[11px] font-normal text-red-600">m:마일리지, c:쿠폰</span>
                결제금액
              </th>
              <th className="w-[90px] border border-neutral-300">결제방식</th>
              <th className="w-[70px] border border-neutral-300">주문경로</th>
              <th className="w-[130px] border border-neutral-300">주문상태</th>
              <th className="w-[70px] border border-neutral-300">자료</th>
              <th className="w-[110px] border border-neutral-300">배송방법</th>
              <th className="w-[70px] border border-neutral-300">SMS</th>
              <th className="w-[80px] border border-neutral-300">입금/환불</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={14} className="h-24 border border-neutral-300 text-center">
                  주문 내역이 없습니다.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const firstItem = order.items[0];
                const itemLabel = firstItem
                  ? order.items.length > 1
                    ? `${firstItem.productName.slice(0, 10)} 상품 외 ${order.items.length - 1}`
                    : firstItem.productName
                  : '주문 상품 없음';
                const payment = order.payments[0];
                const shipment = order.shipments[0];
                const buyerName = order.user?.name || readJsonString(order.buyerInfo, ['name', 'receiver']) || '비회원';
                const companyName = readJsonString(order.buyerInfo, ['company', 'companyName', 'ceoName']);
                const memberType = order.userId ? '일반회원' : '비회원';
                const paymentLabel = payment
                  ? PAYMENT_LABELS[payment.method] ?? PAYMENT_LABELS[payment.provider ?? ''] ?? payment.method
                  : '-';

                return (
                  <tr key={order.orderNo} className="bg-[#fafafa] hover:bg-[#e4fff4]">
                    <td className="h-10 border border-neutral-300 text-center">
                      <input form="bulkOrderForm" type="checkbox" name="orderNo" value={order.orderNo} aria-label={`${order.orderNo} 선택`} />
                    </td>
                    <td className="border border-neutral-300 px-2 font-bold">
                      <Link href={`/admin/orders/${order.orderNo}`} className="text-neutral-950 hover:underline">
                        {itemLabel}
                      </Link>
                      {dateValue(order.createdAt.getFullYear(), order.createdAt.getMonth() + 1, order.createdAt.getDate()) ===
                      dateValue(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()) ? (
                        <span className="float-right text-[11px] font-bold text-red-600">NEW</span>
                      ) : null}
                    </td>
                    <td className="border border-neutral-300 text-center text-red-700">
                      {order.createdAt.toLocaleString('ko-KR').replace(/-/g, '.')}
                    </td>
                    <td className="border border-neutral-300 text-center">{companyName || '-'}</td>
                    <td className="border border-neutral-300 text-center text-[#6600ff]">{buyerName}</td>
                    <td className="border border-neutral-300 text-center">{memberType}</td>
                    <td className="border border-neutral-300 px-2 text-right">
                      {order.pointsUsed ? (
                        <div className="text-left text-[11px] text-blue-700">m:-{formatNumber(order.pointsUsed)}</div>
                      ) : null}
                      <strong className="text-[#cc0000]">{formatKRW(order.total.toString())}</strong>
                    </td>
                    <td className="border border-neutral-300 text-center text-red-700">{paymentLabel}</td>
                    <td className="border border-neutral-300 text-center">{orderSourceLabel(order)}</td>
                    <td className="border border-neutral-300 px-2">
                      <form action={updateAdminOrderStatus} className="flex items-center gap-1">
                        <input type="hidden" name="orderNo" value={order.orderNo} />
                        <select name="status" defaultValue={order.status} className="h-7 w-[92px] border border-neutral-400 bg-white text-[11px]">
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                        <button className="h-7 rounded border border-neutral-500 px-1 text-[11px]">저장</button>
                      </form>
                    </td>
                    <td className="border border-neutral-300 text-center">-</td>
                    <td className="border border-neutral-300 text-center">
                      {shipment ? (
                        <>
                          {shipment.carrier ?? '-'}
                          <br />
                          {shipment.trackingNo ?? '-'}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="border border-neutral-300 text-center">
                      <button className="h-6 w-[50px] rounded border border-neutral-500 bg-neutral-100 text-[11px]">
                        SMS
                      </button>
                    </td>
                    <td className="border border-neutral-300 text-center">X</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-right text-sm font-bold">
        주문건수: {formatNumber(total)}건 | 합계금액: {formatKRW(totalAmount.toString())} | 마일리지 포함:{' '}
        {formatKRW(mileageIncludedTotal.toString())}
      </div>

      <AdminPagination baseHref={baseHref} page={query.page} hasNext={hasNext} />
    </div>
  );
}
