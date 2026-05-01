// Legacy sources: wb_admin/member_list_excel.php
// Cache: no-store. Admin member export must reflect private live member data.

import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import { adminUserListQuerySchema } from '@/schemas/admin-user';

export const dynamic = 'force-dynamic';

const LEGACY_MEMBER_EXCEL_COLUMNS = [
  '회원구분',
  '아이디',
  '회사명',
  '사업자번호',
  '이름',
  '가입일',
  '구매금액',
  '적립금',
  '방문수',
  '이메일',
  '우편번호',
  '주소',
  '상세주소',
  '연락처',
  '핸드폰',
  '최근접속일',
  '환불계좌은행',
  '환불계좌예금주',
  '환불계좌번호',
];

const EXPORT_BATCH_SIZE = 1000;

const userExportSelect = {
  id: true,
  loginId: true,
  email: true,
  phone: true,
  name: true,
  status: true,
  createdAt: true,
  lastLoginAt: true,
  loginCount: true,
  grade: { select: { name: true } },
  addresses: {
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    take: 1,
    select: { zipCode: true, address1: true, address2: true, phone: true },
  },
  pointHistories: {
    orderBy: { id: 'desc' },
    take: 1,
    select: { balance: true },
  },
} satisfies Prisma.UserSelect;

type UserExportRow = Prisma.UserGetPayload<{ select: typeof userExportSelect }>;

function escapeCell(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildUserWhere(
  query: ReturnType<typeof adminUserListQuerySchema.parse>,
): Prisma.UserWhereInput {
  return {
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { loginId: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
            { name: { contains: query.q, mode: 'insensitive' } },
            { phone: { contains: query.q } },
          ],
        }
      : {}),
  };
}

function memberType(status: string, gradeName: string | undefined): string {
  if (status === 'blocked') return '차단';
  if (status === 'dormant') return '휴면';
  if (status === 'withdrawn') return '탈퇴';
  return gradeName ?? '일반회원';
}

async function buildOrderTotalMap(users: UserExportRow[]): Promise<Map<string, string>> {
  const userIds = users.map((user) => user.id);
  const orderTotals =
    userIds.length > 0
      ? await prisma.order.groupBy({
          by: ['userId'],
          where: { userId: { in: userIds }, deletedAt: null },
          _sum: { total: true },
        })
      : [];

  return new Map(
    orderTotals
      .filter((row): row is typeof row & { userId: bigint } => row.userId !== null)
      .map((row) => [row.userId.toString(), row._sum.total?.toString() ?? '0']),
  );
}

function buildUserExportRow(user: UserExportRow, totalByUserId: Map<string, string>): string {
  const address = user.addresses[0];
  const values = [
    memberType(user.status, user.grade?.name),
    user.loginId ?? '',
    '',
    '',
    user.name,
    user.createdAt.toISOString().slice(0, 10),
    totalByUserId.get(user.id.toString()) ?? '0',
    user.pointHistories[0]?.balance ?? 0,
    user.loginCount,
    user.email,
    address?.zipCode ?? '',
    address?.address1 ?? '',
    address?.address2 ?? '',
    address?.phone ?? user.phone ?? '',
    user.phone ?? '',
    user.lastLoginAt?.toISOString().slice(0, 10) ?? '',
    '',
    '',
    '',
  ];

  return `<tr>${values.map((value) => `<td>${escapeCell(value)}</td>`).join('')}</tr>`;
}

async function buildUserExportRows(where: Prisma.UserWhereInput): Promise<string> {
  const rows: string[] = [];
  let skip = 0;

  while (true) {
    const users = await prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: EXPORT_BATCH_SIZE,
      select: userExportSelect,
    });

    if (users.length === 0) break;

    const totalByUserId = await buildOrderTotalMap(users);
    rows.push(...users.map((user) => buildUserExportRow(user, totalByUserId)));

    if (users.length < EXPORT_BATCH_SIZE) break;
    skip += users.length;
  }

  return rows.join('');
}

export async function GET(request: Request) {
  await requireAdmin('user.read');
  const searchParams = Object.fromEntries(new URL(request.url).searchParams);
  const query = adminUserListQuerySchema.parse(searchParams);
  const header = `<tr>${LEGACY_MEMBER_EXCEL_COLUMNS.map((column) => `<td>${escapeCell(column)}</td>`).join('')}</tr>`;
  const rows = await buildUserExportRows(buildUserWhere(query));
  const html = `<html><head><meta charset="utf-8" /></head><body><table>${header}${rows}</table></body></html>`;
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': `attachment; filename="member${stamp}.xls"`,
      'Cache-Control': 'no-store',
    },
  });
}
