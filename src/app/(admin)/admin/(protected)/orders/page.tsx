// Legacy sources: wb_admin/trade_order.php, wb_admin/status_change.php
// Cache: no-store. Admin order list must reflect live payment/shipping state.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Prisma } from '@prisma/client';
import {
  CalendarDays,
  Check,
  CircleAlert,
  Download,
  Filter,
  RotateCcw,
  Search,
} from 'lucide-react';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { formatKRW, formatKoreanDateTime, formatNumber } from '@/lib/format';
import {
  getKoreanDateParts,
  koreanDateRangeUtc,
  type KoreanDateParts,
} from '@/lib/korean-date-range';
import {
  AdminDataGrid,
  type AdminSortDirection,
  AdminMobileCard,
  AdminMobileField,
  adminGridButtonClass,
  adminGridCellClass,
  adminGridStickyCellClass,
} from '@/components/admin/AdminDataGrid';
import { AdminGridSelectAll } from '@/components/admin/AdminGridSelectAll';
import { AdminPageSizeSelect } from '@/components/admin/AdminPageSizeSelect';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  AdminPageHeader,
  AdminSection,
  adminDangerButtonClass,
  adminFieldClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from '@/components/admin/AdminUI';
import {
  ADMIN_ORDER_MILEAGE_EXCEPTION_QUERY,
  ADMIN_ORDER_MILEAGE_EXCEPTION_VALUE,
  adminOrderListQuerySchema,
} from '@/schemas/admin-order';
import { bulkUpdateAdminOrders, updateAdminOrderStatus } from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '주문 관리',
  description: '관리자 주문 조회 조건으로 주문을 관리합니다.',
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

const LIST_COUNTS = [20, 30, 50, 100, 200, 500, 1000];
const orderFilterLabelClass = 'grid min-w-0 gap-1.5 text-xs font-extrabold text-neutral-600';
const orderFilterFieldClass = `${adminFieldClass} h-11 sm:h-10`;
const compactDateSelectClass = `${adminFieldClass} h-11 px-2 text-sm shadow-none sm:h-9 sm:px-1.5 sm:text-xs`;
const compactDateUnitClass = 'text-[11px] font-bold text-neutral-500';

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
  point_min?: string;
  point_max?: string;
  exception?: string;
  trade_list_cnt?: string;
  page?: string;
  sort?: string;
  dir?: string;
};

const ORDER_SORT_KEYS = ['no', 'orderNo', 'createdAt', 'buyer', 'total', 'status'] as const;
type OrderSortKey = (typeof ORDER_SORT_KEYS)[number];

function parseOrderSort(searchParams: OrderSearchParams): {
  sort?: OrderSortKey;
  dir: AdminSortDirection;
} {
  const sort = ORDER_SORT_KEYS.includes(searchParams.sort as OrderSortKey)
    ? (searchParams.sort as OrderSortKey)
    : undefined;
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc';
  return { sort, dir };
}

function orderOrderBy(
  sort: OrderSortKey,
  dir: AdminSortDirection,
): Prisma.OrderOrderByWithRelationInput {
  if (sort === 'orderNo') return { orderNo: dir };
  if (sort === 'createdAt' || sort === 'no') return { createdAt: dir };
  if (sort === 'buyer') return { user: { name: dir } };
  if (sort === 'total') return { total: dir };
  if (sort === 'status') return { status: dir };
  return { createdAt: dir };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function defaultDateParts() {
  const now = getKoreanDateParts();
  return {
    year: now.year,
    month: now.month,
    day: 1,
    year2: now.year,
    month2: now.month,
    day2: now.day,
  };
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  const targetDate = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(targetDate, lastDay));
  return next;
}

function sameDateParts(a: KoreanDateParts, b: KoreanDateParts): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
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
  const { start } = koreanDateRangeUtc(startParts);
  const { endExclusive } = koreanDateRangeUtc(endParts);
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

