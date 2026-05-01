'use server';

import type { Prisma } from '@prisma/client';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/server/db';
import { keys, redis } from '@/server/redis';
import { requireAdmin } from '@/server/admin/auth';
import { writeAdminAuditLog } from '@/server/admin/audit';
import { TAGS } from '@/lib/cache';
import { hashPassword } from '@/server/services/auth.service';
import {
  createPointLedgerBalanceEntry,
  createPointLedgerEntry,
} from '@/server/services/point-ledger.service';
import {
  parseMileageSpreadsheet,
  type MileageUploadRecord,
} from '@/server/services/mileage-spreadsheet.service';
import { transitionOrderStatus } from '@/server/services/order.service';
import { adminProductFormSchema } from '@/schemas/admin-product';
import {
  adminOrderStatusFormSchema,
  adminOrderStatusSchema,
  adminShipmentFormSchema,
} from '@/schemas/admin-order';
import {
  adminUserBulkPointFormSchema,
  adminUserBulkDeleteFormSchema,
  adminUserMessageFormSchema,
  adminUserPointFormSchema,
  adminUserStatusFormSchema,
} from '@/schemas/admin-user';
import { adminSettingsFormSchema } from '@/schemas/admin-settings';
import { adminCategoryFormSchema } from '@/schemas/admin-category';
import { adminCouponFormSchema } from '@/schemas/admin-coupon';
import { adminAccountFormSchema } from '@/schemas/admin-auth';
import {
  adminBoardFormSchema,
  adminPostDeleteSchema,
  adminPostFormSchema,
} from '@/schemas/admin-board';

function optionalString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

function selectedBigInts(formData: FormData, key: string): bigint[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === 'string' && value !== '')
    .map((value) => BigInt(value));
}

function optionalBigIntString(formData: FormData, key: string): string | undefined {
  const value = formString(formData, key);
  return value && value !== '0' ? value : undefined;
}

function safeAdminUsersRedirect(value: string | undefined): string {
  if (!value || !value.startsWith('/admin/users')) return '/admin/users';
  return value;
}

function redirectWithAdminUsersResult(
  redirectTo: string | undefined,
  params: Record<string, string | number>,
): never {
  const target = safeAdminUsersRedirect(redirectTo);
  const separator = target.includes('?') ? '&' : '?';
  const resultParams = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  );
  redirect(`${target}${separator}${resultParams.toString()}`);
}

function firstFormIssueMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? '요청 내용을 확인해주세요.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectProductImages(formData: FormData) {
  const urls = formData
    .getAll('imageUrls')
    .map((value) => (typeof value === 'string' ? value : ''));
  const keys = formData
    .getAll('imageKeys')
    .map((value) => (typeof value === 'string' ? value : ''));
  const alts = formData
    .getAll('imageAlts')
    .map((value) => (typeof value === 'string' ? value : ''));

  return urls.map((url, index) => ({
    url,
    key: keys[index] ?? '',
    alt: alts[index] ?? '',
  }));
}

