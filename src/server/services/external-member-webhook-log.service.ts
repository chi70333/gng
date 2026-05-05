import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { prisma } from '@/server/db';

type JsonLike = Prisma.InputJsonValue | null;

type ExternalMemberWebhookLogInput = {
  userId?: string | bigint | null;
  provider: string;
  loginId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  endpoint: string;
  method?: string;
  statusCode?: number | null;
  success: boolean;
  errorMessage?: string | null;
  requestPayload?: unknown;
  responsePayload?: unknown;
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
    const sanitized: Record<string, JsonLike> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      sanitized[key] = SECRET_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeJson(item, depth + 1);
    }
    return sanitized as Prisma.InputJsonObject;
  }

  return String(value);
}

function bigintUserId(value: ExternalMemberWebhookLogInput['userId']): bigint | undefined {
  if (typeof value === 'bigint') return value;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined;
  return BigInt(value);
}

export async function recordExternalMemberWebhookLog(
  input: ExternalMemberWebhookLogInput,
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  if (!('externalMemberWebhookLog' in prisma)) return;

  try {
    await prisma.externalMemberWebhookLog.create({
      data: {
        userId: bigintUserId(input.userId),
        provider: input.provider,
        loginId: input.loginId ?? null,
        name: input.name ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        endpoint: input.endpoint,
        method: input.method ?? 'POST',
        statusCode: input.statusCode ?? null,
        success: input.success,
        errorMessage: input.errorMessage ?? null,
        requestPayload: sanitizeJson(input.requestPayload) ?? Prisma.JsonNull,
        responsePayload: sanitizeJson(input.responsePayload) ?? Prisma.JsonNull,
      },
    });
  } catch (err) {
    logger.error(
      { err, loginId: input.loginId, endpoint: input.endpoint },
      'External member webhook log write failed',
    );
  }
}
