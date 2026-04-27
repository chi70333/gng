// Legacy sources: legacy/www/cart_del_ajax.php
// Compatibility: POST/GET ?idx=<skuId> or ?mode=arr&idx=1,2 returns "1".
// Cache: no-store. Shared Redis cart TTL is 30d.

import { NextRequest } from 'next/server';
import { deleteCartItems } from '@/server/services/cart.service';
import { legacyCartDeleteSchema } from '@/schemas/cart';
import {
  formDataToRecord,
  legacyTextResponse,
  resolveLegacyCartIdentity,
} from '@/app/api/cart/legacy-compat';

export const dynamic = 'force-dynamic';

async function legacyCartDelete(req: NextRequest) {
  const { identity, guestIdToSet, guestIdToClear } = await resolveLegacyCartIdentity(req);
  const parsed = legacyCartDeleteSchema.safeParse({
    mode: req.nextUrl.searchParams.get('mode') ?? 'single',
    idx:
      req.nextUrl.searchParams.get('idx') ??
      (await formDataToRecord(req)).idx ??
      '',
  });

  if (!parsed.success) {
    return legacyTextResponse('0', 400, guestIdToSet, guestIdToClear);
  }

  await deleteCartItems(identity, parsed.data.idx);
  return legacyTextResponse('1', 200, guestIdToSet, guestIdToClear);
}

export async function GET(req: NextRequest) {
  return legacyCartDelete(req);
}

export async function POST(req: NextRequest) {
  return legacyCartDelete(req);
}
