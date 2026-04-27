import { PrismaClient } from '@prisma/client';
import iconv from 'iconv-lite';

const prisma = new PrismaClient();

const baseUrl = requiredEnv('LEGACY_BASE_URL');
const categoryIndexes = requiredEnv('LEGACY_CATEGORY_INDEXES')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const dryRun = process.env.LEGACY_MIGRATION_DRY_RUN === '1';
const maxPagesPerCategory = Number.parseInt(process.env.LEGACY_MAX_PAGES_PER_CATEGORY ?? '50', 10);
const imageStrategy = process.env.LEGACY_IMAGE_STRATEGY ?? 'remote';
const expectedProductCount = optionalInt(process.env.LEGACY_EXPECTED_PRODUCT_COUNT);
const expectedCategoryCount = optionalInt(process.env.LEGACY_EXPECTED_CATEGORY_COUNT);

function requiredEnv(key) {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is required.`);
  return value.replace(/\/+$/, '');
}

function optionalInt(value) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function write(message) {
  process.stdout.write(`${message}\n`);
}

function absoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return '';
  return new URL(pathOrUrl.replace(/&amp;/g, '&'), `${baseUrl}/`).toString();
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(value) {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' '));
}

function parseMoney(value) {
  const normalized = value.replace(/[^\d]/g, '');
  return normalized ? `${normalized}.00` : '0.00';
}

function slugFromLegacyId(goodsIdx) {
  return `legacy-${goodsIdx}`;
}

function skuFromLegacyId(goodsIdx) {
  return `legacy-${goodsIdx}`;
}

function numericLegacyId(goodsIdx) {
  const parsed = Number.parseInt(goodsIdx, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid goodsIdx: ${goodsIdx}`);
  }
  return parsed;
}

function categoryCode(index) {
  return `legacy-category-${index}`;
}

function categorySlug(index) {
  return `legacy-category-${index}`;
}

async function fetchLegacy(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'GNG Next migration crawler',
      accept: 'text/html,*/*',
    },
  });
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return iconv.decode(buffer, 'euc-kr');
}