function collectDescriptionImageKeys(formData: FormData): string[] {
  return [
    ...new Set(
      formData
        .getAll('descriptionImageKeys')
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  ];
}

function sanitizeProductDescriptionHtml(value: string | null): string | null {
  if (!value) return null;
  const sanitized = value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(
      /<\s*(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      '',
    )
    .replace(
      /<\s*\/?\s*(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option|svg|math)[^>]*>/gi,
      '',
    )
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src)\s*=\s*(["'])\s*(javascript|data):[\s\S]*?\2/gi, '');

  return sanitized.trim() ? sanitized : null;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

function parseCsvMoney(value: string | undefined): string {
  const normalized = (value ?? '').replace(/,/g, '').trim();
  if (!normalized) return '0';
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : '0';
}

function slugFromSku(sku: string): string {
  const slug = sku
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `product-${Date.now()}`;
}

function legacyCsvImage(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `/upload/goods/${trimmed}`;
}

function buildProductAttributes(
  currentAttributes: unknown,
  legacyAdmin: Prisma.InputJsonObject,
): Prisma.InputJsonObject {
  const base = isRecord(currentAttributes) ? currentAttributes : {};
  return {
    ...base,
    legacyAdmin,
  } as Prisma.InputJsonObject;
}

type ProductCategoryForRevalidation = {
  category: { id: bigint; parentId: bigint | null; slug: string };
};

function collectCategoryAncestorSlugs(
  categories: { id: bigint; parentId: bigint | null; slug: string }[],
  categoryIds: bigint[],
): Set<string> {
  const byId = new Map(categories.map((category) => [category.id.toString(), category]));
  const slugs = new Set<string>();

  for (const categoryId of categoryIds) {
    let current = byId.get(categoryId.toString());
    while (current) {
      slugs.add(current.slug);
      current = current.parentId ? byId.get(current.parentId.toString()) : undefined;
    }
  }

  return slugs;
}

function collectCategoryDescendantIds(
  categories: { id: bigint; parentId: bigint | null }[],
  categoryId: bigint,
): Set<string> {
  const childrenByParent = new Map<string, { id: bigint; parentId: bigint | null }[]>();
  for (const category of categories) {
    const parentKey = category.parentId?.toString();
    if (!parentKey) continue;
    const children = childrenByParent.get(parentKey) ?? [];
    children.push(category);
    childrenByParent.set(parentKey, children);
  }

  const descendants = new Set<string>();
  const stack = [...(childrenByParent.get(categoryId.toString()) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const key = current.id.toString();
    descendants.add(key);
    stack.push(...(childrenByParent.get(key) ?? []));
  }
  return descendants;
}

function buildDepthUpdates(
  categories: { id: bigint; parentId: bigint | null }[],
  rootId: bigint,
  rootDepth: number,
): { id: bigint; depth: number }[] {
  const childrenByParent = new Map<string, { id: bigint; parentId: bigint | null }[]>();
  for (const category of categories) {
    const parentKey = category.parentId?.toString();
    if (!parentKey) continue;
    const children = childrenByParent.get(parentKey) ?? [];
    children.push(category);
    childrenByParent.set(parentKey, children);
  }

  const updates: { id: bigint; depth: number }[] = [];
  const visit = (parentId: bigint, depth: number) => {
    for (const child of childrenByParent.get(parentId.toString()) ?? []) {
      updates.push({ id: child.id, depth });
      visit(child.id, depth + 1);
    }
  };

  visit(rootId, rootDepth + 1);
  return updates;
}

async function revalidateAllCategorySurfaces() {
  const categories = await prisma.category.findMany({ select: { slug: true } });
  revalidateTag(TAGS.categoryTree);
  for (const category of categories) {
    revalidateTag(TAGS.productList(category.slug));
    revalidateTag(TAGS.filterFacets(category.slug));
  }
  await redis.del(keys.categoryTree()).catch(() => undefined);
}

async function revalidateProduct(product: {
  slug: string;
  categories: ProductCategoryForRevalidation[];
}) {
  revalidateTag(TAGS.product(product.slug));
  revalidateTag(TAGS.bestProducts);
  revalidateTag(TAGS.newProducts);
  const categories = await prisma.category.findMany({
    select: { id: true, parentId: true, slug: true },
  });
  const slugs = collectCategoryAncestorSlugs(
    categories,
    product.categories.map((relation) => relation.category.id),
  );

  for (const slug of slugs) {
    revalidateTag(TAGS.productList(slug));
    revalidateTag(TAGS.filterFacets(slug));
  }
}

export async function saveAdminProduct(formData: FormData) {
  const admin = await requireAdmin('product.write');
  const parsed = adminProductFormSchema.parse({
    id: formString(formData, 'id'),
    sku: formString(formData, 'sku'),
    slug: formString(formData, 'slug'),
    name: formString(formData, 'name'),
    summary: formString(formData, 'summary'),
    description: formString(formData, 'description'),
    price: formString(formData, 'price'),
    salePrice: formString(formData, 'salePrice'),
    costPrice: formString(formData, 'costPrice'),
    status: formString(formData, 'status'),
    categoryIds: selectedBigInts(formData, 'categoryIds'),
    display: formString(formData, 'display'),
    isEmpty: formString(formData, 'isEmpty'),
    useStock: formString(formData, 'useStock'),
    stock: formString(formData, 'stock'),
    pointRate: formString(formData, 'pointRate'),
    expectedShipDays: formString(formData, 'expectedShipDays'),
    buyMin: formString(formData, 'buyMin'),
    buyUseMax: formString(formData, 'buyUseMax'),
    buyMax: formString(formData, 'buyMax'),
    priceReplacementText: formString(formData, 'priceReplacementText'),
    searchKeywords: formString(formData, 'searchKeywords'),
    importFlag: formString(formData, 'importFlag'),
    quantityDiscountVisible: formString(formData, 'quantityDiscountVisible'),
    mainImageIndex: formString(formData, 'mainImageIndex'),
    images: collectProductImages(formData),
  });
  const description = sanitizeProductDescriptionHtml(optionalString(parsed.description));
  const descriptionImageKeys = collectDescriptionImageKeys(formData);
  const mainImage = parsed.images[parsed.mainImageIndex] ?? parsed.images[0];
  const thumbnail = mainImage?.url ?? '';
  const effectiveStock = parsed.useStock === '1' ? 999999 : parsed.stock;
  const legacyAdmin: Prisma.InputJsonObject = {
    display: parsed.display,
    isEmpty: parsed.isEmpty,
    priceStat: '1',
    pointRate: parsed.pointRate,
    expectedShipDays: parsed.expectedShipDays,
    buyMin: parsed.buyMin,
    buyUseMax: parsed.buyUseMax,
    buyMax: parsed.buyUseMax === '0' ? (parsed.buyMax ?? null) : null,
    priceReplacementText: optionalString(parsed.priceReplacementText) ?? '',
    searchKeywords: optionalString(parsed.searchKeywords) ?? '',
    importFlag: parsed.importFlag,
    quantityDiscountVisible: parsed.quantityDiscountVisible,
    useStock: parsed.useStock,
    stock: parsed.stock,
  };

  const product = await prisma.$transaction(async (tx) => {
    const current = parsed.id
      ? await tx.product.findUnique({
          where: { id: parsed.id },
          select: { attributes: true },
        })
      : null;
    const attributes = buildProductAttributes(current?.attributes, legacyAdmin);
    const saved = parsed.id
      ? await tx.product.update({
          where: { id: parsed.id },
          data: {
            sku: parsed.sku,
            slug: parsed.slug,
            name: parsed.name,
            summary: optionalString(parsed.summary),
            description,
            price: parsed.price,
            salePrice: optionalString(parsed.salePrice),
            costPrice: optionalString(parsed.costPrice),
            status: parsed.status,
            thumbnail,
            attributes,
          },
          select: { id: true, slug: true },
        })
      : await tx.product.create({
          data: {
            sku: parsed.sku,
            slug: parsed.slug,
            name: parsed.name,
            summary: optionalString(parsed.summary),
            description,
            price: parsed.price,
            salePrice: optionalString(parsed.salePrice),
            costPrice: optionalString(parsed.costPrice),
            status: parsed.status,
            thumbnail,
            attributes,
            skus: {
              create: {
                code: `${parsed.sku}-DEFAULT`,
                optionValues: {},
                stock: effectiveStock,
                isActive: true,
              },
            },
          },
          select: { id: true, slug: true },
        });

    if (parsed.id) {
      await tx.productSku.updateMany({
        where: { productId: saved.id },
        data: { stock: effectiveStock },
      });
    }

    await tx.productImage.deleteMany({ where: { productId: saved.id } });
    await tx.productImage.createMany({
      data: parsed.images.map((image, index) => ({
        productId: saved.id,
        url: image.url,
        alt: optionalString(image.alt),
        sortOrder: index + 1,
        isMain: index === parsed.mainImageIndex,
      })),
    });
    const uploadedKeys = [
      ...new Set([
        ...parsed.images
          .map((image) => image.key?.trim())
          .filter((key): key is string => Boolean(key)),
        ...descriptionImageKeys,
      ]),
    ];
    for (const key of uploadedKeys) {
      await tx.fileObject.upsert({
        where: { key },
        update: {
          ownerType: 'Product',
          ownerId: saved.id,
        },
        create: {
          key,
          bucket: process.env.R2_BUCKET ?? '',
          ownerType: 'Product',
          ownerId: saved.id,
        },
      });
    }

    await tx.categoryOnProduct.deleteMany({ where: { productId: saved.id } });
    if (parsed.categoryIds.length > 0) {
      await tx.categoryOnProduct.createMany({
        data: parsed.categoryIds.map((categoryId, index) => ({
          productId: saved.id,
          categoryId,
          sortOrder: index + 1,
        })),
        skipDuplicates: true,
      });
    }

    return tx.product.findUniqueOrThrow({
      where: { id: saved.id },
      select: {
        id: true,
        slug: true,
        categories: {
          select: { category: { select: { id: true, parentId: true, slug: true } } },
        },
      },
    });
  });

  await writeAdminAuditLog({
    admin,
    action: parsed.id ? 'product.update' : 'product.create',
    entity: 'Product',
    entityId: product.id.toString(),
    payload: { slug: product.slug, status: parsed.status },
  });
  await revalidateProduct(product);
  redirect(`/admin/products/${product.id.toString()}`);
}

export async function importAdminProductsCsv(formData: FormData) {
  const admin = await requireAdmin('product.write');
  const file = formData.get('csvFile');
  if (!(file instanceof File) || file.size === 0) {
    throw new Error('CSV 파일을 선택해주세요.');
  }
  if (!file.name.toLowerCase().endsWith('.csv')) {
    throw new Error('CSV 파일만 업로드할 수 있습니다.');
  }

  const rows = parseCsv(await file.text()).slice(1);
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const sku = (row[3] || row[0] || '').trim();
    const name = (row[4] || '').trim();
    if (!sku || !name) {
      skipped += 1;
      continue;
    }

    const categoryCode = row[36]?.trim();
    const categoryWhere =
      categoryCode && /^\d+$/.test(categoryCode)
        ? { OR: [{ code: categoryCode }, { id: BigInt(categoryCode) }] }
        : categoryCode
          ? { code: categoryCode }
          : undefined;
    const category = categoryWhere
      ? await prisma.category.findFirst({ where: categoryWhere, select: { id: true, slug: true } })
      : null;
    const productImages = [row[24], row[25], row[26], row[27], row[28], row[29], row[30], row[31]]
      .map(legacyCsvImage)
      .filter(Boolean);
    const detailImages = [row[37], row[38], row[39], row[40]].map(legacyCsvImage).filter(Boolean);
    const images = [...productImages, ...detailImages];
    const stock = Number.parseInt(row[14] ?? '0', 10);
    const useStock = row[13]?.trim() === '1' ? '2' : '1';
    const isSoldOut = row[13]?.trim() === '2';
    const effectiveStock = useStock === '1' ? 999999 : Math.max(0, Number.isFinite(stock) ? stock : 0);
    const status = isSoldOut ? 'sold_out' : row[1]?.trim() === '0' ? 'hidden' : 'active';
    const attributes: Prisma.InputJsonObject = {
      model: row[46]?.trim() ?? '',
      company: row[10]?.trim() ?? '',
      origin: row[12]?.trim() ?? '',
      margin: row[41]?.trim() ?? '',
      meta: row[43]?.trim() ?? '',
      storageLocation: row[44]?.trim() ?? '',
      quality: row[45]?.trim() ?? '',
      legacyAdmin: {
        display: row[1]?.trim() === '0' ? '0' : '1',
        isEmpty: isSoldOut ? '1' : '0',
        priceStat: '1',
        pointRate: Number.parseFloat(row[8] ?? '0') || 0,
        expectedShipDays: 0,
        buyMin: 1,
        buyUseMax: '1',
        buyMax: null,
        priceReplacementText: '',
        searchKeywords: row[43]?.trim() ?? '',
        importFlag: 'N',
        quantityDiscountVisible: 'N',
        useStock,
        stock: effectiveStock,
      },
    };

    const existing = await prisma.product.findUnique({
      where: { sku },
      select: { id: true, slug: true },
    });
    const product = await prisma.$transaction(async (tx) => {
      const saved = await tx.product.upsert({
        where: { sku },
        update: {
          name,
          description: optionalString(row[32]),
          price: parseCsvMoney(row[5]),
          costPrice: parseCsvMoney(row[42]),
          status,
          thumbnail: images[0] ?? '',
          attributes,
        },
        create: {
          sku,
          slug: slugFromSku(sku),
          name,
          description: optionalString(row[32]),
          price: parseCsvMoney(row[5]),
          costPrice: parseCsvMoney(row[42]),
          status,
          thumbnail: images[0] ?? '',
          attributes,
          skus: {
            create: {
              code: `${sku}-DEFAULT`,
              optionValues: {},
              stock: effectiveStock,
              isActive: true,
            },
          },
        },
        select: { id: true, slug: true },
      });

      await tx.productSku.updateMany({
        where: { productId: saved.id },
        data: { stock: effectiveStock, isActive: true },
      });
      await tx.productImage.deleteMany({ where: { productId: saved.id } });
      if (images.length > 0) {
        await tx.productImage.createMany({
          data: images.map((url, index) => ({
            productId: saved.id,
            url,
            alt: name,
            sortOrder: index + 1,
            isMain: index === 0,
          })),
        });
      }
      if (category) {
        await tx.categoryOnProduct.upsert({
          where: { categoryId_productId: { categoryId: category.id, productId: saved.id } },
          update: { sortOrder: 1 },
          create: { categoryId: category.id, productId: saved.id, sortOrder: 1 },
        });
      }
      return saved;
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
    revalidateTag(TAGS.product(product.slug));
    if (category) revalidateTag(TAGS.productList(category.slug));
  }

  await writeAdminAuditLog({
    admin,
    action: 'product.csv.import',
    entity: 'Product',
    payload: { fileName: file.name, created, updated, skipped },
  });
  revalidatePath('/admin/products');
  redirect(`/admin/products?imported=${created + updated}&skipped=${skipped}`);
}

export async function updateAdminOrderStatus(formData: FormData) {
  const admin = await requireAdmin('order.write');
  const parsed = adminOrderStatusFormSchema.parse({
    orderNo: formString(formData, 'orderNo'),
    status: formString(formData, 'status'),
    reason: formString(formData, 'reason'),
  });

  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUniqueOrThrow({
      where: { orderNo: parsed.orderNo },
      select: { id: true, orderNo: true, status: true, userId: true, pointsUsed: true },
    });

    await transitionOrderStatus(tx, {
      order: {
        id: current.id,
        orderNo: current.orderNo,
        userId: current.userId,
        pointsUsed: current.pointsUsed,
        status: current.status,
      },
      nextStatus: parsed.status,
      actor: `admin:${admin.id.toString()}`,
      reason: optionalString(parsed.reason),
    });

    return tx.order.findUniqueOrThrow({
      where: { id: current.id },
      select: { id: true, orderNo: true, status: true },
    });
  });

  await writeAdminAuditLog({
    admin,
    action: 'order.status.update',
    entity: 'Order',
    entityId: order.orderNo,
    payload: { status: order.status, reason: parsed.reason },
  });
  redirect(`/admin/orders/${order.orderNo}`);
}

export async function bulkUpdateAdminOrders(formData: FormData) {
  const admin = await requireAdmin('order.write');
  const intent = formString(formData, 'intent');
  const orderNos = formData
    .getAll('orderNo')
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .map((value) => value.trim());
  if (orderNos.length === 0) {
    throw new Error('변경할 주문을 선택해주세요.');
  }

  if (intent === 'delete') {
    await prisma.order.updateMany({
      where: { orderNo: { in: orderNos }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await writeAdminAuditLog({
      admin,
      action: 'order.bulk.delete',
      entity: 'Order',
      payload: { orderNos },
    });
    revalidatePath('/admin/orders');
    redirect('/admin/orders');
  }

  const nextStatus = adminOrderStatusSchema.parse(formString(formData, 'bulkStatus'));
  await prisma.$transaction(async (tx) => {
    const orders = await tx.order.findMany({
      where: { orderNo: { in: orderNos }, deletedAt: null },
      select: { id: true, orderNo: true, status: true, userId: true, pointsUsed: true },
    });
    for (const order of orders) {
      await transitionOrderStatus(tx, {
        order,
        nextStatus,
        reason: '관리자 목록 일괄 변경',
        actor: `admin:${admin.id.toString()}`,
      });
    }
  });

  await writeAdminAuditLog({
    admin,
    action: 'order.bulk.status.update',
    entity: 'Order',
    payload: { orderNos, status: nextStatus },
  });
  revalidatePath('/admin/orders');
  redirect('/admin/orders');
}

export async function saveAdminShipment(formData: FormData) {
  const admin = await requireAdmin('order.write');
  const parsed = adminShipmentFormSchema.parse({
    orderNo: formString(formData, 'orderNo'),
    carrier: formString(formData, 'carrier'),
    trackingNo: formString(formData, 'trackingNo'),
    status: formString(formData, 'status'),
  });

  const order = await prisma.order.findUniqueOrThrow({
    where: { orderNo: parsed.orderNo },
    select: { id: true, orderNo: true },
  });

  await prisma.shipment.upsert({
    where: { id: BigInt(formString(formData, 'shipmentId') || 0) },
    update: {
      carrier: optionalString(parsed.carrier),
      trackingNo: optionalString(parsed.trackingNo),
      status: parsed.status,
      shippedAt: parsed.status === 'shipping' ? new Date() : undefined,
      deliveredAt: parsed.status === 'delivered' ? new Date() : undefined,
    },
    create: {
      orderId: order.id,
      carrier: optionalString(parsed.carrier),
      trackingNo: optionalString(parsed.trackingNo),
      status: parsed.status,
      shippedAt: parsed.status === 'shipping' ? new Date() : undefined,
      deliveredAt: parsed.status === 'delivered' ? new Date() : undefined,
    },
  });

  await writeAdminAuditLog({
    admin,
    action: 'shipment.upsert',
    entity: 'Order',
    entityId: order.orderNo,
    payload: { carrier: parsed.carrier, trackingNo: parsed.trackingNo, status: parsed.status },
  });
  redirect(`/admin/orders/${order.orderNo}`);
}

export async function updateAdminUserStatus(formData: FormData) {
  const admin = await requireAdmin('user.write');
  const parsed = adminUserStatusFormSchema.parse({
    userId: formString(formData, 'userId'),
    status: formString(formData, 'status'),
  });

  const user = await prisma.user.update({
    where: { id: parsed.userId },
    data: { status: parsed.status },
    select: { id: true, status: true },
  });

  await writeAdminAuditLog({
    admin,
    action: 'user.status.update',
    entity: 'User',
    entityId: user.id.toString(),
    payload: { status: user.status },
  });
  redirect(`/admin/users/${user.id.toString()}`);
}

async function deleteAdminUsers(
  admin: Awaited<ReturnType<typeof requireAdmin>>,
  userIds: bigint[],
): Promise<number> {
  const deletedAt = new Date();

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, deletedAt: null },
    select: { id: true },
  });
  const activeUserIds = users.map((user) => user.id);

  if (activeUserIds.length === 0) {
    return 0;
  }

  await prisma.$transaction(async (tx) => {
    await tx.userAddress.deleteMany({ where: { userId: { in: activeUserIds } } });
    await tx.userSocialAccount.deleteMany({ where: { userId: { in: activeUserIds } } });
    await tx.userBusinessProfile.deleteMany({ where: { userId: { in: activeUserIds } } });
    await tx.userRefundAccount.deleteMany({ where: { userId: { in: activeUserIds } } });
    await tx.wishlist.deleteMany({ where: { userId: { in: activeUserIds } } });
    await tx.couponIssue.deleteMany({ where: { userId: { in: activeUserIds } } });

    await tx.userLoginLog.updateMany({
      where: { userId: { in: activeUserIds } },
      data: { email: null, ip: '0.0.0.0', userAgent: null, reason: '관리자 회원 삭제로 익명화' },
    });
    await tx.productQna.updateMany({
      where: { userId: { in: activeUserIds } },
      data: { userId: null },
    });
    await tx.post.updateMany({
      where: { userId: { in: activeUserIds } },
      data: { userId: null, authorName: '탈퇴 회원', authorEmail: null },
    });
    await tx.comment.updateMany({
      where: { userId: { in: activeUserIds } },
      data: { userId: null, authorName: '탈퇴 회원' },
    });
    await tx.inquiry.updateMany({
      where: { userId: { in: activeUserIds } },
      data: { userId: null, name: '탈퇴 회원', email: 'deleted@deleted.local', phone: null },
    });

    for (const userId of activeUserIds) {
      await tx.user.update({
        where: { id: userId },
        data: {
          loginId: null,
          email: `deleted-${userId.toString()}-${deletedAt.getTime()}@deleted.local`,
          phone: null,
          name: '탈퇴 회원',
          nickname: null,
          birth: null,
          gender: null,
          passwordHash: null,
          legacyPasswordHash: null,
          legacyPasswordAlgo: null,
          status: 'withdrawn',
          marketingAgreedAt: null,
          smsAgreedAt: null,
          lastLoginIp: null,
          deletedAt,
        },
      });
    }
  });

  await writeAdminAuditLog({
    admin,
    action: 'user.bulk.delete',
    entity: 'User',
    payload: {
      userIds: activeUserIds.map((userId) => userId.toString()),
      deletedAt: deletedAt.toISOString(),
      strategy: 'soft-delete-anonymize',
    },
  });

  return activeUserIds.length;
}

export async function bulkDeleteAdminUsers(formData: FormData) {
  const admin = await requireAdmin('user.write');
  const parsed = adminUserBulkDeleteFormSchema.safeParse({
    userIds: selectedBigInts(formData, 'userId'),
  });
  if (!parsed.success) {
    redirectWithAdminUsersResult(undefined, { bulkError: firstFormIssueMessage(parsed.error) });
  }

  await deleteAdminUsers(admin, parsed.data.userIds);
  revalidatePath('/admin/users');
  redirect('/admin/users');
}

export async function bulkUpdateAdminUsers(formData: FormData) {
  const admin = await requireAdmin('user.write');
  const intent = formString(formData, 'intent');
  const redirectTo = formString(formData, 'redirectTo');

  if (intent === 'delete') {
    const parsed = adminUserBulkDeleteFormSchema.safeParse({
      userIds: selectedBigInts(formData, 'userId'),
    });
    if (!parsed.success) {
      redirectWithAdminUsersResult(redirectTo, { bulkError: firstFormIssueMessage(parsed.error) });
    }
    const deleted = await deleteAdminUsers(admin, parsed.data.userIds);
    revalidatePath('/admin/users');
    redirectWithAdminUsersResult(redirectTo, { deleted });
  }

  const parsed = adminUserBulkPointFormSchema.safeParse({
    intent,
    userIds: selectedBigInts(formData, 'userId'),
    delta: formString(formData, 'bulkMileageAmount'),
    reason: formString(formData, 'bulkMileageReason'),
  });
  if (!parsed.success) {
    redirectWithAdminUsersResult(redirectTo, { bulkError: firstFormIssueMessage(parsed.error) });
  }
  const pointForm = parsed.data;
  const reason =
    optionalString(pointForm.reason) ??
    (pointForm.intent === 'mileage-reset'
      ? '관리자 마일리지 일괄 초기화'
      : '관리자 마일리지 일괄 부여');

  await prisma.$transaction(async (tx) => {
    for (const userId of pointForm.userIds) {
      if (pointForm.intent === 'mileage-reset') {
        await createPointLedgerBalanceEntry(tx, {
          userId,
          targetBalance: 0,
          reason,
        });
      } else {
        await createPointLedgerEntry(tx, {
          userId,
          delta: pointForm.delta ?? 0,
          reason,
        });
      }
    }
  });

  await writeAdminAuditLog({
    admin,
    action:
      pointForm.intent === 'mileage-reset' ? 'user.points.bulk.reset' : 'user.points.bulk.grant',
    entity: 'User',
    payload: {
      userIds: pointForm.userIds.map((userId) => userId.toString()),
      delta: pointForm.intent === 'mileage-grant' ? pointForm.delta : undefined,
      reason,
    },
  });
  revalidatePath('/admin/users');
  redirectWithAdminUsersResult(redirectTo, {
    mileageUpdated: pointForm.userIds.length,
    mileageSkipped: 0,
  });
}

function uniqueStrings(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function uniqueBigInts(values: (bigint | undefined)[]): bigint[] {
  const unique = new Map<string, bigint>();
  values.forEach((value) => {
    if (value) unique.set(value.toString(), value);
  });
  return [...unique.values()];
}

function userLookupKey(record: MileageUploadRecord): string {
  return [record.userId?.toString() ?? '', record.loginId ?? '', record.email ?? ''].join('|');
}

export async function importAdminUserMileageExcel(formData: FormData) {
  const admin = await requireAdmin('user.write');
  const file = formData.get('mileageFile');
  const redirectTo = formString(formData, 'redirectTo');

  if (!(file instanceof File) || file.size === 0) {
    throw new Error('업로드할 엑셀 파일을 선택해주세요.');
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('마일리지 업로드 파일은 2MB 이하로 올려주세요.');
  }

  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls') && !lowerName.endsWith('.csv')) {
    throw new Error('엑셀(.xlsx, .xls) 또는 CSV 파일만 업로드할 수 있습니다.');
  }

  const parsed = parseMileageSpreadsheet(file.name, await file.arrayBuffer());
  if (parsed.records.length === 0) {
    throw new Error(parsed.errors[0] ?? '반영할 마일리지 데이터가 없습니다.');
  }

  const lookupOr: Prisma.UserWhereInput[] = [];
  const userIds = uniqueBigInts(parsed.records.map((record) => record.userId));
  const loginIds = uniqueStrings(parsed.records.map((record) => record.loginId));
  const emails = uniqueStrings(parsed.records.map((record) => record.email?.toLowerCase()));

  if (userIds.length > 0) lookupOr.push({ id: { in: userIds } });
  if (loginIds.length > 0) lookupOr.push({ loginId: { in: loginIds } });
  if (emails.length > 0) lookupOr.push({ email: { in: emails } });

  const users = await prisma.user.findMany({
    where: { deletedAt: null, OR: lookupOr },
    select: { id: true, loginId: true, email: true },
  });
  const byId = new Map(users.map((user) => [user.id.toString(), user]));
  const byLoginId = new Map(
    users
      .filter((user): user is typeof user & { loginId: string } => user.loginId !== null)
      .map((user) => [user.loginId, user]),
  );
  const byEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const appliedRows = new Set<string>();

  let skipped = parsed.skipped;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const record of parsed.records) {
      const lookupKey = userLookupKey(record);
      if (appliedRows.has(lookupKey)) {
        skipped += 1;
        continue;
      }
      appliedRows.add(lookupKey);

      const user =
        (record.userId ? byId.get(record.userId.toString()) : undefined) ??
        (record.loginId ? byLoginId.get(record.loginId) : undefined) ??
        (record.email ? byEmail.get(record.email.toLowerCase()) : undefined);

      if (!user) {
        skipped += 1;
        continue;
      }

      if (record.mode === 'grant') {
        await createPointLedgerEntry(tx, {
          userId: user.id,
          delta: record.amount ?? 0,
          reason: record.reason,
        });
      } else {
        await createPointLedgerBalanceEntry(tx, {
          userId: user.id,
          targetBalance: record.mode === 'reset' ? 0 : (record.amount ?? 0),
          reason: record.reason,
        });
      }
      updated += 1;
    }
  });

  await writeAdminAuditLog({
    admin,
    action: 'user.points.excel.import',
    entity: 'User',
    payload: {
      fileName: file.name,
      updated,
      skipped,
      parseErrors: parsed.errors.slice(0, 20),
    },
  });
  revalidatePath('/admin/users');
  redirectWithAdminUsersResult(redirectTo, {
    mileageImported: updated,
    mileageSkipped: skipped,
  });
}

export async function adjustAdminUserPoints(formData: FormData) {
  const admin = await requireAdmin('user.write');
  const parsed = adminUserPointFormSchema.parse({
    userId: formString(formData, 'userId'),
    delta: formString(formData, 'delta'),
    reason: formString(formData, 'reason'),
  });

  await prisma.$transaction(async (tx) => {
    await createPointLedgerEntry(tx, {
      userId: parsed.userId,
      delta: parsed.delta,
      reason: parsed.reason,
    });
  });

  await writeAdminAuditLog({
    admin,
    action: 'user.points.adjust',
    entity: 'User',
    entityId: parsed.userId.toString(),
    payload: { delta: parsed.delta, reason: parsed.reason },
  });
  redirect(`/admin/users/${parsed.userId.toString()}`);
}

export async function recordAdminUserMessage(formData: FormData) {
  const admin = await requireAdmin('user.write');
  const parsed = adminUserMessageFormSchema.parse({
    userId: formString(formData, 'userId'),
    channel: formString(formData, 'channel'),
    subject: formString(formData, 'subject'),
    content: formString(formData, 'content'),
  });
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: parsed.userId },
    select: { id: true, email: true, phone: true, name: true },
  });

  await writeAdminAuditLog({
    admin,
    action: parsed.channel === 'email' ? 'user.email.request' : 'user.sms.request',
    entity: 'User',
    entityId: user.id.toString(),
    payload: {
      channel: parsed.channel,
      target: parsed.channel === 'email' ? user.email : user.phone,
      subject: optionalString(parsed.subject),
      content: parsed.content,
    },
  });
  redirect(`/admin/users/${user.id.toString()}`);
}

