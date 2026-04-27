// Legacy sources: legacy/www/cart_ok_ajax.php
// Compatibility: chang_cnt => "1" or {"error":"1","msg":stock}; add => "0||<skuId>"; beforechk => "total|update|insert".
// Cache: no-store. Shared Redis cart TTL is 30d.

import { NextRequest } from 'next/server';
import {
  addCartItem,
  addCartProduct,
  getCart,
  updateCartItem,
} from '@/server/services/cart.service';
import {
  legacyCartAddSchema,
  legacyCartChangeCountSchema,
} from '@/schemas/cart';
import { ConflictError } from '@/lib/errors';
import {
  formDataToRecord,
  legacyBeforeCheckResponse,
  legacyTextResponse,
  resolveLegacyCartIdentity,
} from '@/app/api/cart/legacy-compat';

export const dynamic = 'force-dynamic';

function firstQueryValue(req: NextRequest, key: string): string | undefined {
  return req.nextUrl.searchParams.get(key) ?? undefined;
}

async function legacyCartOkAjax(req: NextRequest) {
  const { identity, guestIdToSet, guestIdToClear } = await resolveLegacyCartIdentity(req);
  const form = await formDataToRecord(req);
  const input = {
    ...Object.fromEntries(req.nextUrl.searchParams),
    ...form,
    goodsIdxSingle: firstQueryValue(req, 'goodsIdx'),
  };

  const changeCount = legacyCartChangeCountSchema.safeParse(input);
  if (changeCount.success) {
    try {
      await updateCartItem(identity, changeCount.data.idx, changeCount.data.cnt);
      return legacyTextResponse('1', 200, guestIdToSet, guestIdToClear);
    } catch (err) {
      if (err instanceof ConflictError) {
        return legacyTextResponse(
          JSON.stringify({ error: '1', msg: err.message }),
          200,
          guestIdToSet,
          guestIdToClear,
        );
      }
      return legacyTextResponse('0', 404, guestIdToSet, guestIdToClear);
    }
  }

  const addInput = legacyCartAddSchema.safeParse(input);
  if (!addInput.success) {
    return legacyTextResponse('0', 400, guestIdToSet, guestIdToClear);
  }

  const skuId = addInput.data.skuId;
  if (addInput.data.mode === 'beforechk') {
    const cart = await getCart(identity);
    return legacyTextResponse(
      legacyBeforeCheckResponse(cart, skuId),
      200,
      guestIdToSet,
      guestIdToClear,
    );
  }

  try {
    const cart = skuId
      ? await addCartItem(identity, skuId, addInput.data.quantity)
      : await addCartProduct(
          identity,
          addInput.data.goodsIdx ?? addInput.data.goodsIdxSingle ?? '',
          addInput.data.quantity,
        );
    const addedSkuId = skuId ?? cart.items.at(-1)?.skuId ?? '';
    return legacyTextResponse(`0||${addedSkuId}`, 200, guestIdToSet, guestIdToClear);
  } catch (err) {
    if (err instanceof ConflictError) {
      return legacyTextResponse(
        `장바구니에 담으시려는 제품의 재고가 부족합니다.\n현재 제품의 재고는 ${err.message}개 입니다.`,
        200,
        guestIdToSet,
        guestIdToClear,
      );
    }
    return legacyTextResponse('0', 404, guestIdToSet, guestIdToClear);
  }
}

export async function GET(req: NextRequest) {
  return legacyCartOkAjax(req);
}

export async function POST(req: NextRequest) {
  return legacyCartOkAjax(req);
}
