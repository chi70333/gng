// Admin sales validation caches the daily base snapshot briefly, then sorts and filters in memory.

import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { CalendarDays, Search } from 'lucide-react';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { canAdmin, requireAdmin } from '@/server/admin/auth';
import { ForbiddenError } from '@/lib/errors';
import { formatKoreanDateTime, formatNumber, formatPhone } from '@/lib/format';
import {
  getKoreanDateString,
  koreanDateRangeUtc,
  type KoreanDateParts,
} from '@/lib/korean-date-range';
import {
  AdminDataGrid,
  type AdminSortDirection,
  AdminMobileCard,
  AdminMobileField,
  adminGridCellClass,
  adminGridStickyCellClass,
} from '@/components/admin/AdminDataGrid';
import { AdminPageSizeSelect } from '@/components/admin/AdminPageSizeSelect';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  AdminPageHeader,
  AdminSection,
  adminFieldClass,
  adminPrimaryButtonClass,
} from '@/components/admin/AdminUI';
import { SalesValidationReconciliationButton } from './SalesValidationReconciliationButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '일자별매출검증',
  description: '한국시간 기준 일자별 마일리지 적립/사용과 주문 사용값을 함께 검증합니다.',
};

const DEFAULT_PAGE_SIZE = 30;
const PAGE_SIZE_OPTIONS = [20, 30, 50, 100, 200, 500, 1000];
const SORT_KEYS = [
  'name',
  'loginId',
  'email',
  'phone',
  'earned',
  'used',
  'net',
  'orderCount',
  'status',
] as const;

type SalesValidationSortKey = (typeof SORT_KEYS)[number];

type SalesValidationSearchParams = {
  date?: string;
  q?: string;
  page?: string;
  pageSize?: string;
  sort?: string;
  dir?: string;
};

type SummaryRow = {
  userId: bigint;
  name: string;
  loginId: string | null;
  email: string;
  phone: string | null;
  earned: bigint;
  used: bigint;
  net: bigint;
  orderCount: bigint;
  linkedMileageUsed: bigint;
  orderMileageUsed: bigint;
  orderAmountTotal: Prisma.Decimal;
  totalCount: bigint;
};

type HistoryRow = {
  id: bigint;
  userId: bigint;
  delta: number;
  balance: number;
  reason: string;
  createdAt: Date;
};

type LinkedMileageLogRow = {
  id: bigint;
  service: string;
  userid: string;
  amount: bigint;
  reason: string;
  createdAt: Date;
};

type CachedSummaryRow = {
  userId: string;
  name: string;
  loginId: string | null;
  email: string;
  phone: string | null;
  earned: string;
  used: string;
  net: string;
  orderCount: string;
  linkedMileageUsed: string;
  orderMileageUsed: string;
  orderAmountTotal: string;
};

type SalesValidationSnapshot = {
  rows: CachedSummaryRow[];
  linkedMileageUsedTotal: string;
  orderMileageUsedTotal: number;
  orderAmountTotal: string;
};

function parseDate(value: string | undefined): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return getKoreanDateString();
}

function parsePositiveInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function parseSort(searchParams: SalesValidationSearchParams): {
  sort: SalesValidationSortKey;
  dir: AdminSortDirection;
} {
  const sort = SORT_KEYS.includes(searchParams.sort as SalesValidationSortKey)
    ? (searchParams.sort as SalesValidationSortKey)
    : 'used';
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc';
  return { sort, dir };
}

function datePartsFromString(date: string): KoreanDateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return {
    year: Number(match?.[1] ?? '1970'),
    month: Number(match?.[2] ?? '1'),
    day: Number(match?.[3] ?? '1'),
  };
}

function buildSortHref(
  basePath: string,
  currentParams: URLSearchParams,
  sort: string,
  dir: AdminSortDirection,
): string {
  const nextParams = new URLSearchParams(currentParams);
  nextParams.set('sort', sort);
  nextParams.set('dir', dir);
  nextParams.delete('page');

  const nextQuery = nextParams.toString();
  return nextQuery ? `${basePath}?${nextQuery}` : basePath;
}