export async function saveAdminSettings(formData: FormData) {
  const admin = await requireAdmin('settings.write');
  const parsed = adminSettingsFormSchema.parse({
    companyName: formString(formData, 'companyName'),
    companyCeo: formString(formData, 'companyCeo'),
    companyAddress: formString(formData, 'companyAddress'),
    businessNumber: formString(formData, 'businessNumber'),
    mailOrderNumber: formString(formData, 'mailOrderNumber'),
    companyTel: formString(formData, 'companyTel'),
    companyFax: formString(formData, 'companyFax'),
    companyEmail: formString(formData, 'companyEmail'),
    privacyOfficer: formString(formData, 'privacyOfficer'),
    customerCenterTel: formString(formData, 'customerCenterTel'),
    weekdayHours: formString(formData, 'weekdayHours'),
    saturdayHours: formString(formData, 'saturdayHours'),
    lunchHours: formString(formData, 'lunchHours'),
    bankName: formString(formData, 'bankName'),
    bankLogoText: formString(formData, 'bankLogoText'),
    bankAccount: formString(formData, 'bankAccount'),
    terms: formString(formData, 'terms'),
    privacy: formString(formData, 'privacy'),
    collectionConsent: formString(formData, 'collectionConsent'),
    companyInfo: formString(formData, 'companyInfo'),
    htmlEnabled: formData.get('htmlEnabled') === 'on',
  });

  await prisma.sitePolicy.upsert({
    where: { key: 'default' },
    update: parsed,
    create: { key: 'default', ...parsed },
  });

  await writeAdminAuditLog({
    admin,
    action: 'settings.update',
    entity: 'SitePolicy',
    entityId: 'default',
    payload: { companyName: parsed.companyName, htmlEnabled: parsed.htmlEnabled },
  });
  revalidateTag('site-policy');
  redirect('/admin/settings');
}

