import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { prisma } from '@/server/db';

type JsonLike = Prisma.InputJsonValue | null;

export type ApiCommunicationService = 'gng-api' | 'point-sync';

type ApiCommunicationLogInput = {
  service: ApiCommunicationService;
  endpoint: string;
  method: string;
  action?: string | null;
  statusCode: number;
  success: boolean;
  durationMs?: number | null;
  requestPayload?: unknown;
  responsePayload?: unknown;
  errorMessage?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

const SECRET_KEY_PATTERN = /password|pass|token|authorization|api[-_]?key|secret/i;
const MAX_STRING_LENGTH = 600;
const MAX_ARRAY_ITEMS = 12;
const MAX_DEPTH = 4;

function clipString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}...`;
}

function sanitizeJson(value: unknown, depth = 0): JsonLike {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return clipString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return '[truncated]';

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeJson(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`[${value.length - MAX_ARRAY_ITEMS} more]`);
    return items as Prisma.InputJsonArray;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sanitized: Record<string, JsonLike> = {};
    for (const [key, item] of Object.entries(record)) {
      sanitized[key] = SECRET_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeJson(item, depth + 1);
    }
    return sanitized as Prisma.InputJsonObject;
  }

  return String(value);
}

function jsonText(value: unknown): string {
  return JSON.stringify(sanitizeJson(value));
}

export async function recordApiCommunicationLog(input: ApiCommunicationLogInput): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  try {
    await prisma.$executeRaw`
      INSERT INTO "ApiCommunicationLog" (
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
        "userAgent"
      )
      VALUES (
        ${input.service},
        ${input.endpoint},
        ${input.method},
        ${input.action ?? null},
        ${input.statusCode},
        ${input.success},
        ${input.durationMs ?? null},
        CAST(${jsonText(input.requestPayload)} AS jsonb),
        CAST(${jsonText(input.responsePayload)} AS jsonb),
        ${input.errorMessage ?? null},
        ${input.ip ?? null},
        ${input.userAgent ?? null}
      )
    `;
  } catch (err) {
    logger.error({ err, service: input.service, endpoint: input.endpoint }, 'API log write failed');
  }
}