function cachedRowToSummaryRow(row: CachedSummaryRow, totalCount: bigint): SummaryRow {
  return {
    userId: BigInt(row.userId),
    name: row.name,
    loginId: row.loginId,
    email: row.email,
    phone: row.phone,
    earned: BigInt(row.earned),
    used: BigInt(row.used),
    net: BigInt(row.net),
    orderCount: BigInt(row.orderCount),
    linkedMileageUsed: BigInt(row.linkedMileageUsed),
    orderMileageUsed: BigInt(row.orderMileageUsed),
    orderAmountTotal: new Prisma.Decimal(row.orderAmountTotal),
    totalCount,
  };
}

function matchesSummarySearch(row: SummaryRow, q: string): boolean {
  if (!q) return true;
  const keyword = q.toLowerCase();
  return (
    row.name.toLowerCase().includes(keyword) ||
    (row.loginId ?? '').toLowerCase().includes(keyword) ||
    row.email.toLowerCase().includes(keyword) ||
    (row.phone ?? '').includes(q)
  );
}

function compareBigInt(a: bigint, b: bigint): number {
  if (a === b) return 0;
  return a > b ? 1 : -1;
}

function statusRank(row: SummaryRow): number {
  if (needsCheck(row)) return 0;
  if (row.earned === row.used) return 1;
  return 2;
}

function sortSummaryRows(
  rows: SummaryRow[],
  sortState: { sort: SalesValidationSortKey; dir: AdminSortDirection },
): SummaryRow[] {
  const direction = sortState.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let compared = 0;

    if (sortState.sort === 'name') compared = a.name.localeCompare(b.name, 'ko');
    if (sortState.sort === 'loginId') {
      compared = (a.loginId ?? '').localeCompare(b.loginId ?? '', 'ko');
    }
    if (sortState.sort === 'email') compared = a.email.localeCompare(b.email, 'ko');
    if (sortState.sort === 'phone') {
      compared = (a.phone ?? '').localeCompare(b.phone ?? '', 'ko');
    }
    if (sortState.sort === 'earned') compared = compareBigInt(a.earned, b.earned);
    if (sortState.sort === 'used') compared = compareBigInt(a.used, b.used);
    if (sortState.sort === 'net') compared = compareBigInt(a.net, b.net);
    if (sortState.sort === 'orderCount') compared = compareBigInt(a.orderCount, b.orderCount);
    if (sortState.sort === 'status') compared = statusRank(a) - statusRank(b);

    if (compared !== 0) return compared * direction;

    const nameFallback = a.name.localeCompare(b.name, 'ko');
    if (nameFallback !== 0) return nameFallback;
    return compareBigInt(a.userId, b.userId);
  });
}

