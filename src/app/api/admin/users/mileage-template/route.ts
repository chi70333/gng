// Cache: no-store. Admin mileage upload template is permission-gated operational data.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin/auth';
import { createXlsxWorkbook } from '@/lib/xlsx';

export const dynamic = 'force-dynamic';

const MILEAGE_TEMPLATE_COLUMNS = ['ID', '마일리지', '처리방식', '사유'];

export async function GET() {
  await requireAdmin('user.read');
  const rows = [
    MILEAGE_TEMPLATE_COLUMNS,
    ['kakao-1231212412', 1000, '부여', '행사 마일리지 지급'],
    ['member02', '', '초기화', '관리자 마일리지 초기화'],
  ];
  const xlsx = createXlsxWorkbook(rows, '마일리지');

  return new NextResponse(new Uint8Array(xlsx), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="gng-mileage-upload-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