function extractCategoryName(html, index) {
  const listTitle = html.match(/<div[^>]*class=["'][^"']*list_tit[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (listTitle) return stripTags(listTitle[1]).replace(/^(>|·|\s)+/, '') || `레거시 카테고리 ${index}`;

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) return stripTags(title[1]) || `레거시 카테고리 ${index}`;

  return `레거시 카테고리 ${index}`;
}

function extractListLinks(html, currentUrl, index) {
  const links = new Set();
  const anchorRegex = /href=["']([^"']*(?:goods_list|goods_list_ajax)\.php[^"']*)["']/gi;
  let match;
  while ((match = anchorRegex.exec(html))) {
    const url = absoluteUrl(match[1]);
    if (new URL(url).searchParams.get('Index') === index) links.add(url);
  }

  const current = new URL(currentUrl);
  const pageCountMatches = [...html.matchAll(/pagecnt[=\s:'"]+(\d+)/gi)];
  for (const pageMatch of pageCountMatches) {
    const next = new URL(current.toString());
    next.searchParams.set('pagecnt', pageMatch[1]);
    links.add(next.toString());
  }

  return [...links];
}

function extractProductsFromList(html, index) {
  const products = [];
  const itemRegex = /<li[^>]*class=["'][^"']*new_blo_list[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(html))) {
    const item = itemMatch[1];
    const link = item.match(/goods_detail\.php\?[^"']*goodsIdx=(\d+)[^"']*/i);
    if (!link) continue;

    const img = item.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    const name = item.match(/class=["'][^"']*product_name[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const price = item.match(/class=["'][^"']*product_price[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

    products.push({
      goodsIdx: link[1],
      categoryIndex: index,
      name: name ? stripTags(name[1]) : `레거시 상품 ${link[1]}`,
      thumbnail: img ? absoluteUrl(img[1]) : '',
      price: price ? parseMoney(stripTags(price[1])) : '0.00',
    });
  }
  return products;
}

function extractDetail(html, product) {
  const name = html.match(/class=["'][^"']*m_detail_name[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  const price = html.match(/class=["'][^"']*m_detail_price[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  const detailImage = html.match(/class=["'][^"']*m_detail_img[^"']*["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
  const content = html.match(/class=["'][^"']*m_detail_content[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div class=["']m_buy_btns/i);

  return {
    ...product,
    name: name ? stripTags(name[1]) : product.name,
    price: price ? parseMoney(stripTags(price[1])) : product.price,
    detailImage: detailImage ? absoluteUrl(detailImage[1]) : '',
    description: content ? content[1].trim() : '',
  };
}

async function crawlCategory(index) {
  const queue = [
    absoluteUrl(`/goods_list.php?Index=${encodeURIComponent(index)}&sty_num=1`),
    absoluteUrl(`/goods_list_ajax.php?Index=${encodeURIComponent(index)}&sty_num=1`),
  ];
  const seenPages = new Set();
  const products = new Map();
  let categoryName = `레거시 카테고리 ${index}`;

  while (queue.length > 0 && seenPages.size < maxPagesPerCategory) {
    const url = queue.shift();
    if (!url || seenPages.has(url)) continue;
    seenPages.add(url);

    const html = await fetchLegacy(url);
    categoryName = extractCategoryName(html, index);

    for (const item of extractProductsFromList(html, index)) {
      products.set(item.goodsIdx, item);
    }

    for (const nextUrl of extractListLinks(html, url, index)) {
      if (!seenPages.has(nextUrl)) queue.push(nextUrl);
    }
  }

  return {
    category: { index, name: categoryName },
    products: [...products.values()],
    crawledPages: seenPages.size,
  };
}

async function hydrateDetails(products) {
  const hydrated = [];
  for (const product of products) {
    const detailUrl = absoluteUrl(
      `/goods_detail2.php?goodsIdx=${encodeURIComponent(product.goodsIdx)}&Index=${encodeURIComponent(
        product.categoryIndex,
      )}`,
    );
    try {
      hydrated.push(extractDetail(await fetchLegacy(detailUrl), product));
    } catch (error) {
      write(`detail skipped goodsIdx=${product.goodsIdx}: ${error.message}`);
      hydrated.push({ ...product, detailImage: '', description: '' });
    }
  }
  return hydrated;
}

function buildImageList(product) {
  return [product.thumbnail, product.detailImage]
    .filter(Boolean)
    .filter((url, index, urls) => urls.indexOf(url) === index)
    .map((url, index) => ({
      url,
      alt: product.name,
      sortOrder: index + 1,
      isMain: index === 0,
    }));
}

async function upsertCategory(tx, category) {
  return tx.category.upsert({
    where: { code: categoryCode(category.index) },
    update: {
      name: category.name,
      slug: categorySlug(category.index),
      depth: 0,
      isActive: true,
    },
    create: {
      code: categoryCode(category.index),
      slug: categorySlug(category.index),
      name: category.name,
      depth: 0,
      sortOrder: Number.parseInt(category.index, 10) || 0,
      isActive: true,
    },
  });
}

async function upsertProduct(tx, product, category) {
  const sku = skuFromLegacyId(product.goodsIdx);
  const legacyId = numericLegacyId(product.goodsIdx);
  const images = buildImageList(product);
  const status = product.price === '0.00' ? 'hidden' : 'active';
  const saved = await tx.product.upsert({
    where: { sku },
    update: {
      legacyId,
      slug: slugFromLegacyId(product.goodsIdx),
      name: product.name,
      description: product.description || null,
      price: product.price,
      status,
      thumbnail: images[0]?.url ?? null,
      attributes: {
        imageStrategy,
        legacy: {
          source: 'goods_list.php/goods_detail2.php',
          goodsIdx: product.goodsIdx,
          categoryIndex: product.categoryIndex,
          listThumbnail: product.thumbnail,
          detailImage: product.detailImage,
        },
      },
    },
    create: {
      legacyId,
      sku,
      slug: slugFromLegacyId(product.goodsIdx),
      name: product.name,
      description: product.description || null,
      price: product.price,
      status,
      thumbnail: images[0]?.url ?? null,
      attributes: {
        imageStrategy,
        legacy: {
          source: 'goods_list.php/goods_detail2.php',
          goodsIdx: product.goodsIdx,
          categoryIndex: product.categoryIndex,
          listThumbnail: product.thumbnail,
          detailImage: product.detailImage,
        },
      },
      skus: {
        create: {
          code: `${sku}-DEFAULT`,
          optionValues: {},
          stock: 999999,
          isActive: true,
        },
      },
    },
    select: { id: true },
  });

  await tx.productSku.upsert({
    where: { code: `${sku}-DEFAULT` },
    update: { stock: 999999, isActive: true },
    create: {
      productId: saved.id,
      code: `${sku}-DEFAULT`,
      optionValues: {},
      stock: 999999,
      isActive: true,
    },
  });

  await tx.productImage.deleteMany({ where: { productId: saved.id } });
  if (images.length > 0) {
    await tx.productImage.createMany({
      data: images.map((image) => ({ ...image, productId: saved.id })),
    });
  }

  await tx.categoryOnProduct.upsert({
    where: { categoryId_productId: { categoryId: category.id, productId: saved.id } },
    update: { sortOrder: 1 },
    create: { categoryId: category.id, productId: saved.id, sortOrder: 1 },
  });

  return saved.id;
}

async function migrate(categories, products) {
  if (dryRun) return { migratedProducts: 0 };

  let migratedProducts = 0;
  for (const category of categories) {
    const categoryProducts = products.filter((product) => product.categoryIndex === category.index);
    await prisma.$transaction(async (tx) => {
      const savedCategory = await upsertCategory(tx, category);
      for (const product of categoryProducts) {
        await upsertProduct(tx, product, savedCategory);
        migratedProducts += 1;
      }
    });
  }
  return { migratedProducts };
}

async function verify(products, categories) {
  const skus = products.map((product) => skuFromLegacyId(product.goodsIdx));
  const categoryCodes = categories.map((category) => categoryCode(category.index));
  const [dbProductCount, dbSkuCount, dbImageCount, dbCategoryCount] = dryRun
    ? [0, 0, 0, 0]
    : await prisma.$transaction([
        prisma.product.count({ where: { sku: { in: skus } } }),
        prisma.productSku.count({ where: { code: { in: skus.map((sku) => `${sku}-DEFAULT`) } } }),
        prisma.productImage.count({ where: { product: { sku: { in: skus } } } }),
        prisma.category.count({ where: { code: { in: categoryCodes } } }),
      ]);

  const report = {
    dryRun,
    sourceProductCount: products.length,
    sourceCategoryCount: categories.length,
    dbProductCount,
    dbSkuCount,
    dbImageCount,
    dbCategoryCount,
    expectedProductCount,
    expectedCategoryCount,
    productCountMatches:
      expectedProductCount === null ? dbProductCount === products.length : dbProductCount === expectedProductCount,
    categoryCountMatches:
      expectedCategoryCount === null
        ? dbCategoryCount === categories.length
        : dbCategoryCount === expectedCategoryCount,
  };

  write(JSON.stringify(report, null, 2));

  if (!dryRun && (!report.productCountMatches || !report.categoryCountMatches)) {
    throw new Error('Migrated DB counts do not match the crawled or expected sample counts.');
  }
}

async function main() {
  const crawled = [];
  for (const index of categoryIndexes) {
    write(`crawl category Index=${index}`);
    crawled.push(await crawlCategory(index));
  }

  const categories = crawled.map((item) => item.category);
  const listProducts = crawled.flatMap((item) => item.products);
  const productsById = new Map(listProducts.map((product) => [product.goodsIdx, product]));
  const products = await hydrateDetails([...productsById.values()]);

  await migrate(categories, products);
  await verify(products, categories);
}

main()
  .catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