const getCachedSalesValidationSnapshot = unstable_cache(
  async (date: string): Promise<SalesValidationSnapshot> => {
    const range = koreanDateRangeUtc(datePartsFromString(date));
    const start = range.start;
    const endExclusive = range.endExclusive;

    const [rows, orderTotals, orderAmountRows, linkedMileageRows] = await Promise.all([
      prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
        WITH point_summary AS (
          SELECT
            h."userId",
            SUM(CASE WHEN h."delta" > 0 THEN h."delta" ELSE 0 END)::bigint AS "earned",
            SUM(CASE WHEN h."delta" < 0 THEN ABS(h."delta") ELSE 0 END)::bigint AS "used",
            SUM(h."delta")::bigint AS "net"
          FROM "UserPointHistory" h
          WHERE h."createdAt" >= ${start}
            AND h."createdAt" < ${endExclusive}
          GROUP BY h."userId"
        ),
        order_summary AS (
          SELECT
            o."userId",
            COUNT(*)::bigint AS "orderCount"
          FROM "Order" o
          WHERE o."createdAt" >= ${start}
            AND o."createdAt" < ${endExclusive}
            AND o."deletedAt" IS NULL
            AND o."userId" IS NOT NULL
          GROUP BY o."userId"
        ),
        order_point_summary AS (
          SELECT
            o."userId",
            COALESCE(SUM(o."pointsUsed"), 0)::bigint AS "orderMileageUsed"
          FROM "Order" o
          WHERE o."createdAt" >= ${start}
            AND o."createdAt" < ${endExclusive}
            AND o."deletedAt" IS NULL
            AND o."userId" IS NOT NULL
          GROUP BY o."userId"
        ),
        order_amount_summary AS (
          SELECT
            o."userId",
            COALESCE(SUM(o."total" + o."pointsUsed"), 0) AS "orderAmountTotal"
          FROM "Order" o
          WHERE o."createdAt" >= ${start}
            AND o."createdAt" < ${endExclusive}
            AND o."deletedAt" IS NULL
            AND o."status" <> 'cancelled'
            AND o."userId" IS NOT NULL
          GROUP BY o."userId"
        ),
        candidate_users AS (
          SELECT
            u."id" AS "userId",
            u."name",
            u."loginId",
            u."email",
            u."phone",
            ps."earned",
            ps."used",
            ps."net"
          FROM point_summary ps
          JOIN "User" u ON u."id" = ps."userId"
          WHERE u."deletedAt" IS NULL
        ),
        user_aliases AS (
          SELECT cu."userId", LOWER(cu."loginId") AS alias
          FROM candidate_users cu
          WHERE cu."loginId" IS NOT NULL
          UNION
          SELECT cu."userId", LOWER(cu."email") AS alias
          FROM candidate_users cu
          WHERE cu."email" IS NOT NULL
          UNION
          SELECT cu."userId", LOWER(cu."loginId" || '@legacy.local') AS alias
          FROM candidate_users cu
          WHERE cu."loginId" IS NOT NULL
          UNION
          SELECT s."userId", LOWER(s."provider" || '-' || s."providerUid") AS alias
          FROM "UserSocialAccount" s
          JOIN candidate_users cu ON cu."userId" = s."userId"
        ),
        linked_summary AS (
          SELECT
            a."userId",
            SUM((l."requestPayload"->>'amount')::bigint)::bigint AS "linkedMileageUsed"
          FROM "ApiCommunicationLog" l
          JOIN user_aliases a
            ON LOWER(COALESCE(l."requestPayload"->>'userid', '')) = a.alias
          WHERE l."createdAt" >= ${start}
            AND l."createdAt" < ${endExclusive}
            AND l."method" = 'POST'
            AND l."success" = true
            AND l."service" IN ('gng-api', 'point-sync')
            AND COALESCE(l."action", '') IN ('add', 'point_sync')
            AND NULLIF(l."requestPayload"->>'amount', '') ~ '^-?[0-9]+$'
            AND (l."requestPayload"->>'amount')::bigint > 0
          GROUP BY a."userId"
        )
        SELECT
          cu."userId",
          cu."name",
          cu."loginId",
          cu."email",
          cu."phone",
          cu."earned",
          cu."used",
          cu."net",
          COALESCE(os."orderCount", 0)::bigint AS "orderCount",
          COALESCE(ls."linkedMileageUsed", 0)::bigint AS "linkedMileageUsed",
          COALESCE(ops."orderMileageUsed", 0)::bigint AS "orderMileageUsed",
          COALESCE(oas."orderAmountTotal", 0) AS "orderAmountTotal",
          0::bigint AS "totalCount"
        FROM candidate_users cu
        LEFT JOIN order_summary os ON os."userId" = cu."userId"
        LEFT JOIN order_point_summary ops ON ops."userId" = cu."userId"
        LEFT JOIN order_amount_summary oas ON oas."userId" = cu."userId"
        LEFT JOIN linked_summary ls ON ls."userId" = cu."userId"
      `),
      prisma.order.aggregate({
        where: {
          deletedAt: null,
          createdAt: { gte: start, lt: endExclusive },
        },
        _sum: {
          total: true,
          pointsUsed: true,
        },
      }),
      prisma.$queryRaw<{ total: Prisma.Decimal | null }[]>(Prisma.sql`
        SELECT COALESCE(SUM(o."total" + o."pointsUsed"), 0) AS "total"
        FROM "Order" o
        WHERE o."createdAt" >= ${start}
          AND o."createdAt" < ${endExclusive}
          AND o."deletedAt" IS NULL
          AND o."status" <> 'cancelled'
      `),
      prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
        SELECT COALESCE(
          SUM(
            CASE
              WHEN NULLIF(l."requestPayload"->>'amount', '') ~ '^-?[0-9]+$'
                AND (l."requestPayload"->>'amount')::bigint > 0
              THEN (l."requestPayload"->>'amount')::bigint
              ELSE 0
            END
          ),
          0
        )::bigint AS "total"
        FROM "ApiCommunicationLog" l
        WHERE l."createdAt" >= ${start}
          AND l."createdAt" < ${endExclusive}
          AND l."method" = 'POST'
          AND l."success" = true
          AND l."service" IN ('gng-api', 'point-sync')
          AND COALESCE(l."action", '') IN ('add', 'point_sync')
      `),
    ]);

    return {
      rows: rows.map((row) => ({
        userId: row.userId.toString(),
        name: row.name,
        loginId: row.loginId,
        email: row.email,
        phone: row.phone,
        earned: row.earned.toString(),
        used: row.used.toString(),
        net: row.net.toString(),
        orderCount: row.orderCount.toString(),
        linkedMileageUsed: row.linkedMileageUsed.toString(),
        orderMileageUsed: row.orderMileageUsed.toString(),
        orderAmountTotal: row.orderAmountTotal.toString(),
      })),
      linkedMileageUsedTotal: (linkedMileageRows[0]?.total ?? 0n).toString(),
      orderMileageUsedTotal: orderTotals._sum.pointsUsed ?? 0,
      orderAmountTotal: (orderAmountRows[0]?.total ?? new Prisma.Decimal(0)).toString(),
    };
  },
  ['admin-sales-validation-snapshot-v1'],
  { revalidate: 60 },
);

