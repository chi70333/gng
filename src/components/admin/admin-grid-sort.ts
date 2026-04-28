import type { AdminSortDirection } from './AdminDataGrid';

export function parseAdminSort<T extends readonly string[]>(
  searchParams: { sort?: string; dir?: string },
  allowed: T,
): { sort?: T[number]; dir: AdminSortDirection } {
  const sort = allowed.includes(searchParams.sort ?? '') ? (searchParams.sort as T[number]) : undefined;
  return { sort, dir: searchParams.dir === 'asc' ? 'asc' : 'desc' };
}

export function createAdminSortHref(
  pathname: string,
  params: URLSearchParams,
): (sort: string, dir: AdminSortDirection) => string {
  return (sort, dir) => {
    const nextParams = new URLSearchParams(params);
    if (nextParams.get('sort') === sort) {
      nextParams.delete('sort');
      nextParams.delete('dir');
    } else {
      nextParams.set('sort', sort);
      nextParams.set('dir', dir);
    }
    nextParams.delete('page');
    const query = nextParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  };
}

export function compareAdminValues(a: unknown, b: unknown, dir: AdminSortDirection): number {
  const direction = dir === 'asc' ? 1 : -1;

  if (a instanceof Date || b instanceof Date) {
    const aTime = a instanceof Date ? a.getTime() : 0;
    const bTime = b instanceof Date ? b.getTime() : 0;
    return (aTime - bTime) * direction;
  }

  if (typeof a === 'number' || typeof b === 'number') {
    return ((Number(a) || 0) - (Number(b) || 0)) * direction;
  }

  return String(a ?? '').localeCompare(String(b ?? ''), 'ko-KR') * direction;
}
