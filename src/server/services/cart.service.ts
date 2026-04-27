// Legacy sources: cart.php, cart_ok.php, cart_ok_ajax.php, cart_del_ajax.php
// Cache: per-user Redis cart, 30d TTL. No page/API public cache.

import { Decimal } from '@prisma/client/runtime/library';
import { keys, redis } from '@/server/redis';
import { prisma } from '@/server/db';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export const CART_TTL_SECONDS = 60 * 60 * 24 * 30;

export type CartIdentity =
  | { type: 'user'; id: string }
  | { type: 'guest'; id: string };

export type CartItem = {
  skuId: string;
  productId: string;
  slug: string;
  name: string;
  thumbnail: string | null;
  optionSummary: string | null;
  unitPrice: string;
  quantity: number;
  addedAt: string;
  isAvailable: boolean;
  availableQuantity: number;
  stockMessage: string | null;
};

export type Cart = {
  items: CartItem[];
  subtotal: string;
};

function cartKey(identity: CartIdentity): string {
  return identity.type === 'user'
    ? keys.cartUser(identity.id)
    : keys.cartGuest(identity.id);
}

function summarizeOptions(optionValues: unknown): string | null {
  if (!optionValues || typeof optionValues !== 'object' || Array.isArray(optionValues)) {
    return null;
  }

  return Object.entries(optionValues)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
}

function withSubtotal(items: CartItem[]): Cart {
  const subtotal = items.reduce(
    (sum, item) => sum.plus(new Decimal(item.unitPrice).mul(item.quantity)),
    new Decimal(0),
  );

  return { items, subtotal: subtotal.toString() };
}

async function readItems(identity: CartIdentity): Promise<CartItem[]> {
  try {
    return (await redis.get<CartItem[]>(cartKey(identity))) ?? [];
  } catch (err) {
    logger.error({ err }, 'cart Redis get failed');
    return [];
  }
}

async function writeItems(identity: CartIdentity, items: CartItem[]): Promise<void> {
  await redis.set(cartKey(identity), items, { ex: CART_TTL_SECONDS });
}

async function hydrateItems(items: CartItem[]): Promise<CartItem[]> {
  const skuIds = items
    .map((item) => BigInt(item.skuId))
    .filter((skuId, index, arr) => arr.indexOf(skuId) === index);

  if (skuIds.length === 0) return items;

  const skus = await prisma.productSku.findMany({
    where: { id: { in: skuIds } },
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          thumbnail: true,
          price: true,
          salePrice: true,
          status: true,
          deletedAt: true,
        },
      },
    },
  });
  const skuById = new Map(skus.map((sku) => [sku.id.toString(), sku]));

  return items.map((item) => {
    const sku = skuById.get(item.skuId);
    if (!sku || !sku.isActive || sku.product.status !== 'active' || sku.product.deletedAt) {
      return {
        ...item,
        isAvailable: false,
        availableQuantity: 0,
        stockMessage: '현재 구매할 수 없는 상품입니다.',
      };
    }

    const availableQuantity = Math.max(0, sku.stock - sku.reserved);
    const isAvailable = availableQuantity >= item.quantity;
    return {
      ...item,
      productId: sku.product.id.toString(),
      slug: sku.product.slug,
      name: sku.product.name,
      thumbnail: sku.product.thumbnail,
      optionSummary: summarizeOptions(sku.optionValues),
      unitPrice: (sku.product.salePrice ?? sku.product.price).plus(sku.priceDelta).toString(),
      isAvailable,
      availableQuantity,
      stockMessage: isAvailable
        ? null
        : availableQuantity === 0
          ? '품절된 상품입니다.'
          : `재고부족 - 현재 재고량: ${availableQuantity}개`,
    };
  });
}

export async function getCart(identity: CartIdentity): Promise<Cart> {
  return withSubtotal(await hydrateItems(await readItems(identity)));
}

