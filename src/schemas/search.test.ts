import { describe, expect, it } from 'vitest';
import { mapLegacySearchSort, searchQuerySchema, suggestQuerySchema } from './search';

describe('searchQuerySchema', () => {
  it('trims a query and applies defaults', () => {
    const parsed = searchQuerySchema.parse({ q: '  shoes  ' });

    expect(parsed).toMatchObject({
      q: 'shoes',
      page: 1,
      limit: 20,
      sort: 'relevance',
      detail: false,
    });
  });

  it('rejects empty queries', () => {
    const parsed = searchQuerySchema.safeParse({ q: '   ' });

    expect(parsed.success).toBe(false);
  });

  it('accepts legacy search_result.php keyword and sort parameters', () => {
    const parsed = searchQuerySchema.parse({
      searchstring: '  셔츠  ',
      sortStr: 'price',
      sort: 'desc',
      sty_num: '1',
    });

    expect(parsed.q).toBe('셔츠');
    expect(parsed.sort).toBe('price_desc');
    expect(parsed.legacy.sty_num).toBe('1');
  });

  it('maps legacy pagecnt/offset parameters to modern page', () => {
    const fromPageCount = searchQuerySchema.parse({
      searchstring: '가방',
      pagecnt: '2',
    });
    const fromOffset = searchQuerySchema.parse({
      searchstring: '가방',
      offset: '40',
      limit: '20',
    });

    expect(fromPageCount.page).toBe(3);
    expect(fromOffset.page).toBe(3);
  });

  it('uses name as the keyword for detail searches', () => {
    const parsed = searchQuerySchema.parse({
      searchstring: '전체',
      detail: '1',
      name: '린넨',
    });

    expect(parsed.q).toBe('린넨');
    expect(parsed.detail).toBe(true);
  });

  it.each([
    ['ranking', 'asc', 'relevance'],
    ['idx', 'desc', 'new'],
    ['idx', 'asc', 'old'],
    ['readCnt', 'desc', 'popular'],
    ['price', 'asc', 'price_asc'],
    ['price', 'desc', 'price_desc'],
    ['saleCount', 'desc', 'sale_count'],
    ['reviewCount', 'desc', 'review_count'],
  ] as const)('maps legacy sortStr=%s sort=%s to %s', (sortStr, sort, expected) => {
    expect(mapLegacySearchSort(sortStr, sort)).toBe(expected);
  });
});

describe('suggestQuerySchema', () => {
  it('limits suggestions to a bounded number', () => {
    const parsed = suggestQuerySchema.parse({ q: 'bag', limit: '15' });

    expect(parsed.limit).toBe(15);
    expect(parsed.like).toBe(false);
  });

  it('supports legacy like=1 for suggest_search.php compatibility', () => {
    const parsed = suggestQuerySchema.parse({ q: 'bag', like: '1' });

    expect(parsed.like).toBe(true);
  });

  it('rejects too many suggestions', () => {
    const parsed = suggestQuerySchema.safeParse({ q: 'bag', limit: '16' });

    expect(parsed.success).toBe(false);
  });
});
