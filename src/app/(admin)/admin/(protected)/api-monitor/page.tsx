// Cache: no-store. API communication logs must reflect live partner traffic.

import type { Metadata } from 'next';
import { Prisma } from '@prisma/client';
import { Activity, Clock3, PlugZap, Search, ServerCrash, UserRound } from 'lucide-react';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import {
  AdminDataGrid,
  AdminMobileCard,
  AdminMobileField,
  adminGridCellClass,
  adminGridStickyCellClass,
} from '@/components/admin/AdminDataGrid';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminPageSizeSelect } from '@/components/admin/AdminPageSizeSelect';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import {
  AdminInfoTile,
  AdminPageHeader,
  AdminSection,
  adminFieldClass,
  adminPrimaryButtonClass,
} from '@/components/admin/AdminUI';
import { formatNumber } from '@/lib/format';
import { ApiMonitorRefreshControl } from './ApiMonitorRefreshControl';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'API 통신 관리',
  description: '레거시 연동 API와 회원 웹훅의 상태와 통신 이력을 확인합니다.',
};

const SERVICE_OPTIONS = [
  { value: '', label: '전체 API' },
  { value: 'gng-api', label: 'gng-api' },
  { value: 'point-sync', label: 'point-sync' },
  { value: 'member-webhook', label: '회원 웹훅' },
] as const;

const RESULT_OPTIONS = [
  { value: '', label: '전체 결과' },
  { value: 'success', label: '정상' },
  { value: 'failed', label: '오류' },
] as const;

const PAGE_SIZE_OPTIONS = [20, 30, 50, 100, 200];

type ApiMonitorSearchParams = {
  service?: string;
  result?: string;
  action?: string;
  q?: string;
  size?: string;
  page?: string;
};

type ApiLogRow = {
  id: string;
  service: string;
  endpoint: string;
  method: string;
  action: string | null;
  statusCode: number;
  success: boolean;
  durationMs: number | null;
  requestPayload: string | null;
  responsePayload: string | null;
  errorMessage: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  userId: string | null;
  loginId: string | null;
  memberName: string | null;
  memberEmail: string | null;
};

type ServiceSummaryRow = {
  service: string;
  total: number;
  successful: number;
  failed: number;
  avgDurationMs: number | null;
  latestAt: Date | null;
};

type QueryResult = {
  rows: ApiLogRow[];
  total: number;
  summaries: ServiceSummaryRow[];
  tableReady: boolean;
};

function parsePositiveInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function parseQuery(searchParams: ApiMonitorSearchParams) {
  const service = SERVICE_OPTIONS.some((option) => option.value === searchParams.service)
    ? (searchParams.service ?? '')
    : '';
  const result = RESULT_OPTIONS.some((option) => option.value === searchParams.result)
    ? (searchParams.result ?? '')
    : '';

  return {
    service,
    result,
    action: searchParams.action?.trim().slice(0, 80) ?? '',
    q: searchParams.q?.trim().slice(0, 120) ?? '',
    size: parsePositiveInt(searchParams.size, 30, 200),
    page: parsePositiveInt(searchParams.page, 1, 10000),
  };
}

