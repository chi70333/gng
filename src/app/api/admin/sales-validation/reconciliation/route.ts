import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { canAdmin, requireAdmin } from '@/server/admin/auth';
import { getKoreanDateString, koreanDateRangeUtc } from '@/lib/korean-date-range';

export const dynamic = 'force-dynamic';

type KoreanDateParts = {
  year: number;
  month: number;
  day: number;
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
  reason: string;
};

type ReconciliationTotals = {
  candidatePaymentDiffTotal: Prisma.Decimal | null;
  unmatchedLinkedMileageTotal: bigint;
  matchedWithoutPointHistoryTotal: bigint;
};

function parseDate(value: string | null): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return getKoreanDateString();
}

function datePartsFromString(date: string): KoreanDateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return {
    year: Number(match?.[1] ?? '1970'),
    month: Number(match?.[2] ?? '1'),
    day: Number(match?.[3] ?? '1'),
  };
}

const getCachedReconciliation = unstable_cache(
  async (date: string) => {
    const { start, endExclusive } = koreanDateRangeUtc(datePartsFromString(date));

    const [orderAmountRows, linkedMileageRows, totalRows, rows] = await Promise.all([
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
    const orderAmountTotal = orderAmountRows[0]?.total ?? new Prisma.Decimal(0);
    const totals = totalRows[0] ?? {
      candidatePaymentDiffTotal: new Prisma.Decimal(0),
      unmatchedLinkedMileageTotal: 0n,
      matchedWithoutPointHistoryTotal: 0n,
    };

    return {
      totals: {
        paymentDiffTotal: new Prisma.Decimal(linkedMileageUsedTotal.toString())
          .minus(orderAmountTotal)
          .toString(),
        candidatePaymentDiffTotal: (
          totals.candidatePaymentDiffTotal ?? new Prisma.Decimal(0)
        ).toString(),
        unmatchedLinkedMileageTotal: totals.unmatchedLinkedMileageTotal.toString(),
        matchedWithoutPointHistoryTotal: totals.matchedWithoutPointHistoryTotal.toString(),
      },
      rows: rows.map((row) => ({
        userid: row.userid,
        linkedMileageUsed: row.linkedMileageUsed.toString(),
        matchedUserId: row.matchedUserId?.toString() ?? null,
        matchedName: row.matchedName,
        matchedLoginId: row.matchedLoginId,
        matchedEmail: row.matchedEmail,
        orderAmountTotal: row.orderAmountTotal.toString(),
        paymentDiff: row.paymentDiff.toString(),
        reason: row.reason,
      })),
    };
  },
  ['admin-sales-validation-reconciliation-v1'],
  { revalidate: 60 },
);

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!canAdmin(admin, 'user.read') && !canAdmin(admin, 'order.read')) {
    return NextResponse.json({ message: '관리자 권한이 없습니다.' }, { status: 403 });
  }

  const date = parseDate(request.nextUrl.searchParams.get('date'));
  const data = await getCachedReconciliation(date);
  return NextResponse.json(data);
}
