// Legacy sources: goods_qna_write.php
// Cache: no-store. Q&A writes are authenticated user mutations.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { createProductQna } from '@/server/services/product-qna.service';
import { createProductQnaSchema } from '@/schemas/product-qna';
import { AuthError, ValidationError, toApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) throw new AuthError();

    const parsed = createProductQnaSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid product Q&A.',
        parsed.error.flatten().fieldErrors,
      );
    }

    const data = await createProductQna(session.user.email, parsed.data);
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