export async function saveAdminAccount(formData: FormData) {
  const admin = await requireAdmin('admin.manage');
  const parsed = adminAccountFormSchema.parse({
    id: optionalBigIntString(formData, 'id'),
    loginId: formString(formData, 'loginId'),
    email: formString(formData, 'email'),
    name: formString(formData, 'name'),
    password: formString(formData, 'password'),
    role: formString(formData, 'role'),
    permissions: formData.getAll('permissions'),
    status: formString(formData, 'status'),
  });
  const permissions = parsed.role === 'super_admin' ? [] : parsed.permissions;
  const passwordHash = parsed.password ? await hashPassword(parsed.password) : undefined;
  const account = parsed.id
    ? await prisma.adminUser.update({
        where: { id: parsed.id },
        data: {
          loginId: parsed.loginId,
          email: parsed.email,
          name: parsed.name,
          role: parsed.role,
          permissions: permissions as Prisma.InputJsonArray,
          status: parsed.status,
          ...(passwordHash ? { passwordHash, sessionVersion: { increment: 1 } } : {}),
        },
        select: { id: true, loginId: true, role: true, status: true },
      })
    : await prisma.adminUser.create({
        data: {
          loginId: parsed.loginId,
          email: parsed.email,
          name: parsed.name,
          role: parsed.role,
          permissions: permissions as Prisma.InputJsonArray,
          status: parsed.status,
          passwordHash: passwordHash ?? '',
        },
        select: { id: true, loginId: true, role: true, status: true },
      });

  await writeAdminAuditLog({
    admin,
    action: parsed.id ? 'admin-user.update' : 'admin-user.create',
    entity: 'AdminUser',
    entityId: account.id.toString(),
    payload: { loginId: account.loginId, role: account.role, status: account.status },
  });
  revalidatePath('/admin/settings');
  redirect('/admin/settings');
}