function buildWhere(query: ReturnType<typeof parseQuery>) {
  const conditions: Prisma.Sql[] = [];
  if (query.service) conditions.push(Prisma.sql`"service" = ${query.service}`);
  if (query.result === 'success') {
    conditions.push(Prisma.sql`(
      "statusCode" >= 200
      AND "statusCode" < 400
      AND "success" = true
      AND "errorMessage" IS NULL
      AND COALESCE("responsePayload"->>'success', 'true') <> 'false'
    )`);
  }
  if (query.result === 'failed') {
    conditions.push(Prisma.sql`(
      "statusCode" < 200
      OR "statusCode" >= 400
      OR "success" = false
      OR "errorMessage" IS NOT NULL
      OR "responsePayload"->>'success' = 'false'
    )`);
  }
  if (query.action) conditions.push(Prisma.sql`"action" ILIKE ${`%${query.action}%`}`);
  if (query.q) {
    const keyword = `%${query.q}%`;
    conditions.push(Prisma.sql`(
      "endpoint" ILIKE ${keyword}
      OR "action" ILIKE ${keyword}
      OR "errorMessage" ILIKE ${keyword}
      OR "ip" ILIKE ${keyword}
      OR "loginId" ILIKE ${keyword}
      OR "memberName" ILIKE ${keyword}
      OR "memberEmail" ILIKE ${keyword}
      OR "requestPayload"::text ILIKE ${keyword}
      OR "responsePayload"::text ILIKE ${keyword}
    )`);
  }

  if (conditions.length === 0) return Prisma.empty;
  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

function buildParams(query: ReturnType<typeof parseQuery>) {
  const params = new URLSearchParams();
  if (query.service) params.set('service', query.service);
  if (query.result) params.set('result', query.result);
  if (query.action) params.set('action', query.action);
  if (query.q) params.set('q', query.q);
  if (query.size !== 30) params.set('size', String(query.size));
  return params;
}

function formatDateTime(value: Date | null): string {
  if (!value) return '-';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}:${part('second')}`;
}

function formatPayload(value: string | null): string {
  if (!value || value === 'null') return '-';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function serviceLabel(service: string): string {
  if (service === 'gng-api') return 'gng-api';
  if (service === 'point-sync') return 'point-sync';
  if (service === 'member-webhook') return '회원 웹훅';
  return service;
}

function actionLabel(row: Pick<ApiLogRow, 'action' | 'method' | 'service'>): string {
  if (row.action) return row.action;
  if (row.service === 'point-sync' && row.method === 'POST') return 'point_sync';
  if (row.service === 'member-webhook') return '회원등록';
  return '-';
}

function memberLabel(row: Pick<ApiLogRow, 'memberName' | 'loginId' | 'memberEmail'>): string {
  const primary = row.memberName || row.loginId || row.memberEmail;
  if (!primary) return '-';
  if (row.memberName && row.loginId) return `${row.memberName} / ${row.loginId}`;
  return primary;
}

function readPayloadErrorMessage(value: string | null): string | null {
  if (!value || value === 'null') return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (record.success !== false) return null;

    for (const key of ['message', 'errorMessage', 'error', 'detail']) {
      const message = record[key];
      if (typeof message === 'string' && message.trim()) return message;
    }

    return '실패 응답';
  } catch {
    return null;
  }
}

function errorMessage(
  row: Pick<ApiLogRow, 'success' | 'errorMessage' | 'responsePayload'>,
): string | null {
  return (
    row.errorMessage ||
    readPayloadErrorMessage(row.responsePayload) ||
    (!row.success ? '실패 응답' : null)
  );
}

function isSuccessfulLog(
  row: Pick<ApiLogRow, 'statusCode' | 'success' | 'errorMessage' | 'responsePayload'>,
  message = errorMessage(row),
): boolean {
  return row.statusCode >= 200 && row.statusCode < 400 && row.success && !message;
}

function successRate(summary: ServiceSummaryRow | undefined): string {
  if (!summary || summary.total === 0) return '-';
  return `${Math.round((summary.successful / summary.total) * 100)}%`;
}

async function loadApiLogs(query: ReturnType<typeof parseQuery>): Promise<QueryResult> {
  const where = buildWhere(query);
  const offset = (query.page - 1) * query.size;
  const allLogs = Prisma.sql`
    SELECT
      'api:' || "id"::text AS "id",
      "service",
      "endpoint",
      "method",
      "action",
      "statusCode",
      "success",
      "durationMs",
      "requestPayload",
      "responsePayload",
      "errorMessage",
      "ip",
      "userAgent",
      "createdAt",
      NULL::text AS "userId",
      NULL::text AS "loginId",
      NULL::text AS "memberName",
      NULL::text AS "memberEmail"
    FROM "ApiCommunicationLog"
    UNION ALL
    SELECT
      'member-webhook:' || "id"::text AS "id",
      'member-webhook' AS "service",
      "endpoint",
      "method",
      'register_member' AS "action",
      COALESCE("statusCode", 0) AS "statusCode",
      "success",
      NULL::int AS "durationMs",
      "requestPayload",
      "responsePayload",
      "errorMessage",
      NULL::text AS "ip",
      NULL::text AS "userAgent",
      "createdAt",
      "userId"::text AS "userId",
      "loginId",
      "name" AS "memberName",
      "email" AS "memberEmail"
    FROM "ExternalMemberWebhookLog"
  `;

  try {
    const [rows, countRows, summaries] = await Promise.all([
      prisma.$queryRaw<ApiLogRow[]>(Prisma.sql`
        WITH "AllLogs" AS (${allLogs})
        SELECT
          "id"::text AS "id",
          "service",
          "endpoint",
          "method",
          "action",
          "statusCode",
          "success",
          "durationMs",
          "requestPayload"::text AS "requestPayload",
          "responsePayload"::text AS "responsePayload",
          "errorMessage",
          "ip",
          "userAgent",
          "createdAt",
          "userId",
          "loginId",
          "memberName",
          "memberEmail"
        FROM "AllLogs"
        ${where}
        ORDER BY "createdAt" DESC
        LIMIT ${query.size}
        OFFSET ${offset}
      `),
      prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        WITH "AllLogs" AS (${allLogs})
        SELECT COUNT(*) AS "total"
        FROM "AllLogs"
        ${where}
      `),
      prisma.$queryRaw<ServiceSummaryRow[]>(Prisma.sql`
        WITH "AllLogs" AS (${allLogs})
        SELECT
          "service",
          COUNT(*)::int AS "total",
          SUM(CASE
            WHEN "statusCode" >= 200
              AND "statusCode" < 400
              AND "success" = true
              AND "errorMessage" IS NULL
              AND COALESCE("responsePayload"->>'success', 'true') <> 'false'
            THEN 1 ELSE 0
          END)::int AS "successful",
          SUM(CASE
            WHEN "statusCode" < 200
              OR "statusCode" >= 400
              OR "success" = false
              OR "errorMessage" IS NOT NULL
              OR "responsePayload"->>'success' = 'false'
            THEN 1 ELSE 0
          END)::int AS "failed",
          ROUND(AVG("durationMs"))::int AS "avgDurationMs",
          MAX("createdAt") AS "latestAt"
        FROM "AllLogs"
        WHERE "createdAt" >= NOW() - INTERVAL '24 hours'
          AND "service" IN ('gng-api', 'point-sync', 'member-webhook')
        GROUP BY "service"
      `),
    ]);

    return {
      rows,
      total: Number(countRows[0]?.total ?? 0),
      summaries,
      tableReady: true,
    };
  } catch {
    return {
      rows: [],
      total: 0,
      summaries: [],
      tableReady: false,
    };
  }
}