function hasMileageDiff(row: SummaryRow): boolean {
  return row.linkedMileageUsed !== row.orderMileageUsed;
}

function hasPaymentDiff(row: SummaryRow): boolean {
  return !new Prisma.Decimal(row.linkedMileageUsed.toString()).equals(row.orderAmountTotal);
}

function needsCheck(row: SummaryRow): boolean {
  return hasMileageDiff(row) || hasPaymentDiff(row);
}

type CheckReason = {
  label: string;
  amount: string;
};

function signedBigInt(value: bigint): string {
  return `${value > 0n ? '+' : ''}${formatNumber(value)}`;
}

function signedDecimal(value: Prisma.Decimal): string {
  return `${value.gt(0) ? '+' : ''}${formatNumber(value.toString())}`;
}

function checkReasons(row: SummaryRow): CheckReason[] {
  const reasons: CheckReason[] = [];
  if (hasMileageDiff(row)) {
    reasons.push({
      label: '마일리지차액',
      amount: signedBigInt(row.linkedMileageUsed - row.orderMileageUsed),
    });
  }
  if (hasPaymentDiff(row)) {
    reasons.push({
      label: '결제차액',
      amount: signedDecimal(
        new Prisma.Decimal(row.linkedMileageUsed.toString()).minus(row.orderAmountTotal),
      ),
    });
  }
  return reasons;
}

function CheckReasonBadges({
  reasons,
  align = 'center',
}: {
  reasons: CheckReason[];
  align?: 'center' | 'end';
}) {
  if (reasons.length === 0) return null;

  return (
    <span
      className={`mt-1 flex flex-wrap gap-1 ${
        align === 'end' ? 'justify-end' : 'justify-center'
      }`}
    >
      {reasons.map((reason) => (
        <span
          key={reason.label}
          className="grid gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-extrabold text-amber-800 ring-1 ring-amber-200"
        >
          <span>{reason.label}</span>
          <span className="font-mono">{reason.amount}</span>
        </span>
      ))}
    </span>
  );
}

function statusLabel(row: SummaryRow): '체크' | '정상' | '비정상' {
  if (needsCheck(row)) return '체크';
  return row.earned === row.used ? '정상' : '비정상';
}

function statusClass(row: SummaryRow): string {
  if (needsCheck(row)) return 'bg-amber-100 text-amber-800 ring-amber-300';
  return row.earned === row.used
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : 'bg-rose-50 text-rose-700 ring-rose-200';
}

