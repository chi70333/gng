import iconv from 'iconv-lite';
import { NextRequest, NextResponse } from 'next/server';

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