export default async function AdminApiMonitorPage({
  searchParams,
}: {
  searchParams: ApiMonitorSearchParams;
}) {
  await requireAdmin('api.read');
  const query = parseQuery(searchParams);
  const data = await loadApiLogs(query);
  const logs = data.rows;
  const params = buildParams(query);
  const baseHref = `/admin/api-monitor${params.toString() ? `?${params.toString()}` : ''}`;
  const totalPages = Math.max(1, Math.ceil(data.total / query.size));
  const hasNext = query.page < totalPages;
  const hiddenFields = Array.from(params.entries()).map(([name, value]) => ({ name, value }));
  const gngSummary = data.summaries.find((summary) => summary.service === 'gng-api');
  const pointSummary = data.summaries.find((summary) => summary.service === 'point-sync');
  const memberWebhookSummary = data.summaries.find(
    (summary) => summary.service === 'member-webhook',
  );
  const failed24h = data.summaries.reduce((sum, summary) => sum + summary.failed, 0);
  const latestAt =
    data.summaries
      .map((summary) => summary.latestAt)
      .filter((value): value is Date => value instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const queriedAt = formatDateTime(new Date());

  return (
    <div className="min-w-0 space-y-4">
      <AdminPageHeader
        eyebrow="API"
        title="API 통신 관리"
        description="gng-api, point-sync, 회원 웹훅 연동 상태와 요청/응답 이력을 확인합니다."
        actions={<ApiMonitorRefreshControl queriedAt={queriedAt} />}
      />

      <div className="grid gap-3 md:grid-cols-5">
        <AdminInfoTile
          label="gng-api 24시간 정상률"
          value={successRate(gngSummary)}
          icon={PlugZap}
        />
        <AdminInfoTile
          label="point-sync 24시간 정상률"
          value={successRate(pointSummary)}
          icon={Activity}
        />
        <AdminInfoTile
          label="회원 웹훅 24시간 오류"
          value={`${formatNumber(memberWebhookSummary?.failed ?? 0)}건`}
          icon={UserRound}
        />
        <AdminInfoTile
          label="24시간 오류"
          value={`${formatNumber(failed24h)}건`}
          icon={ServerCrash}
        />
        <AdminInfoTile label="최근 통신" value={formatDateTime(latestAt)} icon={Clock3} />
      </div>

      {!data.tableReady ? (
        <AdminSection
          title="로그 테이블 준비 필요"
          description="배포 시 prisma migrate deploy가 실행되면 통신 이력이 기록됩니다."
          icon={ServerCrash}
        >
          <p className="text-sm font-medium text-neutral-600">
            통신 로그 테이블을 찾지 못했습니다. 마이그레이션 적용 후 다시 확인해주세요.
          </p>
        </AdminSection>
      ) : null}

      <form
        method="get"
        className="rounded-lg border border-neutral-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.045)] ring-1 ring-white sm:p-4"
      >
        <div className="grid gap-3 md:grid-cols-[150px_140px_160px_minmax(220px,1fr)_auto] md:items-end">
          <label className="grid gap-1 text-xs font-bold text-neutral-600">
            API
            <select
              name="service"
              defaultValue={query.service}
              className={`${adminFieldClass} h-11`}
            >
              {SERVICE_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-neutral-600">
            결과
            <select name="result" defaultValue={query.result} className={`${adminFieldClass} h-11`}>
              {RESULT_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-neutral-600">
            액션
            <input
              name="action"
              defaultValue={query.action}
              placeholder="list_members, register_member"
              className={`${adminFieldClass} h-11`}
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-neutral-600">
            검색
            <input
              name="q"
              defaultValue={query.q}
              placeholder="회원명, 아이디, IP, 오류 메시지"
              className={`${adminFieldClass} h-11`}
            />
          </label>
          <button className={`${adminPrimaryButtonClass} h-11`}>
            <Search size={18} />
            조회
          </button>
          {query.size !== 30 ? <input type="hidden" name="size" value={query.size} /> : null}
        </div>
      </form>

      <AdminSection
        title="통신 이력"
        description={`검색 결과 ${formatNumber(data.total)}건 · ${formatNumber(query.page)} / 총 ${formatNumber(totalPages)}페이지`}
        icon={PlugZap}
        bodyClassName="p-0"
        headerAction={
          <AdminPageSizeSelect
            action="/admin/api-monitor"
            name="size"
            value={query.size}
            options={PAGE_SIZE_OPTIONS}
            hiddenFields={hiddenFields}
            label="표시"
            ariaLabel="통신 이력 표시 개수"
          />
        }
      >
        <AdminDataGrid
          columns={[
            { key: 'no', label: 'No', align: 'right', widthClassName: 'w-16' },
            { key: 'createdAt', label: '시간', widthClassName: 'w-44' },
            { key: 'service', label: 'API', widthClassName: 'w-28' },
            { key: 'action', label: '액션', widthClassName: 'w-36' },
            { key: 'member', label: '회원', widthClassName: 'w-52' },
            { key: 'method', label: 'Method', widthClassName: 'w-20' },
            { key: 'status', label: '상태', widthClassName: 'w-24' },
            { key: 'error', label: '오류 메시지', widthClassName: 'w-56' },
            { key: 'duration', label: '응답', align: 'right', widthClassName: 'w-24' },
            { key: 'ip', label: 'IP', widthClassName: 'w-36' },
            { key: 'detail', label: '상세' },
          ]}
          rows={logs}
          rowKey={(row) => row.id}
          emptyText="통신 이력이 없습니다."
          minWidthClassName="min-w-[1280px]"
          scrollAreaClassName="max-h-[480px]"
          mobileScrollAreaClassName="max-h-[560px] overflow-y-auto"
          renderRow={(row, index) => {
            const message = errorMessage(row);
            const isSuccess = isSuccessfulLog(row, message);
            const rowNo = data.total - (query.page - 1) * query.size - index;

            return (
              <tr key={row.id} className="hover:bg-neutral-50">
                <td className={`${adminGridCellClass} text-right text-neutral-500`}>
                  {formatNumber(rowNo)}
                </td>
                <td className={`${adminGridStickyCellClass} font-semibold text-neutral-800`}>
                  {formatDateTime(row.createdAt)}
                </td>
                <td className={adminGridCellClass}>{serviceLabel(row.service)}</td>
                <td className={adminGridCellClass}>{actionLabel(row)}</td>
                <td className={adminGridCellClass}>
                  <span className="line-clamp-2 text-xs font-semibold text-neutral-700">
                    {memberLabel(row)}
                  </span>
                </td>
                <td className={`${adminGridCellClass} font-mono`}>{row.method}</td>
                <td className={adminGridCellClass}>
                  <div className="grid gap-1">
                    <div className="flex items-center gap-2">
                      <AdminStatusBadge status={isSuccess ? 'success' : 'failed'} />
                      <span className="font-mono text-[11px] text-neutral-500">
                        {row.statusCode}
                      </span>
                    </div>
                  </div>
                </td>
                <td className={adminGridCellClass}>
                  {message ? (
                    <span className="line-clamp-3 text-xs font-semibold text-rose-700">
                      {message}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400">-</span>
                  )}
                </td>
                <td className={`${adminGridCellClass} text-right font-mono`}>
                  {row.durationMs === null ? '-' : `${formatNumber(row.durationMs)}ms`}
                </td>
                <td className={`${adminGridCellClass} font-mono`}>{row.ip ?? '-'}</td>
                <td className={adminGridCellClass}>
                  <details className="group">
                    <summary className="cursor-pointer text-xs font-bold text-neutral-700 underline-offset-2 hover:underline">
                      요청/응답
                    </summary>
                    <div className="mt-2 grid gap-2 rounded-md bg-neutral-50 p-3">
                      {row.errorMessage ? (
                        <p className="rounded border border-rose-100 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">
                          {row.errorMessage}
                        </p>
                      ) : null}
                      {row.memberName || row.loginId || row.memberEmail ? (
                        <div className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs font-semibold text-neutral-700">
                          회원: {memberLabel(row)}
                          {row.memberEmail ? ` / ${row.memberEmail}` : ''}
                        </div>
                      ) : null}
                      <div>
                        <p className="mb-1 text-[11px] font-extrabold text-neutral-500">요청</p>
                        <pre className="max-h-44 overflow-auto rounded bg-white p-2 font-mono text-[11px] leading-4 text-neutral-700 ring-1 ring-neutral-200">
                          {formatPayload(row.requestPayload)}
                        </pre>
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-extrabold text-neutral-500">응답</p>
                        <pre className="max-h-44 overflow-auto rounded bg-white p-2 font-mono text-[11px] leading-4 text-neutral-700 ring-1 ring-neutral-200">
                          {formatPayload(row.responsePayload)}
                        </pre>
                      </div>
                    </div>
                  </details>
                </td>
              </tr>
            );
          }}
          renderMobileCard={(row) => {
            const message = errorMessage(row);
            const isSuccess = isSuccessfulLog(row, message);

            return (
              <AdminMobileCard>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-neutral-950">
                      {serviceLabel(row.service)}
                    </p>
                    <p className="mt-1 text-xs font-medium text-neutral-500">
                      {formatDateTime(row.createdAt)}
                    </p>
                  </div>
                  <AdminStatusBadge status={isSuccess ? 'success' : 'failed'} />
                </div>
                <dl className="grid grid-cols-2 gap-2">
                  <AdminMobileField label="액션">{actionLabel(row)}</AdminMobileField>
                  <AdminMobileField label="상태">{row.statusCode}</AdminMobileField>
                  <AdminMobileField label="회원">{memberLabel(row)}</AdminMobileField>
                  <AdminMobileField label="오류 메시지">{message ?? '-'}</AdminMobileField>
                  <AdminMobileField label="응답" align="right">
                    {row.durationMs === null ? '-' : `${formatNumber(row.durationMs)}ms`}
                  </AdminMobileField>
                  <AdminMobileField label="IP">{row.ip ?? '-'}</AdminMobileField>
                </dl>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-bold text-neutral-700">
                    요청/응답
                  </summary>
                  <pre className="mt-2 max-h-56 overflow-auto rounded bg-neutral-50 p-3 font-mono text-[11px] leading-4 text-neutral-700 ring-1 ring-neutral-200">
                    {formatPayload(row.requestPayload)}
                  </pre>
                  <pre className="mt-2 max-h-56 overflow-auto rounded bg-neutral-50 p-3 font-mono text-[11px] leading-4 text-neutral-700 ring-1 ring-neutral-200">
                    {formatPayload(row.responsePayload)}
                  </pre>
                </details>
              </AdminMobileCard>
            );
          }}
        />
      </AdminSection>
      <AdminPagination
        baseHref={baseHref}
        page={query.page}
        hasNext={hasNext}
        totalPages={totalPages}
      />
    </div>
  );
}