export async function saveAdminCategory(formData: FormData) {
  const admin = await requireAdmin('content.write');
  const parsed = adminCategoryFormSchema.parse({
    id: optionalBigIntString(formData, 'id'),
    parentId: optionalBigIntString(formData, 'parentId'),
    code: formString(formData, 'code'),
    name: formString(formData, 'name'),
    slug: formString(formData, 'slug'),
    sortOrder: formString(formData, 'sortOrder'),
    isActive: formData.get('isActive') === 'on',
  });

  const category = await prisma.$transaction(async (tx) => {
    const parent = parsed.parentId
      ? await tx.category.findUnique({
          where: { id: parsed.parentId },
          select: { id: true, depth: true },
        })
      : null;

    if (parsed.parentId && !parent) {
      throw new Error('상위 카테고리를 찾을 수 없습니다.');
    }

    if (parsed.id && parsed.parentId === parsed.id) {
      throw new Error('자기 자신을 상위 카테고리로 지정할 수 없습니다.');
    }

    if (parsed.id && parsed.parentId) {
      const categories = await tx.category.findMany({
        select: { id: true, parentId: true },
      });
      const descendants = collectCategoryDescendantIds(categories, parsed.id);
      if (descendants.has(parsed.parentId.toString())) {
        throw new Error('하위 카테고리를 상위 카테고리로 지정할 수 없습니다.');
      }
    }

    const depth = parent ? parent.depth + 1 : 0;
    if (depth > 5) {
      throw new Error('카테고리는 최대 6단계까지만 만들 수 있습니다.');
    }

    const saved = parsed.id
      ? await tx.category.update({
          where: { id: parsed.id },
          data: {
            parentId: parsed.parentId ?? null,
            code: parsed.code,
            name: parsed.name,
            slug: parsed.slug,
            depth,
            sortOrder: parsed.sortOrder,
            isActive: parsed.isActive,
          },
          select: { id: true, slug: true },
        })
      : await tx.category.create({
          data: {
            parentId: parsed.parentId ?? null,
            code: parsed.code,
            name: parsed.name,
            slug: parsed.slug,
            depth,
            sortOrder: parsed.sortOrder,
            isActive: parsed.isActive,
          },
          select: { id: true, slug: true },
        });

    if (parsed.id) {
      const categories = await tx.category.findMany({
        select: { id: true, parentId: true },
      });
      const updates = buildDepthUpdates(categories, saved.id, depth);
      if (updates.some((update) => update.depth > 5)) {
        throw new Error('하위 카테고리를 포함해 최대 6단계를 초과할 수 없습니다.');
      }
      for (const update of updates) {
        await tx.category.update({
          where: { id: update.id },
          data: { depth: update.depth },
        });
      }
    }

    return saved;
  });

  await writeAdminAuditLog({
    admin,
    action: parsed.id ? 'category.update' : 'category.create',
    entity: 'Category',
    entityId: category.id.toString(),
    payload: { slug: category.slug, isActive: parsed.isActive },
  });
  await revalidateAllCategorySurfaces();
  revalidatePath('/admin/categories');
  redirect('/admin/categories');
}

