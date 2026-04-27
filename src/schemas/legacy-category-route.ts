import { z } from 'zod';
import type { SortOption } from '@/server/repositories/product.repository';

export const legacyGoodsListQuerySchema = z.object({
  Index: z.coerce.number().int().positive(),
  data: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().optional(),
  sort: z.string().optional(),
  sortStr: z.string().optional(),
});

export type LegacyGoodsListQuery = z.infer<typeof legacyGoodsListQuerySchema>;

export function resolveLegacyGoodsListSort(
  query: Pick<LegacyGoodsListQuery, 'sort' | 'sortStr'>,
): SortOption {
  const sort = query.sort?.toLowerCase();
  const sortStr = query.sortStr?.toLowerCase();

  if (sortStr === 'price' && sort === 'asc') return 'price_asc';
  if (sortStr === 'price' && sort === 'desc') return 'price_desc';
  if (sortStr === 'salecount' || sortStr === 'readcnt') return 'popular';

  return 'new';
}

export function resolveLegacyGoodsListPage(
  query: Pick<LegacyGoodsListQuery, 'data' | 'page'>,
): number {
  return query.page ?? query.data ?? 1;
}
