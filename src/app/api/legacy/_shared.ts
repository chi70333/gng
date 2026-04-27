import { NextRequest, NextResponse } from 'next/server';

export function corsHeaders(): HeadersInit {
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
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

export function isLegacyAuthorized(req: NextRequest): boolean {
  if (process.env.LEGACY_API_AUTH_DISABLED === '1') return true;

  const token = process.env.LEGACY_API_TOKEN;
  if (!token) return false;

  const apiKey = req.headers.get('x-api-key');
  const authorization = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const queryToken =
    req.nextUrl.searchParams.get('api_key') ??
    req.nextUrl.searchParams.get('token') ??
    req.nextUrl.searchParams.get('key');

  return apiKey === token || authorization === token || queryToken === token;
}

export async function readJsonBody(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
