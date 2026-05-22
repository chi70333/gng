// Cache: no-store. Admin sales validation must reflect live point ledger and order state.

import type { Metadata } from 'next';
import Link from 'next/link';
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

type ReconciliationRow = {
  userid: string;
  linkedMileageUsed: bigint;
  matchedUserId: bigint | null;
  matchedName: string | null;
  matchedLoginId: string | null;
  matchedEmail: string | null;
  orderAmountTotal: Prisma.Decimal;
  paymentDiff: Prisma.Decimal;
  hasPointHistory: boolean;
  aliasUserCount: bigint;
  reason: string;
};

type ReconciliationTotals = {
  candidatePaymentDiffTotal: Prisma.Decimal | null;
  unmatchedLinkedMileageTotal: bigint;
  matchedWithoutPointHistoryTotal: bigint;
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

function orderSql(sort: SalesValidationSortKey, dir: AdminSortDirection): Prisma.Sql {
  const direction = dir === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const fallback = Prisma.sql`s."name" ASC, s."userId" ASC`;

  if (sort === 'name') return Prisma.sql`ORDER BY s."name" ${direction}, s."userId" ASC`;
  if (sort === 'loginId') {
    return Prisma.sql`ORDER BY s."loginId" ${direction} NULLS LAST, ${fallback}`;
  }
  if (sort === 'email') return Prisma.sql`ORDER BY s."email" ${direction}, ${fallback}`;
  if (sort === 'phone') return Prisma.sql`ORDER BY s."phone" ${direction} NULLS LAST, ${fallback}`;
  if (sort === 'earned') return Prisma.sql`ORDER BY s."earned" ${direction}, ${fallback}`;
  if (sort === 'used') return Prisma.sql`ORDER BY s."used" ${direction}, ${fallback}`;
  if (sort === 'net') return Prisma.sql`ORDER BY s."net" ${direction}, ${fallback}`;
  if (sort === 'orderCount') return Prisma.sql`ORDER BY s."orderCount" ${direction}, ${fallback}`;
  if (sort === 'status') {
    return Prisma.sql`
      ORDER BY
        CASE
          WHEN s."linkedMileageUsed" <> s."orderMileageUsed"
            OR s."linkedMileageUsed"::numeric <> s."orderAmountTotal" THEN 0
          WHEN s."earned" = s."used" THEN 1
          ELSE 2
        END
        ${direction},
        ${fallback}
    `;
  }

  return Prisma.sql`ORDER BY s."used" DESC, ${fallback}`;
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
  const keyword = q ? `%${q}%` : null;
  const searchSql = keyword
    ? Prisma.sql`AND (
        u."name" ILIKE ${keyword}
        OR u."loginId" ILIKE ${keyword}
        OR u."email" ILIKE ${keyword}
        OR u."phone" LIKE ${keyword}
      )`
    : Prisma.empty;
  const sortSql = orderSql(sortState.sort, sortState.dir);

  const rows = await prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
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
      ${searchSql}
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
    ),
    scoped AS (
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
        COALESCE(oas."orderAmountTotal", 0) AS "orderAmountTotal"
      FROM candidate_users cu
      LEFT JOIN order_summary os ON os."userId" = cu."userId"
      LEFT JOIN order_point_summary ops ON ops."userId" = cu."userId"
      LEFT JOIN order_amount_summary oas ON oas."userId" = cu."userId"
      LEFT JOIN linked_summary ls ON ls."userId" = cu."userId"
    )
    SELECT
      s.*,
      COUNT(*) OVER()::bigint AS "totalCount"
    FROM scoped s
    ${sortSql}
    OFFSET ${offset}
    LIMIT ${pageSize}
  `);

  const total = rows[0]?.totalCount ?? 0n;
  const totalPages = Math.max(1, Math.ceil(Number(total) / pageSize));
  const hasNext = page < totalPages;
  const userIds = rows.map((row) => row.userId);

  const [
    histories,
    orderTotals,
    orderAmountRows,
    linkedMileageRows,
    linkedLogs,
    reconciliationTotalRows,
    reconciliationRows,
  ] =
    await Promise.all([
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
      prisma.$queryRaw<ReconciliationTotals[]>(Prisma.sql`
        WITH point_users AS (
          SELECT DISTINCT h."userId"
          FROM "UserPointHistory" h
          WHERE h."createdAt" >= ${start}
            AND h."createdAt" < ${endExclusive}
        ),
        all_aliases_raw AS (
          SELECT u."id" AS "userId", LOWER(u."loginId") AS alias
          FROM "User" u
          WHERE u."deletedAt" IS NULL AND u."loginId" IS NOT NULL
          UNION ALL
          SELECT u."id" AS "userId", LOWER(u."email") AS alias
          FROM "User" u
          WHERE u."deletedAt" IS NULL AND u."email" IS NOT NULL
          UNION ALL
          SELECT u."id" AS "userId", LOWER(u."loginId" || '@legacy.local') AS alias
          FROM "User" u
          WHERE u."deletedAt" IS NULL AND u."loginId" IS NOT NULL
          UNION ALL
          SELECT s."userId", LOWER(s."provider" || '-' || s."providerUid") AS alias
          FROM "UserSocialAccount" s
          JOIN "User" u ON u."id" = s."userId"
          WHERE u."deletedAt" IS NULL
        ),
        alias_users AS (
          SELECT
            alias,
            MIN("userId") AS "userId",
            COUNT(DISTINCT "userId")::bigint AS "aliasUserCount"
          FROM all_aliases_raw
          WHERE alias IS NOT NULL AND alias <> ''
          GROUP BY alias
        ),
        linked_by_userid AS (
          SELECT
            LOWER(COALESCE(l."requestPayload"->>'userid', '')) AS userid,
            SUM((l."requestPayload"->>'amount')::bigint)::bigint AS "linkedMileageUsed"
          FROM "ApiCommunicationLog" l
          WHERE l."createdAt" >= ${start}
            AND l."createdAt" < ${endExclusive}
            AND l."method" = 'POST'
            AND l."success" = true
            AND l."service" IN ('gng-api', 'point-sync')
            AND COALESCE(l."action", '') IN ('add', 'point_sync')
            AND NULLIF(l."requestPayload"->>'amount', '') ~ '^-?[0-9]+$'
            AND (l."requestPayload"->>'amount')::bigint > 0
          GROUP BY LOWER(COALESCE(l."requestPayload"->>'userid', ''))
        ),
        order_amount_by_user AS (
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
        candidate_payment_summary AS (
          SELECT
            COALESCE(
              SUM(lu."linkedMileageUsed"::numeric - COALESCE(oau."orderAmountTotal", 0)),
              0
            ) AS "candidatePaymentDiffTotal"
          FROM linked_by_userid lu
          JOIN alias_users au ON au.alias = lu.userid
          JOIN point_users pu ON pu."userId" = au."userId"
          LEFT JOIN order_amount_by_user oau ON oau."userId" = au."userId"
        )
        SELECT
          cps."candidatePaymentDiffTotal",
          COALESCE(
            SUM(CASE WHEN au."userId" IS NULL THEN lu."linkedMileageUsed" ELSE 0 END),
            0
          )::bigint AS "unmatchedLinkedMileageTotal",
          COALESCE(
            SUM(
              CASE
                WHEN au."userId" IS NOT NULL AND pu."userId" IS NULL
                  THEN lu."linkedMileageUsed"
                ELSE 0
              END
            ),
            0
          )::bigint AS "matchedWithoutPointHistoryTotal"
        FROM linked_by_userid lu
        LEFT JOIN alias_users au ON au.alias = lu.userid
        LEFT JOIN point_users pu ON pu."userId" = au."userId"
        CROSS JOIN candidate_payment_summary cps
        GROUP BY cps."candidatePaymentDiffTotal"
      `),
      prisma.$queryRaw<ReconciliationRow[]>(Prisma.sql`
        WITH point_users AS (
          SELECT DISTINCT h."userId"
          FROM "UserPointHistory" h
          WHERE h."createdAt" >= ${start}
            AND h."createdAt" < ${endExclusive}
        ),
        all_aliases_raw AS (
          SELECT u."id" AS "userId", LOWER(u."loginId") AS alias
          FROM "User" u
          WHERE u."deletedAt" IS NULL AND u."loginId" IS NOT NULL
          UNION ALL
          SELECT u."id" AS "userId", LOWER(u."email") AS alias
          FROM "User" u
          WHERE u."deletedAt" IS NULL AND u."email" IS NOT NULL
          UNION ALL
          SELECT u."id" AS "userId", LOWER(u."loginId" || '@legacy.local') AS alias
          FROM "User" u
          WHERE u."deletedAt" IS NULL AND u."loginId" IS NOT NULL
          UNION ALL
          SELECT s."userId", LOWER(s."provider" || '-' || s."providerUid") AS alias
          FROM "UserSocialAccount" s
          JOIN "User" u ON u."id" = s."userId"
          WHERE u."deletedAt" IS NULL
        ),
        alias_users AS (
          SELECT
            alias,
            MIN("userId") AS "userId",
            COUNT(DISTINCT "userId")::bigint AS "aliasUserCount"
          FROM all_aliases_raw
          WHERE alias IS NOT NULL AND alias <> ''
          GROUP BY alias
        ),
        linked_by_userid AS (
          SELECT
            LOWER(COALESCE(l."requestPayload"->>'userid', '')) AS userid,
            SUM((l."requestPayload"->>'amount')::bigint)::bigint AS "linkedMileageUsed"
          FROM "ApiCommunicationLog" l
          WHERE l."createdAt" >= ${start}
            AND l."createdAt" < ${endExclusive}
            AND l."method" = 'POST'
            AND l."success" = true
            AND l."service" IN ('gng-api', 'point-sync')
            AND COALESCE(l."action", '') IN ('add', 'point_sync')
            AND NULLIF(l."requestPayload"->>'amount', '') ~ '^-?[0-9]+$'
            AND (l."requestPayload"->>'amount')::bigint > 0
          GROUP BY LOWER(COALESCE(l."requestPayload"->>'userid', ''))
        ),
        order_amount_by_user AS (
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
        )
        SELECT
          lu.userid,
          lu."linkedMileageUsed",
          u."id" AS "matchedUserId",
          u."name" AS "matchedName",
          u."loginId" AS "matchedLoginId",
          u."email" AS "matchedEmail",
          COALESCE(oau."orderAmountTotal", 0) AS "orderAmountTotal",
          lu."linkedMileageUsed"::numeric - COALESCE(oau."orderAmountTotal", 0) AS "paymentDiff",
          (pu."userId" IS NOT NULL) AS "hasPointHistory",
          COALESCE(au."aliasUserCount", 0)::bigint AS "aliasUserCount",
          CASE
            WHEN au."userId" IS NULL THEN '회원매칭없음'
            WHEN pu."userId" IS NULL THEN '오늘마일리지변동없음'
            WHEN au."aliasUserCount" > 1 THEN '아이디중복매칭'
            ELSE '결제차액'
          END AS reason
        FROM linked_by_userid lu
        LEFT JOIN alias_users au ON au.alias = lu.userid
        LEFT JOIN "User" u ON u."id" = au."userId"
        LEFT JOIN point_users pu ON pu."userId" = au."userId"
        LEFT JOIN order_amount_by_user oau ON oau."userId" = au."userId"
        WHERE au."userId" IS NULL
          OR pu."userId" IS NULL
          OR au."aliasUserCount" > 1
          OR lu."linkedMileageUsed"::numeric <> COALESCE(oau."orderAmountTotal", 0)
        ORDER BY
          CASE
            WHEN au."userId" IS NULL THEN 0
            WHEN pu."userId" IS NULL THEN 1
            WHEN au."aliasUserCount" > 1 THEN 2
            ELSE 3
          END,
          ABS(lu."linkedMileageUsed"::numeric - COALESCE(oau."orderAmountTotal", 0)) DESC,
          lu."linkedMileageUsed" DESC
        LIMIT 20
      `),
    ]);

  const linkedMileageUsedTotal = linkedMileageRows[0]?.total ?? 0n;
  const orderMileageUsedTotal = orderTotals._sum.pointsUsed ?? 0;
  const orderAmountTotal = orderAmountRows[0]?.total ?? new Prisma.Decimal(0);
  const reconciliationTotals = reconciliationTotalRows[0] ?? {
    candidatePaymentDiffTotal: new Prisma.Decimal(0),
    unmatchedLinkedMileageTotal: 0n,
    matchedWithoutPointHistoryTotal: 0n,
  };
  const paymentDiffTotal = new Prisma.Decimal(linkedMileageUsedTotal.toString()).minus(
    orderAmountTotal,
  );

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
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-extrabold text-neutral-900">
          <span className="text-neutral-500">연동마일리지사용</span>
          <span className="font-mono text-lg text-rose-700">
            {formatNumber(linkedMileageUsedTotal)}
          </span>
          <span className="mx-2 text-neutral-300">|</span>
          <span className="text-neutral-500">주문마일리지사용</span>
          <span className="font-mono text-lg text-rose-700">
            {formatNumber(orderMileageUsedTotal)}
          </span>
          <span className="mx-2 text-neutral-300">|</span>
          <span className="text-neutral-500">총결제금액</span>
          <span className="font-mono text-lg text-neutral-950">
            {formatNumber(orderAmountTotal.toString())}
          </span>
        </div>
      </AdminSection>

      <AdminSection
        title="차액 추적"
        description="상단 합계에는 들어갔지만 회원별 체크 행에서 바로 드러나지 않는 금액을 추적합니다."
        bodyClassName="space-y-4"
      >
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border border-neutral-200 bg-white p-4">
            <p className="text-xs font-bold text-neutral-500">전체 결제차액</p>
            <p className="mt-2 font-mono text-xl font-extrabold text-amber-700">
              {signedDecimal(paymentDiffTotal)}
            </p>
          </div>
          <div className="rounded-md border border-neutral-200 bg-white p-4">
            <p className="text-xs font-bold text-neutral-500">회원별 표시 차액</p>
            <p className="mt-2 font-mono text-xl font-extrabold text-neutral-950">
              {signedDecimal(
                reconciliationTotals.candidatePaymentDiffTotal ?? new Prisma.Decimal(0),
              )}
            </p>
          </div>
          <div className="rounded-md border border-neutral-200 bg-white p-4">
            <p className="text-xs font-bold text-neutral-500">회원매칭 없는 연동액</p>
            <p className="mt-2 font-mono text-xl font-extrabold text-rose-700">
              {formatNumber(reconciliationTotals.unmatchedLinkedMileageTotal)}
            </p>
          </div>
          <div className="rounded-md border border-neutral-200 bg-white p-4">
            <p className="text-xs font-bold text-neutral-500">포인트이력 없는 연동액</p>
            <p className="mt-2 font-mono text-xl font-extrabold text-blue-700">
              {formatNumber(reconciliationTotals.matchedWithoutPointHistoryTotal)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="min-w-[980px] w-full divide-y divide-neutral-200 text-sm">
            <caption className="sr-only">차액 원인 후보</caption>
            <thead className="bg-neutral-50 text-xs font-extrabold text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">구분</th>
                <th className="px-3 py-2 text-left">연동 userid</th>
                <th className="px-3 py-2 text-left">매칭회원</th>
                <th className="px-3 py-2 text-right">연동마일리지</th>
                <th className="px-3 py-2 text-right">총결제금액</th>
                <th className="px-3 py-2 text-right">차액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {reconciliationRows.length > 0 ? (
                reconciliationRows.map((row) => (
                  <tr key={`${row.reason}-${row.userid}`} className="align-top">
                    <td className="px-3 py-2 font-extrabold text-amber-700">{row.reason}</td>
                    <td className="px-3 py-2 font-mono text-neutral-900">{row.userid || '-'}</td>
                    <td className="px-3 py-2">
                      {row.matchedUserId ? (
                        <div className="grid gap-0.5">
                          <span className="font-extrabold text-neutral-950">
                            {row.matchedName ?? '-'}
                          </span>
                          <span className="font-mono text-xs text-neutral-500">
                            {row.matchedLoginId ?? row.matchedEmail ?? row.matchedUserId.toString()}
                          </span>
                        </div>
                      ) : (
                        <span className="font-bold text-rose-700">매칭 없음</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-rose-700">
                      {formatNumber(row.linkedMileageUsed)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-neutral-900">
                      {formatNumber(row.orderAmountTotal.toString())}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-extrabold text-amber-700">
                      {signedDecimal(row.paymentDiff)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-6 text-center font-bold text-neutral-500" colSpan={6}>
                    추가로 추적할 차액 후보가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminSection>

      <AdminPagination baseHref={baseHref} page={page} hasNext={hasNext} totalPages={totalPages} />
    </div>
  );
}
