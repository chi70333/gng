import { z } from 'zod';

const SORT_OPTIONS = [
  'relevance',
  'new',
  'old',
  'popular',
  'price_asc',
  'price_desc',
  'sale_count',
  'review_count',
] as const;

export const searchSortSchema = z.enum(SORT_OPTIONS);

export type SearchSortOption = z.infer<typeof searchSortSchema>;

type RawSearchQuery = {
  q?: unknown;
  searchstring?: unknown;
  name?: unknown;
  detail?: unknown;
  page?: unknown;
  pagecnt?: unknown;
  offset?: unknown;
  limit?: unknown;
  list_cnt?: unknown;
  search_list_cnt?: unknown;
  sort?: unknown;
  sortStr?: unknown;
  like?: unknown;
  sty_num?: unknown;
};

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function isDetailSearch(value: unknown): boolean {
  const normalized = asString(value)?.toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'y';
}

export function mapLegacySearchSort(sortStr: unknown, sortDir: unknown): SearchSortOption {
  const field = asString(sortStr);
  const direction = asString(sortDir)?.toLowerCase();

  if (field === 'idx') return direction === 'asc' ? 'old' : 'new';
  if (field === 'readCnt') return 'popular';
  if (field === 'price') return direction === 'desc' ? 'price_desc' : 'price_asc';
  if (field === 'saleCount') return 'sale_count';
  if (field === 'reviewCount') return 'review_count';
  return 'relevance';
}

function normalizeSearchQuery(input: unknown) {
  const raw = input && typeof input === 'object' ? (input as RawSearchQuery) : {};
  const detail = isDetailSearch(raw.detail);
  const keyword = detail && asString(raw.name) ? raw.name : raw.q ?? raw.searchstring ?? raw.name;

  const rawLimit =
    Number.parseInt(asString(raw.limit) ?? asString(raw.list_cnt) ?? asString(raw.search_list_cnt) ?? '', 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : undefined;

  const rawPage = Number.parseInt(asString(raw.page) ?? '', 10);
  const rawPageCnt = Number.parseInt(asString(raw.pagecnt) ?? '', 10);
  const rawOffset = Number.parseInt(asString(raw.offset) ?? '', 10);

  let page: number | undefined;
  if (Number.isFinite(rawPage) && rawPage > 0) {
    page = rawPage;
  } else if (Number.isFinite(rawPageCnt) && rawPageCnt >= 0) {
    page = rawPageCnt + 1;
  } else if (Number.isFinite(rawOffset) && rawOffset >= 0 && limit) {
    page = Math.floor(rawOffset / limit) + 1;
  }

  const requestedSort = asString(raw.sort);
  const sort =
    requestedSort && SORT_OPTIONS.includes(requestedSort as SearchSortOption)
      ? requestedSort
      : mapLegacySearchSort(raw.sortStr, raw.sort);

  return {
    ...(input && typeof input === 'object' ? input : {}),
    q: keyword,
    page,
    limit,
    sort,
    detail,
    legacy: {
      searchstring: asString(raw.searchstring),
      sortStr: asString(raw.sortStr),
      sort: asString(raw.sort),
      name: asString(raw.name),
      pagecnt: asString(raw.pagecnt),
      offset: asString(raw.offset),
      sty_num: asString(raw.sty_num),
    },
  };
}

export const searchQuerySchema = z.preprocess(
  normalizeSearchQuery,
  z.object({
    q: z.string().trim().min(1).max(80),
    page: z.coerce.number().int().min(1).max(100).default(1),
    limit: z.coerce.number().int().min(1).max(40).default(20),
    sort: searchSortSchema.default('relevance'),
    detail: z.boolean().default(false),
    legacy: z
      .object({
        searchstring: z.string().optional(),
        sortStr: z.string().optional(),
        sort: z.string().optional(),
        name: z.string().optional(),
        pagecnt: z.string().optional(),
        offset: z.string().optional(),
        sty_num: z.string().optional(),
      })
      .default({}),
  }),
);

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;

export const suggestQuerySchema = z.preprocess(
  normalizeSearchQuery,
  z.object({
    q: z.string().trim().min(1).max(80),
    like: z
      .preprocess((value) => {
        if (typeof value === 'boolean') return value;
        if (typeof value !== 'string') return false;
        const normalized = value.toLowerCase();
        return normalized === '1' || normalized === 'true' || normalized === 'y';
      }, z.boolean())
      .default(false),
    limit: z.coerce.number().int().min(1).max(15).default(5),
  }),
);

export type SuggestQueryInput = z.infer<typeof suggestQuerySchema>;
