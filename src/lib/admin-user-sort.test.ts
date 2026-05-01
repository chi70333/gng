import { describe, expect, it } from 'vitest';
import { buildAdminUserSortHref, parseAdminUserSort } from './admin-user-sort';

describe('admin user sorting', () => {
  it('accepts mileage as a sortable column', () => {
    expect(parseAdminUserSort({ sort: 'mileage', dir: 'asc' })).toEqual({
      sort: 'mileage',
      dir: 'asc',
    });
  });

  it('falls back to descending direction for unsupported dir values', () => {
    expect(parseAdminUserSort({ sort: 'name', dir: 'sideways' })).toEqual({
      sort: 'name',
      dir: 'desc',
    });
  });

  it('keeps the same column sortable in both asc and desc directions', () => {
    const params = new URLSearchParams('q=kim&page=3&pageSize=30&sort=name&dir=asc');

    expect(buildAdminUserSortHref('/admin/users', params, 'name', 'desc')).toBe(
      '/admin/users?q=kim&pageSize=30&sort=name&dir=desc',
    );
    expect(buildAdminUserSortHref('/admin/users', params, 'name', 'asc')).toBe(
      '/admin/users?q=kim&pageSize=30&sort=name&dir=asc',
    );
  });
});