export async function addCartItem(
  identity: CartIdentity,
  skuId: string,
  quantity: number,
): Promise<Cart> {
  const sku = await prisma.productSku.findUnique({
    where: { id: BigInt(skuId) },
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          thumbnail: true,
          price: true,
          salePrice: true,
          status: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!sku || !sku.isActive || sku.product.status !== 'active' || sku.product.deletedAt) {
    throw new NotFoundError('Product option not found.');
  }

  const available = sku.stock - sku.reserved;
  if (available < quantity) {
    throw new ConflictError(String(Math.max(0, available)));
  }

  const items = await readItems(identity);
  const existing = items.find((item) => item.skuId === skuId);

  if (existing) {
    const nextQuantity = Math.min(existing.quantity + quantity, available, 99);
    existing.quantity = nextQuantity;
  } else {
    items.push({
      skuId,
      productId: sku.product.id.toString(),
      slug: sku.product.slug,
      name: sku.product.name,
      thumbnail: sku.product.thumbnail,
      optionSummary: summarizeOptions(sku.optionValues),
      unitPrice: (sku.product.salePrice ?? sku.product.price).plus(sku.priceDelta).toString(),
      quantity,
      addedAt: new Date().toISOString(),
      isAvailable: true,
      availableQuantity: available,
      stockMessage: null,
    });
  }

  await writeItems(identity, items);
  return withSubtotal(await hydrateItems(items));
}

export async function addCartProduct(
  identity: CartIdentity,
  productId: string,
  quantity: number,
): Promise<Cart> {
  const product = await prisma.product.findFirst({
    where: {
      OR: [{ id: BigInt(productId) }, { legacyId: Number(productId) }],
      status: 'active',
      deletedAt: null,
    },
    select: {
      skus: {
        where: { isActive: true },
        orderBy: { id: 'asc' },
        take: 1,
        select: { id: true },
      },
    },
  });

  const sku = product?.skus[0];
  if (!sku) {
    throw new NotFoundError('Product option not found.');
  }

  return addCartItem(identity, sku.id.toString(), quantity);
}

export async function updateCartItem(
  identity: CartIdentity,
  skuId: string,
  quantity: number,
): Promise<Cart> {
  const items = await readItems(identity);
  const existing = items.find((item) => item.skuId === skuId);
  if (!existing) {
    throw new NotFoundError('Cart item not found.');
  }

  if (quantity > 0) {
    const sku = await prisma.productSku.findUnique({
      where: { id: BigInt(skuId) },
      include: {
        product: { select: { status: true, deletedAt: true } },
      },
    });
    const available = sku ? sku.stock - sku.reserved : 0;
    if (!sku || !sku.isActive || sku.product.status !== 'active' || sku.product.deletedAt) {
      throw new ConflictError('Product option is not available.');
    }
    if (available < quantity) {
      throw new ConflictError(String(Math.max(0, available)));
    }
  }

  const nextItems =
    quantity === 0
      ? items.filter((item) => item.skuId !== skuId)
      : items.map((item) => (item.skuId === skuId ? { ...item, quantity } : item));

  await writeItems(identity, nextItems);
  return withSubtotal(await hydrateItems(nextItems));
}

export async function deleteCartItems(
  identity: CartIdentity,
  skuIds: string[],
): Promise<Cart> {
  const targets = new Set(skuIds);
  const nextItems = (await readItems(identity)).filter((item) => !targets.has(item.skuId));
  await writeItems(identity, nextItems);
  return withSubtotal(await hydrateItems(nextItems));
}

export async function mergeCart(
  source: CartIdentity,
  target: CartIdentity,
): Promise<Cart> {
  const [sourceItems, targetItems] = await Promise.all([readItems(source), readItems(target)]);
  const merged = [...targetItems];

  for (const sourceItem of sourceItems) {
    const existing = merged.find((item) => item.skuId === sourceItem.skuId);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + sourceItem.quantity, 99);
    } else {
      merged.push(sourceItem);
    }
  }

  const hydrated = await hydrateItems(merged);
  await writeItems(target, hydrated);
  try {
    await redis.del(cartKey(source));
  } catch (err) {
    logger.warn({ err }, 'guest cart Redis delete after merge failed');
  }

  return withSubtotal(hydrated);
}

export async function clearCart(identity: CartIdentity): Promise<Cart> {
  try {
    await redis.del(cartKey(identity));
  } catch (err) {
    logger.warn({ err }, 'cart Redis delete failed');
  }
  return { items: [], subtotal: '0' };
}