function buildPointsUsedWhere(
  min: number | undefined,
  max: number | undefined,
): Prisma.OrderWhereInput | null {
  if (min == null && max == null) return null;
  return {
    pointsUsed: {
      ...(min == null ? {} : { gte: min }),
      ...(max == null ? {} : { lte: max }),
    },
  };
}

function isMileageExceptionQuery(exception: string | undefined): boolean {
  return exception === ADMIN_ORDER_MILEAGE_EXCEPTION_QUERY;
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

function orderSourceLabel(order: {
  payments: { provider: string | null }[];
  userId: bigint | null;
}) {
  if (order.payments.some((payment) => payment.provider?.toLowerCase().includes('npay')))
    return 'N';
  return order.userId ? 'PC' : '비회원';
}

function orderStatusLabel(status: string): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
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
  const query = adminOrderListQuerySchema.parse(
    isMileageExceptionQuery(searchParams.exception) && searchParams.serhs == null
      ? { ...searchParams, serhs: '0' }
      : searchParams,
  );
  const sortState = parseOrderSort(searchParams);
  const { startParts, endParts, start, endExclusive } = getDateRange(query);

  const and: Prisma.OrderWhereInput[] = [{ deletedAt: null }];
  if (query.exception === ADMIN_ORDER_MILEAGE_EXCEPTION_QUERY) {
    and.push({ pointsUsed: { not: ADMIN_ORDER_MILEAGE_EXCEPTION_VALUE } });
  }
  if (query.status !== '-' && query.status !== '11') and.push({ status: query.status });
  if (query.serhs) and.push({ createdAt: { gte: start, lt: endExclusive } });

  const searchWhere = buildSearchWhere(query.search, query.searchstring);
  if (searchWhere) and.push(searchWhere);

  const paymentWhere = buildPayMethodWhere(query.paym);
  if (paymentWhere) and.push(paymentWhere);

  const simplePayWhere = buildSimplePayWhere(query.card);
  if (simplePayWhere) and.push(simplePayWhere);

  const pointsUsedWhere = buildPointsUsedWhere(query.point_min, query.point_max);
  if (pointsUsedWhere) and.push(pointsUsedWhere);

  const where: Prisma.OrderWhereInput = { AND: and };
  const pageSize = query.trade_list_cnt;
  const { start: todayStart, endExclusive: todayEnd } = koreanDateRangeUtc(getKoreanDateParts());

  const [orderRows, todayCount] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: orderOrderBy(sortState.sort ?? 'no', sortState.dir),
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
    prisma.order.count({
      where: {
        deletedAt: null,
        createdAt: { gte: todayStart, lt: todayEnd },
        ...(query.exception === ADMIN_ORDER_MILEAGE_EXCEPTION_QUERY
          ? { pointsUsed: { not: ADMIN_ORDER_MILEAGE_EXCEPTION_VALUE } }
          : {}),
      },
    }),
  ]);
  const hasNext = orderRows.length > pageSize;
  const orders = orderRows.slice(0, pageSize);
  const [total, totals] =
    query.page > 1 || hasNext || orders.length > 0
      ? await Promise.all([
          prisma.order.count({ where }),
          prisma.order.aggregate({
            where,
            _sum: { total: true, subtotal: true, pointsUsed: true },
          }),
        ])
      : [0, { _sum: { total: null, subtotal: null, pointsUsed: null } }];

  const params = new URLSearchParams();
  if (query.exception === ADMIN_ORDER_MILEAGE_EXCEPTION_QUERY) {
    params.set('exception', ADMIN_ORDER_MILEAGE_EXCEPTION_QUERY);
  }
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
  appendParams(params, 'point_min', query.point_min);
  appendParams(params, 'point_max', query.point_max);
  params.set('trade_list_cnt', String(pageSize));
  if (sortState.sort) {
    params.set('sort', sortState.sort);
    params.set('dir', sortState.dir);
  }
  const baseHref = `/admin/orders?${params.toString()}`;
  const exportHref = `/api/admin/orders/export?${params.toString()}`;
  const isMileageException = query.exception === ADMIN_ORDER_MILEAGE_EXCEPTION_QUERY;
  const resetHref = isMileageException
    ? `/admin/orders?exception=${ADMIN_ORDER_MILEAGE_EXCEPTION_QUERY}`
    : '/admin/orders';
  const totalAmount = totals._sum.total ?? new Prisma.Decimal(0);
  const mileageIncludedTotal = totalAmount.plus(totals._sum.pointsUsed ?? 0);
  const getSortHref = (sort: string, dir: AdminSortDirection) => {
    const nextParams = new URLSearchParams(params);
    if (nextParams.get('sort') === sort) {
      nextParams.delete('sort');
      nextParams.delete('dir');
    } else {
      nextParams.set('sort', sort);
      nextParams.set('dir', dir);
    }
    nextParams.delete('page');
    const nextQuery = nextParams.toString();
    return nextQuery ? `/admin/orders?${nextQuery}` : resetHref;
  };
  const today = new Date();
  const todayParts = getKoreanDateParts(today);
  const periodShortcuts = [
    { label: '오늘', start: todayParts, end: todayParts },
    { label: '7일', start: getKoreanDateParts(addDays(today, -6)), end: todayParts },
    { label: '15일', start: getKoreanDateParts(addDays(today, -14)), end: todayParts },
    { label: '1개월', start: getKoreanDateParts(addMonths(today, -1)), end: todayParts },
    { label: '3개월', start: getKoreanDateParts(addMonths(today, -3)), end: todayParts },
    { label: '이번달', start: { ...todayParts, day: 1 }, end: todayParts },
  ];
  const getPeriodHref = (start: KoreanDateParts, end: KoreanDateParts) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set('year', String(start.year));
    nextParams.set('month', pad2(start.month));
    nextParams.set('day', pad2(start.day));
    nextParams.set('year2', String(end.year));
    nextParams.set('month2', pad2(end.month));
    nextParams.set('day2', pad2(end.day));
    nextParams.set('serhs', '1');
    nextParams.delete('page');
    return `/admin/orders?${nextParams.toString()}`;
  };
  const defaultParts = defaultDateParts();
  const hasFilters =
    query.card !== '0' ||
    query.paym !== '0' ||
    query.status !== '-' ||
    query.search !== 'total' ||
    query.searchstring !== '' ||
    query.point_min != null ||
    query.point_max != null ||
    startParts.year !== defaultParts.year ||
    startParts.month !== defaultParts.month ||
    startParts.day !== defaultParts.day ||
    endParts.year !== defaultParts.year2 ||
    endParts.month !== defaultParts.month2 ||
    endParts.day !== defaultParts.day2;
  const activeFilterCount = [
    query.card !== '0',
    query.paym !== '0',
    query.status !== '-',
    query.search !== 'total' || query.searchstring !== '',
    query.point_min != null || query.point_max != null,
    startParts.year !== defaultParts.year ||
      startParts.month !== defaultParts.month ||
      startParts.day !== defaultParts.day ||
      endParts.year !== defaultParts.year2 ||
      endParts.month !== defaultParts.month2 ||
      endParts.day !== defaultParts.day2,
  ].filter(Boolean).length;

  return (
    <div className="min-w-0 space-y-4">
      <AdminPageHeader
        title={isMileageException ? '예외주문' : '주문 관리'}
        description={
          <>
            {isMileageException ? '오늘 예외주문' : '오늘 주문'}{' '}
            <span className="font-bold text-blue-700">{formatNumber(todayCount)}건</span>
          </>
        }
        actions={
          <Link href={exportHref} className={adminSecondaryButtonClass}>
            <Download size={18} />
            엑셀 다운로드
          </Link>
        }
      />

      <AdminSection
        title="조회 조건"
        description={
          activeFilterCount > 0
            ? `${formatNumber(activeFilterCount)}개 조건 적용 중`
            : isMileageException
              ? '마일리지 2,000,000원 사용 주문 제외'
              : '전체 주문 기준'
        }
        icon={Filter}
        bodyClassName="p-0"
      >
        <form className="p-3 sm:p-4" method="get">
          <input type="hidden" name="serhs" value={isMileageException ? query.serhs : 1} />
          {isMileageException ? (
            <input type="hidden" name="exception" value={ADMIN_ORDER_MILEAGE_EXCEPTION_QUERY} />
          ) : null}
          <input type="hidden" name="fis" value="2" />
          <input type="hidden" name="trade_list_cnt" value={pageSize} />

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={orderFilterLabelClass}>
                결제구분
                <select name="card" defaultValue={query.card} className={orderFilterFieldClass}>
                  <option value="0">전체 결제</option>
                  <option value="2">일반결제</option>
                  <option value="1">간편결제</option>
                </select>
              </label>
              <label className={orderFilterLabelClass}>
                결제방법
                <select name="paym" defaultValue={query.paym} className={orderFilterFieldClass}>
                  <option value="0">전체 방법</option>
                  <option value="card">카드결제</option>
                  <option value="hand">휴대폰</option>
                  <option value="iche">계좌이체</option>
                  <option value="cyber">가상계좌</option>
                  <option value="bank">무통장입금</option>
                </select>
              </label>
              <label className={orderFilterLabelClass}>
                주문상태
                <select name="status" defaultValue={query.status} className={orderFilterFieldClass}>
                  <option value="-">전체 상태</option>
                  <option value="11">주문통합</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
              <label className={orderFilterLabelClass}>
                검색대상
                <select name="search" defaultValue={query.search} className={orderFilterFieldClass}>
                  <option value="total">통합검색</option>
                  <option value="t.name">주문자명</option>
                  <option value="t.ceo_name">회사명</option>
                  <option value="t.tradecode">주문코드</option>
                  <option value="t.userid">주문자 아이디</option>
                  <option value="t.rname">수령자</option>
                  <option value="g.name">상품명</option>
                </select>
              </label>
              <label className={orderFilterLabelClass}>
                검색어
                <input
                  name="searchstring"
                  defaultValue={query.searchstring}
                  placeholder="주문번호, 이름, 아이디, 상품명"
                  className={orderFilterFieldClass}
                />
              </label>
            </div>
          </div>

          <div className="mt-4 grid gap-3 border-t border-neutral-100 pt-4 xl:grid-cols-[minmax(0,760px)_minmax(220px,280px)_auto] xl:items-end">
            <fieldset className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50/70 p-3">
              <legend className="sr-only">조회기간</legend>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-extrabold text-neutral-700">
                  <CalendarDays size={16} className="text-neutral-500" />
                  조회기간
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {periodShortcuts.map((shortcut) => {
                    const isActive =
                      Boolean(query.serhs) &&
                      sameDateParts(startParts, shortcut.start) &&
                      sameDateParts(endParts, shortcut.end);
                    return (
                      <Link
                        key={shortcut.label}
                        href={getPeriodHref(shortcut.start, shortcut.end)}
                        aria-label={`${shortcut.label} 주문 조회기간 적용`}
                        className={`inline-flex min-h-9 items-center justify-center rounded border px-2.5 text-xs font-bold transition sm:min-h-8 ${
                          isActive
                            ? 'border-neutral-900 bg-neutral-900 text-white'
                            : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 hover:bg-neutral-50'
                        }`}
                      >
                        {shortcut.label}
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] lg:items-end">
                <div className="grid gap-1.5">
                  <span className="text-[11px] font-bold text-neutral-500">시작일</span>
                  <div className="grid grid-cols-[minmax(84px,96px)_auto_minmax(58px,68px)_auto_minmax(58px,68px)_auto] items-center gap-1.5">
                    <select
                      name="year"
                      defaultValue={startParts.year}
                      aria-label="조회 시작 연도"
                      className={compactDateSelectClass}
                    >
                      {Array.from(
                        { length: new Date().getFullYear() - 2017 },
                        (_, index) => 2018 + index,
                      ).map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <span className={compactDateUnitClass}>년</span>
                    <select
                      name="month"
                      defaultValue={startParts.month}
                      aria-label="조회 시작 월"
                      className={compactDateSelectClass}
                    >
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                        <option key={month} value={month}>
                          {pad2(month)}
                        </option>
                      ))}
                    </select>
                    <span className={compactDateUnitClass}>월</span>
                    <select
                      name="day"
                      defaultValue={startParts.day}
                      aria-label="조회 시작 일"
                      className={compactDateSelectClass}
                    >
                      {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                        <option key={day} value={day}>
                          {pad2(day)}
                        </option>
                      ))}
                    </select>
                    <span className={compactDateUnitClass}>일</span>
                  </div>
                </div>

                <span className="hidden pb-2 text-center text-xs font-extrabold text-neutral-400 lg:block">
                  ~
                </span>

                <div className="grid gap-1.5">
                  <span className="text-[11px] font-bold text-neutral-500">종료일</span>
                  <div className="grid grid-cols-[minmax(84px,96px)_auto_minmax(58px,68px)_auto_minmax(58px,68px)_auto] items-center gap-1.5">
                    <select
                      name="year2"
                      defaultValue={endParts.year}
                      aria-label="조회 종료 연도"
                      className={compactDateSelectClass}
                    >
                      {Array.from(
                        { length: new Date().getFullYear() - 2017 },
                        (_, index) => 2018 + index,
                      ).map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <span className={compactDateUnitClass}>년</span>
                    <select
                      name="month2"
                      defaultValue={endParts.month}
                      aria-label="조회 종료 월"
                      className={compactDateSelectClass}
                    >
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                        <option key={month} value={month}>
                          {pad2(month)}
                        </option>
                      ))}
                    </select>
                    <span className={compactDateUnitClass}>월</span>
                    <select
                      name="day2"
                      defaultValue={endParts.day}
                      aria-label="조회 종료 일"
                      className={compactDateSelectClass}
                    >
                      {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                        <option key={day} value={day}>
                          {pad2(day)}
                        </option>
                      ))}
                    </select>
                    <span className={compactDateUnitClass}>일</span>
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset className="grid min-w-0 gap-1.5">
              <legend className="text-xs font-extrabold text-neutral-600">마일리지 사용량</legend>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <input
                  type="number"
                  name="point_min"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  defaultValue={query.point_min ?? ''}
                  placeholder="최소"
                  aria-label="마일리지 최소 사용량"
                  className={orderFilterFieldClass}
                />
                <span className="text-xs font-extrabold text-neutral-400">~</span>
                <input
                  type="number"
                  name="point_max"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  defaultValue={query.point_max ?? ''}
                  placeholder="최대"
                  aria-label="마일리지 최대 사용량"
                  className={orderFilterFieldClass}
                />
              </div>
            </fieldset>

            <div
              className={
                hasFilters
                  ? 'grid grid-cols-2 gap-2 xl:flex xl:justify-end'
                  : 'grid gap-2 xl:flex xl:justify-end'
              }
            >
              <button className={`${adminPrimaryButtonClass} h-11 px-4`}>
                <Search size={17} />
                검색
              </button>
              {hasFilters ? (
                <Link href={resetHref} className={`${adminSecondaryButtonClass} h-11 px-4`}>
                  <RotateCcw size={16} />
                  초기화
                </Link>
              ) : null}
            </div>
          </div>
        </form>
      </AdminSection>

      <form
        id="bulkOrderForm"
        action={bulkUpdateAdminOrders}
        className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-xs shadow-[0_8px_24px_rgba(15,23,42,0.045)] ring-1 ring-white"
      >
        <input type="hidden" name="redirectTo" value={baseHref} />
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
        {query.point_min != null ? (
          <input type="hidden" name="point_min" value={query.point_min} />
        ) : null}
        {query.point_max != null ? (
          <input type="hidden" name="point_max" value={query.point_max} />
        ) : null}
        {isMileageException ? (
          <input type="hidden" name="exception" value={ADMIN_ORDER_MILEAGE_EXCEPTION_QUERY} />
        ) : null}
        <input type="hidden" name="trade_list_cnt" value={pageSize} />
        <span className="font-bold text-neutral-700">선택 주문</span>
        <select name="bulkStatus" defaultValue="paid" className={adminFieldClass}>
          {STATUS_OPTIONS.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
        <button name="intent" value="status" className={adminPrimaryButtonClass}>
          상태 일괄변경
        </button>
        <button name="intent" value="delete" className={adminDangerButtonClass}>
          선택 삭제
        </button>
        <button
          formAction="/api/admin/orders/export"
          formMethod="get"
          className={adminSecondaryButtonClass}
        >
          선택 엑셀
        </button>
      </form>

      <AdminSection
        title="주문 목록"
        description={`주문건수 ${formatNumber(total)}건`}
        bodyClassName="p-0"
        headerAction={
          <AdminPageSizeSelect
            action="/admin/orders"
            name="trade_list_cnt"
            value={pageSize}
            options={LIST_COUNTS}
            hiddenFields={Array.from(params.entries()).map(([name, value]) => ({ name, value }))}
          />
        }
      >
        <AdminDataGrid
          caption="주문 목록"
          columns={[
            { key: 'no', label: 'No', align: 'right', widthClassName: 'w-20', sortKey: 'no' },
            {
              key: 'select',
              label: <AdminGridSelectAll name="orderNo" formId="bulkOrderForm" />,
              align: 'center',
              widthClassName: 'w-16',
            },
            { key: 'orderNo', label: '주문번호', widthClassName: 'w-48', sortKey: 'orderNo' },
            {
              key: 'product',
              label: '주문상품',
              widthClassName: 'min-w-[260px]',
              priority: 'primary',
            },
            {
              key: 'createdAt',
              label: '주문일시',
              align: 'right',
              widthClassName: 'w-44',
              sortKey: 'createdAt',
            },
            { key: 'company', label: '회사명', widthClassName: 'w-36' },
            { key: 'buyer', label: '주문자', widthClassName: 'w-32', sortKey: 'buyer' },
            { key: 'memberType', label: '회원구분', widthClassName: 'w-28' },
            {
              key: 'amount',
              label: '결제금액',
              align: 'right',
              widthClassName: 'w-36',
              sortKey: 'total',
            },
            { key: 'payment', label: '결제방식', align: 'center', widthClassName: 'w-32' },
            { key: 'source', label: '주문경로', align: 'center', widthClassName: 'w-24' },
            { key: 'status', label: '주문상태', widthClassName: 'w-32', sortKey: 'status' },
            { key: 'shipment', label: '배송방법', widthClassName: 'w-44' },
            { key: 'sms', label: 'SMS', align: 'center', widthClassName: 'w-24' },
          ]}
          rows={orders}
          rowKey={(order) => order.orderNo}
          emptyText="주문 내역이 없습니다."
          minWidthClassName="min-w-[1120px]"
          currentSortKey={sortState.sort}
          currentSortDirection={sortState.dir}
          getSortHref={getSortHref}
          renderRow={(order, index) => {
            const firstItem = order.items[0];
            const itemLabel = firstItem
              ? order.items.length > 1
                ? `${firstItem.productName} 외 ${order.items.length - 1}건`
                : firstItem.productName
              : '주문 상품 없음';
            const payment = order.payments[0];
            const shipment = order.shipments[0];
            const buyerName =
              order.user?.name || readJsonString(order.buyerInfo, ['name', 'receiver']) || '비회원';
            const companyName = readJsonString(order.buyerInfo, [
              'company',
              'companyName',
              'ceoName',
            ]);
            const memberType = order.userId ? '일반회원' : '비회원';
            const paymentLabel = payment
              ? (PAYMENT_LABELS[payment.method] ??
                PAYMENT_LABELS[payment.provider ?? ''] ??
                payment.method)
              : '-';
            const rowNo = total - (query.page - 1) * pageSize - index;

            return (
              <tr key={order.orderNo} className="bg-white transition hover:bg-neutral-50">
                <td className={`${adminGridCellClass} text-right font-bold text-neutral-500`}>
                  {formatNumber(rowNo)}
                </td>
                <td className={`${adminGridCellClass} text-center`}>
                  <input
                    form="bulkOrderForm"
                    type="checkbox"
                    name="orderNo"
                    value={order.orderNo}
                    aria-label={`${order.orderNo} 선택`}
                    className="h-4 w-4 rounded border-neutral-300 accent-neutral-900"
                  />
                </td>
                <td
                  className={`${adminGridCellClass} font-mono text-xs font-semibold text-blue-700`}
                >
                  <Link href={`/admin/orders/${order.orderNo}`} className="hover:underline">
                    {order.orderNo}
                  </Link>
                </td>
                <td className={adminGridStickyCellClass}>
                  <Link
                    href={`/admin/orders/${order.orderNo}`}
                    className="line-clamp-1 font-extrabold hover:text-blue-700 hover:underline"
                  >
                    {itemLabel}
                  </Link>
                </td>
                <td className={`${adminGridCellClass} text-right text-xs text-neutral-500`}>
                  {formatKoreanDateTime(order.createdAt)}
                </td>
                <td className={adminGridCellClass}>
                  <span className="line-clamp-1">{companyName || '-'}</span>
                </td>
                <td className={`${adminGridCellClass} font-bold text-neutral-950`}>{buyerName}</td>
                <td className={adminGridCellClass}>{memberType}</td>
                <td className={`${adminGridCellClass} text-right`}>
                  <strong className="block text-base text-red-700">
                    {formatKRW(order.total.toString())}
                  </strong>
                  <span
                    className={
                      order.pointsUsed > 0
                        ? 'mt-0.5 block text-[11px] font-semibold text-blue-700'
                        : 'mt-0.5 block text-[11px] font-medium text-neutral-400'
                    }
                  >
                    마일리지 {formatKRW(order.pointsUsed.toString())}
                  </span>
                </td>
                <td className={`${adminGridCellClass} text-center`}>{paymentLabel}</td>
                <td className={`${adminGridCellClass} text-center`}>{orderSourceLabel(order)}</td>
                <td className={adminGridCellClass}>
                  <form
                    action={updateAdminOrderStatus}
                    className="grid grid-cols-[minmax(82px,1fr)_28px] items-center gap-1"
                  >
                    <input type="hidden" name="orderNo" value={order.orderNo} />
                    <select
                      name="status"
                      defaultValue={order.status}
                      className={`${adminFieldClass} h-8 min-w-0 px-1.5 text-xs shadow-none`}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className={`${adminGridButtonClass} w-7 px-0`}
                      aria-label={`${order.orderNo} 주문상태 저장`}
                      title="저장"
                    >
                      <Check size={14} />
                    </button>
                  </form>
                </td>
                <td className={adminGridCellClass}>
                  {shipment ? (
                    <span className="line-clamp-1 text-xs text-neutral-600">
                      {[shipment.carrier, shipment.trackingNo].filter(Boolean).join(' / ') || '-'}
                    </span>
                  ) : (
                    <span className="text-neutral-400">배송 정보 없음</span>
                  )}
                </td>
                <td className={`${adminGridCellClass} text-center`}>
                  <button className={adminGridButtonClass}>SMS</button>
                </td>
              </tr>
            );
          }}
          renderMobileCard={(order) => {
            const firstItem = order.items[0];
            const itemLabel = firstItem
              ? order.items.length > 1
                ? `${firstItem.productName} 외 ${order.items.length - 1}건`
                : firstItem.productName
              : '주문 상품 없음';
            const payment = order.payments[0];
            const shipment = order.shipments[0];
            const buyerName =
              order.user?.name || readJsonString(order.buyerInfo, ['name', 'receiver']) || '비회원';
            const companyName = readJsonString(order.buyerInfo, [
              'company',
              'companyName',
              'ceoName',
            ]);
            const paymentLabel = payment
              ? (PAYMENT_LABELS[payment.method] ??
                PAYMENT_LABELS[payment.provider ?? ''] ??
                payment.method)
              : '-';

            return (
              <AdminMobileCard>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/orders/${order.orderNo}`}
                      className="line-clamp-2 font-extrabold text-neutral-950"
                    >
                      {itemLabel}
                    </Link>
                    <p className="mt-1 font-mono text-xs font-semibold text-neutral-500">
                      {order.orderNo}
                    </p>
                  </div>
                  <input
                    form="bulkOrderForm"
                    type="checkbox"
                    name="orderNo"
                    value={order.orderNo}
                    aria-label={`${order.orderNo} 선택`}
                    className="mt-1 h-5 w-5 shrink-0 rounded border-neutral-300 accent-neutral-900"
                  />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <AdminMobileField label="주문자">
                    {buyerName}
                    <span className="mt-1 block text-xs text-neutral-500">
                      {companyName || '회사명 없음'}
                    </span>
                  </AdminMobileField>
                  <AdminMobileField label="결제금액" align="right">
                    {formatKRW(order.total.toString())}
                    <span
                      className={
                        order.pointsUsed > 0
                          ? 'mt-1 block text-xs text-blue-700'
                          : 'mt-1 block text-xs text-neutral-400'
                      }
                    >
                      마일리지 {formatKRW(order.pointsUsed.toString())}
                    </span>
                  </AdminMobileField>
                  <AdminMobileField label="결제/경로">
                    {paymentLabel} / {orderSourceLabel(order)}
                  </AdminMobileField>
                  <AdminMobileField label="상태">{orderStatusLabel(order.status)}</AdminMobileField>
                  <div className="col-span-2">
                    <AdminMobileField label="주문일시">
                      {formatKoreanDateTime(order.createdAt)}
                    </AdminMobileField>
                  </div>
                  <div className="col-span-2">
                    <AdminMobileField label="배송">
                      {shipment
                        ? `${shipment.carrier ?? '-'} / ${shipment.trackingNo ?? '-'}`
                        : '배송 정보 없음'}
                    </AdminMobileField>
                  </div>
                </dl>
                <form action={updateAdminOrderStatus} className="mt-3 flex gap-2">
                  <input type="hidden" name="orderNo" value={order.orderNo} />
                  <select
                    name="status"
                    defaultValue={order.status}
                    className={`${adminFieldClass} min-w-0 flex-1`}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                  <button className={adminSecondaryButtonClass}>저장</button>
                </form>
              </AdminMobileCard>
            );
          }}
        />
      </AdminSection>

      <div className="text-right text-sm font-bold">
        {isMileageException ? (
          <span className="mr-2 inline-flex items-center gap-1 text-amber-700">
            <CircleAlert size={15} />
            2,000,000원 사용 주문 제외
          </span>
        ) : null}
        주문건수: {formatNumber(total)}건 | 합계금액: {formatKRW(totalAmount.toString())} | 마일리지
        포함: {formatKRW(mileageIncludedTotal.toString())}
      </div>

      <AdminPagination baseHref={baseHref} page={query.page} hasNext={hasNext} />
    </div>
  );
}