function DetailHistories({
  histories,
  linkedLogs,
  linkedMileageUsed,
  orderMileageUsed,
  orderAmountTotal,
}: {
  histories: HistoryRow[];
  linkedLogs: LinkedMileageLogRow[];
  linkedMileageUsed: bigint;
  orderMileageUsed: bigint;
  orderAmountTotal: Prisma.Decimal;
}) {
  const diff = linkedMileageUsed - orderMileageUsed;
  const paymentDiff = new Prisma.Decimal(linkedMileageUsed.toString()).minus(orderAmountTotal);

  return (
    <div className="mt-2 max-h-80 min-w-[380px] overflow-auto rounded-md border border-neutral-200 bg-white p-2 shadow-lg">
      <div className="grid gap-2">
        <div className="grid gap-1 rounded border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-neutral-700">
            <span>연동마일리지사용</span>
            <span className="font-mono text-amber-800">{formatNumber(linkedMileageUsed)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-neutral-700">
            <span>주문마일리지사용</span>
            <span className="font-mono text-rose-700">{formatNumber(orderMileageUsed)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-neutral-700">
            <span>총결제금액</span>
            <span className="font-mono text-neutral-900">
              {formatNumber(orderAmountTotal.toString())}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-neutral-700">
            <span>차이</span>
            <span
              className={`font-mono ${diff === 0n ? 'text-emerald-700' : 'text-amber-800'}`}
            >
              {diff > 0n ? '+' : ''}
              {formatNumber(diff)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-neutral-700">
            <span>결제차이</span>
            <span
              className={`font-mono ${
                paymentDiff.isZero() ? 'text-emerald-700' : 'text-amber-800'
              }`}
            >
              {paymentDiff.gt(0) ? '+' : ''}
              {formatNumber(paymentDiff.toString())}
            </span>
          </div>
        </div>

        {linkedLogs.length > 0 ? (
          <div className="grid gap-1.5">
            {linkedLogs.map((log) => (
              <div
                key={log.id.toString()}
                className="grid gap-1 rounded border border-amber-100 bg-amber-50/70 px-2 py-1.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs font-extrabold text-amber-800">
                    +{formatNumber(log.amount)}
                  </span>
                  <span className="text-[11px] font-semibold uppercase text-amber-700">
                    {log.service}
                  </span>
                </div>
                <p className="break-all font-mono text-[11px] text-neutral-500">{log.userid}</p>
                <p className="break-words text-xs font-semibold text-neutral-700">
                  {log.reason || '외부 연동'}
                </p>
                <p className="font-mono text-[11px] text-neutral-500">
                  {formatKoreanDateTime(log.createdAt)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-2 text-xs font-semibold text-neutral-500">
            이 회원에 매칭된 외부 연동 지급 로그가 없습니다.
          </p>
        )}

        {histories.length === 0 ? (
          <p className="px-2 py-3 text-xs font-semibold text-neutral-500">
            표시할 마일리지 이력이 없습니다.
          </p>
        ) : (
          <div className="grid gap-1.5">
            {histories.map((history) => (
              <div
                key={history.id.toString()}
                className="grid gap-1 rounded border border-neutral-100 bg-neutral-50 px-2 py-1.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={
                      history.delta >= 0
                        ? 'font-mono text-xs font-extrabold text-emerald-700'
                        : 'font-mono text-xs font-extrabold text-rose-700'
                    }
                  >
                    {history.delta >= 0 ? '+' : ''}
                    {formatNumber(history.delta)}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-neutral-500">
                    잔액 {formatNumber(history.balance)}
                  </span>
                </div>
                <p className="break-words text-xs font-semibold text-neutral-700">
                  {history.reason}
                </p>
                <p className="font-mono text-[11px] text-neutral-500">
                  {formatKoreanDateTime(history.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default async function AdminSalesValidationPage({
  searchParams,
}: {
  searchParams: SalesValidationSearchParams;
}) {
  const admin = await requireAdmin();
  const canReadUsers = canAdmin(admin, 'user.read');

  if (!canReadUsers && !canAdmin(admin, 'order.read')) {
    throw new ForbiddenError('관리자 권한이 없습니다.');
  }

  const date = parseDate(searchParams.date);
  const q = searchParams.q?.trim().slice(0, 100) ?? '';
  const page = parsePositiveInt(searchParams.page, 1, 1000);
  const requestedPageSize = parsePositiveInt(searchParams.pageSize, DEFAULT_PAGE_SIZE, 1000);
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize)
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE;
  const sortState = parseSort(searchParams);
  const { start, endExclusive } = koreanDateRangeUtc(datePartsFromString(date));
  const offset = (page - 1) * pageSize;
  const snapshot = await getCachedSalesValidationSnapshot(date);
  const allRows = snapshot.rows.map((row) => cachedRowToSummaryRow(row, 0n));
  const filteredRows = allRows.filter((row) => matchesSummarySearch(row, q));
  const total = BigInt(filteredRows.length);
  const rows = sortSummaryRows(filteredRows, sortState)
    .slice(offset, offset + pageSize)
    .map((row) => ({ ...row, totalCount: total }));

  const totalPages = Math.max(1, Math.ceil(Number(total) / pageSize));
  const hasNext = page < totalPages;
  const userIds = rows.map((row) => row.userId);

  const [histories, linkedLogs] = await Promise.all([
      userIds.length > 0
        ? prisma.userPointHistory.findMany({
            where: {
              userId: { in: userIds },
              createdAt: { gte: start, lt: endExclusive },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: {
              id: true,
              userId: true,
              delta: true,
              balance: true,
              reason: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      userIds.length > 0
        ? prisma.$queryRaw<LinkedMileageLogRow[]>(Prisma.sql`
            WITH user_aliases AS (
              SELECT u."id" AS "userId", LOWER(u."loginId") AS alias
              FROM "User" u
              WHERE u."id" IN (${Prisma.join(userIds)}) AND u."loginId" IS NOT NULL
              UNION
              SELECT u."id" AS "userId", LOWER(u."email") AS alias
              FROM "User" u
              WHERE u."id" IN (${Prisma.join(userIds)}) AND u."email" IS NOT NULL
              UNION
              SELECT u."id" AS "userId", LOWER(u."loginId" || '@legacy.local') AS alias
              FROM "User" u
              WHERE u."id" IN (${Prisma.join(userIds)}) AND u."loginId" IS NOT NULL
              UNION
              SELECT s."userId", LOWER(s."provider" || '-' || s."providerUid") AS alias
              FROM "UserSocialAccount" s
              WHERE s."userId" IN (${Prisma.join(userIds)})
            )
            SELECT
              l."id",
              l."service",
              COALESCE(l."requestPayload"->>'userid', '') AS "userid",
              (l."requestPayload"->>'amount')::bigint AS "amount",
              COALESCE(l."requestPayload"->>'reason', '') AS "reason",
              l."createdAt",
              a."userId"
            FROM "ApiCommunicationLog" l
            JOIN user_aliases a
              ON LOWER(COALESCE(l."requestPayload"->>'userid', '')) = a.alias
            WHERE l."createdAt" >= ${start}
              AND l."createdAt" < ${endExclusive}
              AND l."method" = 'POST'
              AND l."success" = true
              AND l."service" IN ('gng-api', 'point-sync')
              AND COALESCE(l."action", '') IN ('add', 'point_sync')
              AND NULLIF(l."requestPayload"->>'amount', '') ~ '^-?[0-9]+$'
              AND (l."requestPayload"->>'amount')::bigint > 0
            ORDER BY l."createdAt" DESC, l."id" DESC
          `)
        : Promise.resolve([]),
  ]);

  const linkedMileageUsedTotal = BigInt(snapshot.linkedMileageUsedTotal);
  const orderMileageUsedTotal = snapshot.orderMileageUsedTotal;
  const orderAmountTotal = new Prisma.Decimal(snapshot.orderAmountTotal);

  const historiesByUser = new Map<string, HistoryRow[]>();
  for (const history of histories) {
    const key = history.userId.toString();
    historiesByUser.set(key, [...(historiesByUser.get(key) ?? []), history]);
  }

  const linkedLogsByUser = new Map<string, LinkedMileageLogRow[]>();
  for (const log of linkedLogs) {
    const typedLog = log as LinkedMileageLogRow & { userId: bigint };
    const matchedUserId = typedLog.userId?.toString();
    if (!matchedUserId) continue;
    linkedLogsByUser.set(matchedUserId, [...(linkedLogsByUser.get(matchedUserId) ?? []), log]);
  }

  const params = new URLSearchParams();
  params.set('date', date);
  if (q) params.set('q', q);
  params.set('pageSize', String(pageSize));
  params.set('sort', sortState.sort);
  params.set('dir', sortState.dir);
  const baseHref = `/admin/sales-validation${params.toString() ? `?${params.toString()}` : ''}`;
  const getSortHref = (sort: string, dir: AdminSortDirection) =>
    buildSortHref('/admin/sales-validation', params, sort, dir);

  return (
    <div className="w-full space-y-4">
      <AdminPageHeader
        title="일자별매출검증"
        description={`${date} 한국시간 기준 마일리지 변동 회원 ${formatNumber(total)}명을 조회합니다.`}
      />

      <form className="grid gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.045)] ring-1 ring-white md:grid-cols-[180px_1fr_auto]">
        <label className="grid gap-1 text-xs font-extrabold text-neutral-600">
          조회일
          <input
            type="date"
            name="date"
            defaultValue={date}
            className={`${adminFieldClass} h-11`}
          />
        </label>
        <label className="grid gap-1 text-xs font-extrabold text-neutral-600">
          검색
          <input
            name="q"
            defaultValue={q}
            placeholder="이름, 아이디, 이메일, 휴대전화"
            className={`${adminFieldClass} h-11`}
          />
        </label>
        <button className={`${adminPrimaryButtonClass} h-11 self-end`}>
          <Search size={17} />
          조회
        </button>
        <input type="hidden" name="pageSize" value={pageSize} />
        <input type="hidden" name="sort" value={sortState.sort} />
        <input type="hidden" name="dir" value={sortState.dir} />
      </form>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm">
          <p className="text-xs font-extrabold text-neutral-500">연동마일리지사용</p>
          <p className="mt-1 font-mono text-lg font-extrabold text-rose-700">
            {formatNumber(linkedMileageUsedTotal)}
          </p>
        </div>
        <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm">
          <p className="text-xs font-extrabold text-neutral-500">주문마일리지사용</p>
          <p className="mt-1 font-mono text-lg font-extrabold text-rose-700">
            {formatNumber(orderMileageUsedTotal)}
          </p>
        </div>
        <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm">
          <p className="text-xs font-extrabold text-neutral-500">총결제금액</p>
          <p className="mt-1 font-mono text-lg font-extrabold text-neutral-950">
            {formatNumber(orderAmountTotal.toString())}
          </p>
        </div>
      </div>

      <AdminSection
        title="검증목록"
        description={`현재 페이지 ${formatNumber(rows.length)}명 / 총 ${formatNumber(page)} / ${formatNumber(totalPages)}페이지`}
        icon={CalendarDays}
        bodyClassName="p-0"
        headerAction={
          <AdminPageSizeSelect
            action="/admin/sales-validation"
            name="pageSize"
            value={pageSize}
            options={PAGE_SIZE_OPTIONS}
            hiddenFields={Array.from(params.entries()).map(([name, value]) => ({ name, value }))}
          />
        }
      >
        <AdminDataGrid
          caption="일자별매출검증 목록"
          columns={[
            { key: 'name', label: '이름', widthClassName: 'min-w-[160px]', sortKey: 'name' },
            { key: 'loginId', label: '아이디', widthClassName: 'w-44', sortKey: 'loginId' },
            { key: 'email', label: '이메일', widthClassName: 'w-64', sortKey: 'email' },
            { key: 'phone', label: '휴대전화', widthClassName: 'w-40', sortKey: 'phone' },
            {
              key: 'earned',
              label: '금일 적립',
              align: 'right',
              widthClassName: 'w-32',
              sortKey: 'earned',
            },
            {
              key: 'used',
              label: '금일 사용',
              align: 'right',
              widthClassName: 'w-32',
              sortKey: 'used',
            },
            {
              key: 'net',
              label: '순변동',
              align: 'right',
              widthClassName: 'w-32',
              sortKey: 'net',
            },
            {
              key: 'orderCount',
              label: '금일 주문수',
              align: 'right',
              widthClassName: 'w-32',
              sortKey: 'orderCount',
            },
            {
              key: 'status',
              label: '상태',
              align: 'center',
              widthClassName: 'w-36',
              sortKey: 'status',
            },
          ]}
          rows={rows}
          rowKey={(row) => row.userId.toString()}
          emptyText="선택한 날짜에 마일리지 변동 회원이 없습니다."
          minWidthClassName="min-w-[1260px]"
          currentSortKey={sortState.sort}
          currentSortDirection={sortState.dir}
          getSortHref={getSortHref}
          renderRow={(row) => {
            const historiesForUser = historiesByUser.get(row.userId.toString()) ?? [];
            const linkedLogsForUser = linkedLogsByUser.get(row.userId.toString()) ?? [];
            const reasons = checkReasons(row);

            return (
              <tr key={row.userId.toString()} className="bg-white transition hover:bg-neutral-50">
                <td className={adminGridStickyCellClass}>
                  {canReadUsers ? (
                    <Link
                      href={`/admin/users/${row.userId.toString()}`}
                      className="font-extrabold text-neutral-950 hover:text-blue-700 hover:underline"
                    >
                      {row.name}
                    </Link>
                  ) : (
                    <span className="font-extrabold text-neutral-950">{row.name}</span>
                  )}
                </td>
                <td className={`${adminGridCellClass} break-all font-mono`}>
                  {row.loginId ?? '-'}
                </td>
                <td className={`${adminGridCellClass} break-all`}>{row.email}</td>
                <td className={`${adminGridCellClass} whitespace-nowrap font-mono`}>
                  {formatPhone(row.phone)}
                </td>
                <td className={`${adminGridCellClass} text-right font-bold text-emerald-700`}>
                  {formatNumber(row.earned)}
                </td>
                <td className={`${adminGridCellClass} text-right font-bold text-rose-700`}>
                  {formatNumber(row.used)}
                </td>
                <td className={`${adminGridCellClass} text-right font-bold text-neutral-900`}>
                  {formatNumber(row.net)}
                </td>
                <td className={`${adminGridCellClass} text-right font-bold`}>
                  {formatNumber(row.orderCount)}
                </td>
                <td className={`${adminGridCellClass} text-center`}>
                  <details className="group relative inline-block text-left">
                    <summary className="list-none cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-200 [&::-webkit-details-marker]:hidden">
                      <span
                        className={`inline-flex min-h-7 items-center rounded-full px-3 text-xs font-bold ring-1 ${statusClass(row)}`}
                      >
                        {statusLabel(row)}
                      </span>
                      <CheckReasonBadges reasons={reasons} />
                    </summary>
                    <DetailHistories
                      histories={historiesForUser}
                      linkedLogs={linkedLogsForUser}
                      linkedMileageUsed={row.linkedMileageUsed}
                      orderMileageUsed={row.orderMileageUsed}
                      orderAmountTotal={row.orderAmountTotal}
                    />
                  </details>
                </td>
              </tr>
            );
          }}
          renderMobileCard={(row) => {
            const historiesForUser = historiesByUser.get(row.userId.toString()) ?? [];
            const linkedLogsForUser = linkedLogsByUser.get(row.userId.toString()) ?? [];
            const reasons = checkReasons(row);

            return (
              <AdminMobileCard>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {canReadUsers ? (
                      <Link
                        href={`/admin/users/${row.userId.toString()}`}
                        className="font-extrabold text-neutral-950"
                      >
                        {row.name}
                      </Link>
                    ) : (
                      <span className="font-extrabold text-neutral-950">{row.name}</span>
                    )}
                    <p className="mt-1 break-all font-mono text-xs font-semibold text-neutral-500">
                      {row.loginId ?? '-'} / {row.email}
                    </p>
                  </div>
                  <details className="relative shrink-0 text-right">
                    <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
                      <span
                        className={`inline-flex min-h-7 items-center rounded-full px-3 text-xs font-bold ring-1 ${statusClass(row)}`}
                      >
                        {statusLabel(row)}
                      </span>
                      <CheckReasonBadges reasons={reasons} align="end" />
                    </summary>
                    <DetailHistories
                      histories={historiesForUser}
                      linkedLogs={linkedLogsForUser}
                      linkedMileageUsed={row.linkedMileageUsed}
                      orderMileageUsed={row.orderMileageUsed}
                      orderAmountTotal={row.orderAmountTotal}
                    />
                  </details>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <AdminMobileField label="휴대전화">{formatPhone(row.phone)}</AdminMobileField>
                  <AdminMobileField label="금일 주문수" align="right">
                    {formatNumber(row.orderCount)}
                  </AdminMobileField>
                  <AdminMobileField label="금일 적립" align="right">
                    {formatNumber(row.earned)}
                  </AdminMobileField>
                  <AdminMobileField label="금일 사용" align="right">
                    {formatNumber(row.used)}
                  </AdminMobileField>
                  <AdminMobileField label="순변동" align="right">
                    {formatNumber(row.net)}
                  </AdminMobileField>
                </dl>
              </AdminMobileCard>
            );
          }}
        />
      </AdminSection>

      <SalesValidationReconciliationButton date={date} />

      <AdminPagination baseHref={baseHref} page={page} hasNext={hasNext} totalPages={totalPages} />
    </div>
  );
}
