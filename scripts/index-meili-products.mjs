import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MEILI_HOST = process.env.MEILI_HOST?.replace(/\/$/, '');
const MEILI_KEY = process.env.MEILI_KEY;
const INDEX_UID = process.env.MEILI_PRODUCT_INDEX ?? 'products';
const BATCH_SIZE = Number.parseInt(process.env.MEILI_BATCH_SIZE ?? '500', 10);
const CLEAR_INDEX = process.argv.includes('--clear');

function writeLine(message) {
  process.stdout.write(`${message}\n`);
}

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`${name} 환경변수가 필요합니다.`);
  }
  return value;
}

function meiliHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(MEILI_KEY ? { Authorization: `Bearer ${MEILI_KEY}` } : {}),
  };
}

async function meili(path, init = {}) {
  const host = requireEnv('MEILI_HOST', MEILI_HOST);
  const response = await fetch(`${host}${path}`, {
    ...init,
    headers: {
      ...meiliHeaders(),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Meilisearch ${init.method ?? 'GET'} ${path} 실패: ${response.status} ${body}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function ensureIndex() {
  const indexPath = `/indexes/${INDEX_UID}`;
  const response = await fetch(`${requireEnv('MEILI_HOST', MEILI_HOST)}${indexPath}`, {
    headers: meiliHeaders(),
  });

  if (response.status === 404) {
    await meili('/indexes', {
      method: 'POST',
      body: JSON.stringify({ uid: INDEX_UID, primaryKey: 'id' }),
    });
    return;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Meilisearch index 조회 실패: ${response.status} ${body}`);
  }
}

async function configureIndex() {
  await meili(`/indexes/${INDEX_UID}/settings`, {
    method: 'PATCH',
    body: JSON.stringify({
      searchableAttributes: [
        'name',
        'summary',
        'sku',
        'brand.name',
        'categoryNames',
        'description',
      ],
      displayedAttributes: ['*'],
      filterableAttributes: [
        'status',
        'categoryIds',
        'categoryLegacyIndexes',
        'categorySlugs',
        'brand.id',
      ],
      sortableAttributes: [
        'legacyId',
        'createdAt',
        'viewCount',
        'priceNumber',
        'soldCount',
        'reviewCount',
      ],
      rankingRules: [
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness',
        'viewCount:desc',
        'soldCount:desc',
      ],
    }),
  });
}

function toDocument(product) {
  const categories = product.categories.map(({ category }) => category);
  const price = product.price.toString();
  const salePrice = product.salePrice?.toString() ?? null;

  return {
    id: product.id.toString(),
    legacyId: product.legacyId,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    summary: product.summary,
    description: product.description,
    price,
    salePrice,
    priceNumber: Number(salePrice ?? price),
    status: product.status,
    thumbnail: product.thumbnail ?? product.images[0]?.url ?? null,
    soldCount: product.soldCount,
    viewCount: product.viewCount,
    reviewCount: product._count.reviews,
    brand: product.brand ? { id: product.brand.id.toString(), name: product.brand.name } : null,
    categoryIds: categories.map((category) => category.id.toString()),
    categorySlugs: categories.map((category) => category.slug),
    categoryNames: categories.map((category) => category.name),
    categoryLegacyIndexes: categories.flatMap((category) =>
      category.legacyMaps.map((legacyMap) => legacyMap.legacyIndex),
    ),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

async function fetchBatch(cursorId) {
  return prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: { id: 'asc' },
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    take: BATCH_SIZE,
    include: {
      brand: { select: { id: true, name: true } },
      images: {
        where: { isMain: true },
        orderBy: { sortOrder: 'asc' },
        take: 1,
        select: { url: true },
      },
      categories: {
        include: {
          category: {
            select: {
              id: true,
              slug: true,
              name: true,
              legacyMaps: { select: { legacyIndex: true } },
            },
          },
        },
      },
      _count: { select: { reviews: { where: { isHidden: false } } } },
    },
  });
}

async function indexAllProducts() {
  const total = await prisma.product.count({ where: { deletedAt: null } });
  let indexed = 0;
  let cursorId;

  while (indexed < total) {
    const products = await fetchBatch(cursorId);
    if (products.length === 0) break;

    const documents = products.map(toDocument);
    await meili(`/indexes/${INDEX_UID}/documents`, {
      method: 'POST',
      body: JSON.stringify(documents),
    });

    indexed += documents.length;
    cursorId = products[products.length - 1]?.id;
    writeLine(`색인 진행: ${indexed}/${total}`);
  }

  return indexed;
}

async function main() {
  requireEnv('MEILI_HOST', MEILI_HOST);
  await ensureIndex();
  await configureIndex();

  if (CLEAR_INDEX) {
    await meili(`/indexes/${INDEX_UID}/documents`, { method: 'DELETE' });
    writeLine(`기존 ${INDEX_UID} 문서를 삭제했습니다.`);
  }

  const indexed = await indexAllProducts();
  writeLine(`Meilisearch ${INDEX_UID} 색인 완료: ${indexed}개 상품`);
}

main()
  .catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
