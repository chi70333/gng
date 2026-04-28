// Product view tracking API.
// Cache: no-store. Redis de-dupes the same visitor/product for 30m before DB increment.

import { createHash, randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { countProductView } from '@/server/services/product.service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const PRODUCT_VIEW_COOKIE = 'gng_product_view_id';
const PRODUCT_VIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const productViewParamsSchema = z.object({
  id: z.string().trim().min(1).max(160),
});

function clientFingerprint(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = req.headers.get('x-real-ip')?.trim();
  const userAgent = req.headers.get('user-agent') ?? '';
  return createHash('sha256')
    .update(`${forwardedFor || realIp || 'unknown'}:${userAgent}`)
    .digest('hex');
}

function visitorId(req: NextRequest): { value: string; shouldSetCookie: boolean } {
  const cookieValue = req.cookies.get(PRODUCT_VIEW_COOKIE)?.value;
  if (cookieValue) return { value: cookieValue, shouldSetCookie: false };

  return {
    value: `anon:${randomUUID()}:${clientFingerprint(req)}`,
    shouldSetCookie: true,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const parsed = productViewParamsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION',
          message: '상품 식별자가 올바르지 않습니다.',
          fields: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const visitor = visitorId(req);

  try {
    const result = await countProductView(parsed.data.id, visitor.value);
    const body = result.found
      ? { ok: true, counted: result.counted }
      : {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: '상품을 찾을 수 없습니다.',
          },
        };
    const response = NextResponse.json(body, {
      status: result.found ? 200 : 404,
      headers: { 'Cache-Control': 'no-store' },
    });

    if (visitor.shouldSetCookie) {
      response.cookies.set(PRODUCT_VIEW_COOKIE, visitor.value, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: PRODUCT_VIEW_COOKIE_MAX_AGE,
        path: '/',
      });
    }

    return response;
  } catch (err) {
    logger.error({ err, slug: parsed.data.id }, 'POST /api/goods/[id]/view failed');
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '조회수 처리 중 오류가 발생했습니다.',
        },
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
