// Legacy sources: goods_qna_write.php
// Cache: no-store. Q&A writes are user mutations; legacy allowed guest writes.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { createProductQna } from '@/server/services/product-qna.service';
import { createProductQnaSchema } from '@/schemas/product-qna';
import { ValidationError, toApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    const parsed = createProductQnaSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError(
        '문의 내용을 확인해 주세요.',
        parsed.error.flatten().fieldErrors,
      );
    }

    const data = await createProductQna(session?.user?.email ?? null, parsed.data);
    return NextResponse.json(
      { ok: true, data },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const apiError = toApiError(err);
    return NextResponse.json(apiError.body, {
      status: apiError.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
