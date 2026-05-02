// Legacy sources: wb_admin/trade_order_excel.php
// Cache: no-store. Admin order export must reflect filtered live order data.

import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import {
  ADMIN_ORDER_MILEAGE_EXCEPTION_QUERY,
  ADMIN_ORDER_MILEAGE_EXCEPTION_VALUE,
  adminOrderListQuerySchema,
} from '@/schemas/admin-order';

export const dynamic = 'force-dynamic';

const LEGACY_ORDER_CSV_COLUMNS = [
  '주문번호',
  '주문날짜',
  '주문자',
  '결제방식',
  '수령자',
  '수령자주소',
  '수령자전화',
  '수령자핸드폰',
  '상품명',
  '기본선택',
  '옵션선택',
  '개수',
  '주문형식',
  '소계',
  '배송비',
  '적립금사용',
  '결제금액',
  '주문상태',
  '배송사',
  '송장번호',
  '첨부파일1',
  '첨부파일2',
  '첨부파일3',
  '첨부파일4',
  '첨부파일5',
];

function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/"/g, '""');
  return `"${text}"`;
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

function paymentLabel(method: string | undefined): string {
  const labels: Record<string, string> = {
    card: '카드결제',
    hand: '휴대폰',
    iche: '계좌이체',
    cyber: '가상계좌',
    bank: '무통장',
    vbank: '가상계좌',
    point: '적립금',
  };
  return method ? (labels[method] ?? method) : '미결제';
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '주문접수',
    paid: '결제완료',
    preparing: '상품준비중',
    shipping: '배송시작',
    delivered: '배송완료',
    cancelled: '주문취소',
    refunded: '반품처리',
  };
  return labels[status] ?? status;
}

function getDateRange(query: ReturnType<typeof adminOrderListQuerySchema.parse>) {
  const now = new Date();
  const start = new Date(
    query.year ?? now.getFullYear(),
    (query.month ?? now.getMonth() + 1) - 1,
    query.day ?? 1,
  );
  const endExclusive = new Date(
    query.year2 ?? now.getFullYear(),
    (query.month2 ?? now.getMonth() + 1) - 1,
    (query.day2 ?? now.getDate()) + 1,
  );
  return { start, endExclusive };
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

function buildOrderWhere(
  query: ReturnType<typeof adminOrderListQuerySchema.parse>,
): Prisma.OrderWhereInput {
  const { start, endExclusive } = getDateRange(query);
  const and: Prisma.OrderWhereInput[] = [{ deletedAt: null }];
  if (query.exception === ADMIN_ORDER_MILEAGE_EXCEPTION_QUERY) {
    and.push({ pointsUsed: { not: ADMIN_ORDER_MILEAGE_EXCEPTION_VALUE } });
  }
  if (query.status !== '-' && query.status !== '11') and.push({ status: query.status });
  if (query.serhs) and.push({ createdAt: { gte: start, lt: endExclusive } });

  const searchWhere = buildSearchWhere(query.search, query.searchstring);
  if (searchWhere) and.push(searchWhere);

  if (query.paym !== '0') {
    const methodMap: Record<string, string[]> = {
      card: ['card'],
      hand: ['hand'],
      iche: ['iche', 'transfer'],
      cyber: ['cyber', 'vbank'],
      bank: ['bank', 'vbank'],
      point: ['point'],
    };
    and.push({ payments: { some: { method: { in: methodMap[query.paym] ?? [query.paym] } } } });
  }

  if (query.card !== '0') {
    const simpleProviders = ['npay', 'naverpay', 'kakao', 'kakaopay', 'payco', 'tosspay'];
    and.push(
      query.card === '1'
        ? { payments: { some: { provider: { in: simpleProviders } } } }
        : {
            OR: [
              { payments: { none: { provider: { in: simpleProviders } } } },
              { payments: { some: { provider: null } } },
            ],
          },
    );
  }

  const pointsUsedWhere = buildPointsUsedWhere(query.point_min, query.point_max);
  if (pointsUsedWhere) and.push(pointsUsedWhere);

  return { AND: and };
}

export async function GET(request: Request) {
  await requireAdmin('order.read');
  const url = new URL(request.url);
  const selectedOrderNos = url.searchParams.getAll('orderNo').filter(Boolean);
  const rawQuery = Object.fromEntries(url.searchParams);
  const query = adminOrderListQuerySchema.parse(
    rawQuery.exception === ADMIN_ORDER_MILEAGE_EXCEPTION_QUERY && rawQuery.serhs == null
      ? { ...rawQuery, serhs: '0' }
      : rawQuery,
  );
  const where =
    selectedOrderNos.length > 0
      ? { deletedAt: null, orderNo: { in: selectedOrderNos } }
      : buildOrderWhere(query);
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5000,
    include: {
      user: { select: { loginId: true, name: true, phone: true, email: true } },
      items: { orderBy: { id: 'asc' } },
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      shipments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  const rows = [LEGACY_ORDER_CSV_COLUMNS.map(csvCell).join(',')];
  for (const order of orders) {
    const payment = order.payments[0];
    const shipment = order.shipments[0];
    const buyerName =
      order.user?.name || readJsonString(order.buyerInfo, ['name', 'buyerName']) || '비회원';
    const buyerLabel = `${buyerName}[${order.userId ? '일반회원' : '비회원'}]`;
    const receiver = readJsonString(order.shippingAddress, ['receiver', 'name']) || buyerName;
    const receiverPhone =
      readJsonString(order.shippingAddress, ['phone', 'tel']) || order.user?.phone || '';
    const address = [
      readJsonString(order.shippingAddress, ['address1', 'address']),
      readJsonString(order.shippingAddress, ['address2', 'detailAddress']),
    ]
      .filter(Boolean)
      .join(' ');

    for (const item of order.items) {
      rows.push(
        [
          order.orderNo,
          order.createdAt.toLocaleString('ko-KR'),
          buyerLabel,
          paymentLabel(payment?.method),
          receiver,
          address,
          receiverPhone,
          receiverPhone,
          item.productName,
          item.skuCode ?? '',
          item.optionSummary ?? '',
          item.quantity,
          '',
          item.totalPrice.toString(),
          order.shippingFee.toString(),
          order.pointsUsed,
          order.total.toString(),
          statusLabel(order.status),
          shipment?.carrier ?? '',
          shipment?.trackingNo ?? '',
          '',
          '',
          '',
          '',
          '',
        ]
          .map(csvCell)
          .join(','),
      );
    }
  }

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  return new NextResponse(`\ufeff${rows.join('\r\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="order${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
