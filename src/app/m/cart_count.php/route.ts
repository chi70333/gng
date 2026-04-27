// Legacy sources: legacy/www/m/cart_count.php and header JS calls to /m/cart_count.php.
// Compatibility: GET returns the current cart line-item count as plain text.
// Cache: no-store. Shared Redis cart TTL is 30d.

import { NextRequest } from 'next/server';
import { getCart } from '@/server/services/cart.service';
import {
  legacyTextResponse,
  resolveLegacyCartIdentity,
} from '@/app/api/cart/legacy-compat';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { identity, guestIdToSet, guestIdToClear } = await resolveLegacyCartIdentity(req);
  const cart = await getCart(identity);
  return legacyTextResponse(
    String(cart.items.length),
    200,
    guestIdToSet,
    guestIdToClear,
  );
}
