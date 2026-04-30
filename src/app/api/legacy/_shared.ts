import iconv from 'iconv-lite';
import { NextRequest, NextResponse } from 'next/server';
import {
  type ApiCommunicationService,
  recordApiCommunicationLog,
} from '@/server/services/api-communication-log.service';

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
    'Cache-Control': 'no-store',
  };
}

export function legacyOptions(): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export function legacyJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function isSuccessfulResponse(status: number, body: unknown): boolean {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'success' in body) {
    return status >= 200 && status < 400 && (body as { success: unknown }).success !== false;
  }
  return status >= 200 && status < 400;
}

function readClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip') || null;
}

export async function legacyLoggedJson(
  req: NextRequest,
  input: {
    service: ApiCommunicationService;
    startedAt: number;
    action?: string | null;
    requestPayload?: unknown;
    responsePayload: unknown;
    status?: number;
    errorMessage?: string | null;
  },
): Promise<NextResponse> {
  const status = input.status ?? 200;
  const response = legacyJson(input.responsePayload, status);

  await recordApiCommunicationLog({
    service: input.service,
    endpoint: req.nextUrl.pathname,
    method: req.method,
    action: input.action,
    statusCode: status,
    success: isSuccessfulResponse(status, input.responsePayload),
    durationMs: Date.now() - input.startedAt,
    requestPayload: input.requestPayload,
    responsePayload: input.responsePayload,
    errorMessage: input.errorMessage,
    ip: readClientIp(req),
    userAgent: req.headers.get('user-agent'),
  });

  return response;
}

export function isLegacyAuthorized(req: NextRequest): boolean {
  // Temporary legacy cutover mode: partners must be able to switch only the URL
  // from the PHP host to Next.js without changing headers or query params.
  void req;
  return true;
}

function readCharset(contentType: string | null): string | null {
  const match = contentType?.match(/(?:^|;)\s*charset=([^;]+)/i);
  return match?.[1]?.trim().replace(/^"|"$/g, '').toLowerCase() ?? null;
}

function isKoreanLegacyCharset(charset: string | null): boolean {
  return (
    charset === 'euc-kr' ||
    charset === 'euckr' ||
    charset === 'cp949' ||
    charset === 'ks_c_5601-1987' ||
    charset === 'x-windows-949'
  );
}

function decodeBody(bytes: Buffer, contentType: string | null): string {
  const charset = readCharset(contentType);
  if (isKoreanLegacyCharset(charset)) return iconv.decode(bytes, 'cp949');

  const utf8 = bytes.toString('utf8');
  if (utf8.includes('\uFFFD')) {
    const cp949 = iconv.decode(bytes, 'cp949');
    if (!cp949.includes('\uFFFD')) return cp949;
  }
  return utf8;
}

export async function readJsonBody(req: NextRequest): Promise<unknown> {
  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length === 0) return null;

  const text = decodeBody(bytes, req.headers.get('content-type')).replace(/^\uFEFF/, '');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
