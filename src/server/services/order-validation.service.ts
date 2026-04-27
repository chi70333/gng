// Legacy sources: order_method_check.php, order_table_trans_chk.php
// Cache: no-cache. Validation reads current stock and the per-user/per-guest cart.

import { getCart, type CartIdentity } from '@/server/services/cart.service';
import { prisma } from '@/server/db';

export type OrderValidationResult = {
  valid: boolean;
  issues: Array<{
    skuId: string;
    message: string;
  }>;
};

export async function validateCartForOrder(
  identity: CartIdentity,
): Promise<OrderValidationResult> {
  const cart = await getCart(identity);
  if (cart.items.length === 0) {
    return { valid: false, issues: [{ skuId: '', message: 'Cart is empty.' }] };
  }

  const skus = await prisma.productSku.findMany({
    where: { id: { in: cart.items.map((item) => BigInt(item.skuId)) } },
    select: { id: true, stock: true, reserved: true, isActive: true },
  });
  const skuMap = new Map(skus.map((sku) => [sku.id.toString(), sku]));

  const issues = cart.items.flatMap((item) => {
    const sku = skuMap.get(item.skuId);
    if (!sku || !sku.isActive) {
      return [{ skuId: item.skuId, message: 'Product option is no longer available.' }];
    }
    if (sku.stock - sku.reserved < item.quantity) {
      return [{ skuId: item.skuId, message: 'Not enough stock.' }];
    }
    return [];
  });

  return { valid: issues.length === 0, issues };
}
