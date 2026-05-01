import type { Prisma } from '@prisma/client';

export const ADMIN_USER_SORT_KEYS = [
  'no',
  'name',
  'loginId',
  'email',
  'status',
  'mileage',
  'loginCount',
  'lastLoginAt',
  'createdAt',
] as const;

export type AdminUserSortKey = (typeof ADMIN_USER_SORT_KEYS)[number];
export type AdminUserSortDirection = 'asc' | 'desc';

export function parseAdminUserSort(searchParams: {
  sort?: string;
  dir?: string;
}): {
  sort?: AdminUserSortKey;
  dir: AdminUserSortDirection;
} {
  const sort = ADMIN_USER_SORT_KEYS.includes(searchParams.sort as AdminUserSortKey)
    ? (searchParams.sort as AdminUserSortKey)
    : undefined;
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc';
  return { sort, dir };
}

export function adminUserOrderBy(
  sort: Exclude<AdminUserSortKey, 'mileage'>,
  dir: AdminUserSortDirection,
): Prisma.UserOrderByWithRelationInput {
  if (sort === 'no' || sort === 'createdAt') return { createdAt: dir };
  if (sort === 'name') return { name: dir };
  if (sort === 'loginId') return { loginId: dir };
  if (sort === 'email') return { email: dir };
  if (sort === 'status') return { status: dir };
  if (sort === 'loginCount') return { loginCount: dir };
  if (sort === 'lastLoginAt') return { lastLoginAt: dir };
  return { createdAt: dir };
}

export function buildAdminUserSortHref(
  basePath: string,
  currentParams: URLSearchParams,
  sort: AdminUserSortKey,
  dir: AdminUserSortDirection,
): string {
  const nextParams = new URLSearchParams(currentParams);
  nextParams.set('sort', sort);
  nextParams.set('dir', dir);
  nextParams.delete('page');

  const nextQuery = nextParams.toString();
  return nextQuery ? `${basePath}?${nextQuery}` : basePath;
}
