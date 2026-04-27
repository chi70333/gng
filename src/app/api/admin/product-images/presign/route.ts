import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { adminProductImageUploadSchema } from '@/schemas/admin-product-image';
import { requireAdmin } from '@/server/admin/auth';
import { createPresignedProductImageUpload } from '@/server/storage/r2-presign';
import { toApiError, ValidationError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function compactFieldErrors(
  fields: Record<string, string[] | undefined>,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(fields).filter((entry): entry is [string, string[]] => Boolean(entry[1])),
  );
}

export async function POST(request: Request) {
  try {
    await requireAdmin('product.write');
    const parsed = adminProductImageUploadSchema.parse(await request.json());
    const upload = createPresignedProductImageUpload(parsed);

    return NextResponse.json({ ok: true, data: upload });
  } catch (error) {
    if (error instanceof ZodError) {
      const apiError = toApiError(
        new ValidationError(
          '이미지 파일 정보를 확인해 주세요.',
          compactFieldErrors(error.flatten().fieldErrors),
        ),
      );
      return NextResponse.json(apiError.body, { status: apiError.status });
    }

    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
