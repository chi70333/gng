import { describe, expect, it } from 'vitest';
import {
  legacyGoodsListQuerySchema,
  resolveLegacyGoodsListPage,
  resolveLegacyGoodsListSort,
} from './legacy-category-route';

describe('legacyGoodsListQuerySchema', () => {
  it('accepts legacy Index and sty_num-style extra params', () => {
    const parsed = legacyGoodsListQuerySchema.parse({
      Index: '388',
      sty_num: '1',
      data: '2',
      sortStr: 'price',
      sort: 'asc',
    });

    expect(parsed.Index).toBe(388);
    expect(resolveLegacyGoodsListPage(parsed)).toBe(2);
    expect(resolveLegacyGoodsListSort(parsed)).toBe('price_asc');
  });

  it('rejects missing or invalid Index values', () => {
    expect(() => legacyGoodsListQuerySchema.parse({})).toThrow();
    expect(() => legacyGoodsListQuerySchema.parse({ Index: 'abc' })).toThrow();
  });
});

describe('resolveLegacyGoodsListSort', () => {
  it('maps legacy list sort params to category sort options', () => {
    expect(resolveLegacyGoodsListSort({ sortStr: 'price', sort: 'desc' })).toBe(
      'price_desc',
    );
    expect(resolveLegacyGoodsListSort({ sortStr: 'saleCount', sort: 'desc' })).toBe(
      'popular',
    );
    expect(resolveLegacyGoodsListSort({ sortStr: 'idx', sort: 'desc' })).toBe('new');
  });
});