export async function saveAdminCoupon(formData: FormData) {
  const admin = await requireAdmin('coupon.write');
  const parsed = adminCouponFormSchema.parse({
    id: optionalBigIntString(formData, 'id'),
    code: formString(formData, 'code'),
    name: formString(formData, 'name'),
    discountType: formString(formData, 'discountType'),
    discountValue: formString(formData, 'discountValue'),
    minOrderAmount: formString(formData, 'minOrderAmount'),
    maxDiscount: formString(formData, 'maxDiscount'),
    startAt: formString(formData, 'startAt'),
    endAt: formString(formData, 'endAt'),
    totalQuota: formString(formData, 'totalQuota'),
    isActive: formData.get('isActive') === 'on',
  });

  const data = {
    code: parsed.code,
    name: parsed.name,
    discountType: parsed.discountType,
    discountValue: parsed.discountValue,
    minOrderAmount: optionalString(parsed.minOrderAmount),
    maxDiscount: optionalString(parsed.maxDiscount),
    startAt: parsed.startAt,
    endAt: parsed.endAt,
    totalQuota: parsed.totalQuota ?? null,
    isActive: parsed.isActive,
  };

  const coupon = parsed.id
    ? await prisma.coupon.update({ where: { id: parsed.id }, data, select: { id: true, code: true } })
    : await prisma.coupon.create({ data, select: { id: true, code: true } });

  await writeAdminAuditLog({
    admin,
    action: parsed.id ? 'coupon.update' : 'coupon.create',
    entity: 'Coupon',
    entityId: coupon.id.toString(),
    payload: { code: coupon.code, isActive: parsed.isActive },
  });
  revalidatePath('/admin/coupons');
  redirect('/admin/coupons');
}

