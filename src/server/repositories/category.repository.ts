// 카테고리 DB 접근 레이어.
// 레거시 PHP: _goods_list.php — part_index/part1_code/part2_code/part3_code 트리 구조를
// Prisma 셀프-관계(Category.parent/children)로 재구현.
// N+1 금지: findMany 한 번 조회 후 JS에서 트리 변환.

import { prisma } from '@/server/db';

export interface SerializedCategory {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  slug: string;
  depth: number;
  sortOrder: number;
  isActive: boolean;
  children: SerializedCategory[];
}

export interface LegacyCategoryMapping {
  legacyIndex: number;
  slug: string;
  name: string;
  categoryId: string;
}

/** 플랫 배열 → 계층 트리 변환 (메모리 내). */
export function buildCategoryTree(
  flat: Omit<SerializedCategory, 'children'>[],
): SerializedCategory[] {
  const map = new Map<string, SerializedCategory>();
  const roots: SerializedCategory[] = [];

  for (const c of flat) {
    map.set(c.id, { ...c, children: [] });
  }
  for (const c of flat) {
    const node = map.get(c.id)!;
    if (c.parentId) {
      const parent = map.get(c.parentId);
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }
    roots.push(node);
  }
  return roots;
}

/** 활성 카테고리 전체 플랫 목록 (depth·sortOrder 오름차순). */
export async function getAllActiveCategories(): Promise<
  Omit<SerializedCategory, 'children'>[]
> {
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ depth: 'asc' }, { parentId: 'asc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      parentId: true,
      code: true,
      name: true,
      slug: true,
      depth: true,
      sortOrder: true,
      isActive: true,
    },
  });
  return rows.map((r: { id: bigint; parentId: bigint | null; code: string; name: string; slug: string; depth: number; sortOrder: number; isActive: boolean }) => ({
    ...r,
    id: r.id.toString(),
    parentId: r.parentId?.toString() ?? null,
  }));
}

/** slug 기준 단건 조회. */
export async function getCategoryBySlug(
  slug: string,
): Promise<Omit<SerializedCategory, 'children'> | null> {
  const r = await prisma.category.findUnique({
    where: { slug },
    select: {
      id: true,
      parentId: true,
      code: true,
      name: true,
      slug: true,
      depth: true,
      sortOrder: true,
      isActive: true,
    },
  });
  if (!r) return null;
  return { ...r, id: r.id.toString(), parentId: r.parentId?.toString() ?? null };
}

/** 특정 카테고리의 조상 목록 (breadcrumb 용) — 루트부터 오름차순. */
/** legacy category.idx 기준 호환 라우트 매핑 조회. */
export async function getCategoryByLegacyIndex(
  legacyIndex: number,
): Promise<LegacyCategoryMapping | null> {
  const row = await prisma.categoryLegacyMap.findUnique({
    where: { legacyIndex },
    select: {
      legacyIndex: true,
      category: {
        select: {
          id: true,
          slug: true,
          name: true,
          isActive: true,
        },
      },
    },
  });

  if (!row || !row.category.isActive) return null;

  return {
    legacyIndex: row.legacyIndex,
    slug: row.category.slug,
    name: row.category.name,
    categoryId: row.category.id.toString(),
  };
}

export async function getCategoryAncestors(
  slug: string,
): Promise<Omit<SerializedCategory, 'children'>[]> {
  const target = await getCategoryBySlug(slug);
  if (!target) return [];

  const ancestors: Omit<SerializedCategory, 'children'>[] = [];
  let parentId = target.parentId;

  // 최대 depth=3 이므로 루프 횟수 제한적
  while (parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: BigInt(parentId) },
      select: {
        id: true,
        parentId: true,
        code: true,
        name: true,
        slug: true,
        depth: true,
        sortOrder: true,
        isActive: true,
      },
    });
    if (!parent) break;
    ancestors.unshift({
      ...parent,
      id: parent.id.toString(),
      parentId: parent.parentId?.toString() ?? null,
    });
    parentId = parent.parentId?.toString() ?? null;
  }
  return ancestors;
}