export async function saveAdminBoard(formData: FormData) {
  const admin = await requireAdmin('content.write');
  const parsed = adminBoardFormSchema.parse({
    id: optionalBigIntString(formData, 'id'),
    code: formString(formData, 'code'),
    name: formString(formData, 'name'),
    type: formString(formData, 'type'),
    isActive: formData.has('isActive'),
  });
  const data = {
    code: parsed.code,
    name: parsed.name,
    type: parsed.type,
    isActive: parsed.isActive,
  };
  const board = parsed.id
    ? await prisma.board.update({ where: { id: parsed.id }, data, select: { id: true, code: true } })
    : await prisma.board.create({ data, select: { id: true, code: true } });

  await writeAdminAuditLog({
    admin,
    action: parsed.id ? 'board.update' : 'board.create',
    entity: 'Board',
    entityId: board.id.toString(),
    payload: { code: board.code, isActive: parsed.isActive },
  });
  revalidatePath('/admin/boards');
  redirect('/admin/boards');
}

export async function saveAdminPost(formData: FormData) {
  const admin = await requireAdmin('content.write');
  const parsed = adminPostFormSchema.parse({
    id: optionalBigIntString(formData, 'id'),
    boardId: formString(formData, 'boardId'),
    title: formString(formData, 'title'),
    content: formString(formData, 'content'),
    isNotice: formData.has('isNotice'),
    isSecret: formData.has('isSecret'),
  });
  const data = {
    boardId: parsed.boardId,
    title: parsed.title,
    content: parsed.content,
    isNotice: parsed.isNotice,
    isSecret: parsed.isSecret,
  };
  const post = parsed.id
    ? await prisma.post.update({ where: { id: parsed.id }, data, select: { id: true, boardId: true } })
    : await prisma.post.create({ data, select: { id: true, boardId: true } });

  await writeAdminAuditLog({
    admin,
    action: parsed.id ? 'post.update' : 'post.create',
    entity: 'Post',
    entityId: post.id.toString(),
    payload: { boardId: post.boardId.toString(), isNotice: parsed.isNotice },
  });
  revalidatePath('/admin/boards');
  redirect('/admin/boards');
}

export async function deleteAdminPost(formData: FormData) {
  const admin = await requireAdmin('content.write');
  const parsed = adminPostDeleteSchema.parse({
    postId: formString(formData, 'postId'),
  });
  const post = await prisma.post.update({
    where: { id: parsed.postId },
    data: { deletedAt: new Date() },
    select: { id: true, boardId: true },
  });

  await writeAdminAuditLog({
    admin,
    action: 'post.delete',
    entity: 'Post',
    entityId: post.id.toString(),
    payload: { boardId: post.boardId.toString() },
  });
  revalidatePath('/admin/boards');
  redirect('/admin/boards');
}

export async function answerProductQna(formData: FormData) {
  const admin = await requireAdmin('content.write');
  const qnaId = BigInt(formString(formData, 'qnaId') || '0');
  const answer = formString(formData, 'answer')?.trim();
  if (!answer) throw new Error('답변을 입력해주세요.');

  const qna = await prisma.productQna.update({
    where: { id: qnaId },
    data: { answer, answeredAt: new Date() },
    select: { id: true, productId: true },
  });

  await writeAdminAuditLog({
    admin,
    action: 'product-qna.answer',
    entity: 'ProductQna',
    entityId: qna.id.toString(),
    payload: { productId: qna.productId.toString() },
  });
  revalidatePath('/admin/boards');
  redirect('/admin/boards');
}

export async function answerInquiry(formData: FormData) {
  const admin = await requireAdmin('content.write');
  const inquiryId = BigInt(formString(formData, 'inquiryId') || '0');
  const answer = formString(formData, 'answer')?.trim();
  if (!answer) throw new Error('답변을 입력해주세요.');

  const inquiry = await prisma.inquiry.update({
    where: { id: inquiryId },
    data: { answer, status: 'answered', answeredAt: new Date() },
    select: { id: true, email: true },
  });

  await writeAdminAuditLog({
    admin,
    action: 'inquiry.answer',
    entity: 'Inquiry',
    entityId: inquiry.id.toString(),
    payload: { email: inquiry.email },
  });
  revalidatePath('/admin/boards');
  redirect('/admin/boards');
}
