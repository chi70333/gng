// Cache: no-store. Admin mileage upload template is permission-gated operational data.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin/auth';

export const dynamic = 'force-dynamic';

const MILEAGE_TEMPLATE_COLUMNS = ['회원ID', '아이디', '이메일', '마일리지', '처리방식', '사유'];

function escapeCell(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const tableStyle =
  'border-collapse:collapse;border:1px solid #6b7280;font-family:Arial,sans-serif;font-size:12px;';
const headerCellStyle =
  'border:1px solid #6b7280;background:#e5e7eb;color:#111827;font-weight:800;text-align:center;padding:8px 10px;';
const bodyCellStyle = 'border:1px solid #6b7280;padding:7px 10px;mso-number-format:"\\@";';

function tableRow(values: (string | number)[], isHeader = false): string {
  const tag = isHeader ? 'th' : 'td';
  const cellStyle = isHeader ? headerCellStyle : bodyCellStyle;

  return `<tr>${values
    .map((value) => `<${tag} style="${cellStyle}">${escapeCell(value)}</${tag}>`)
    .join('')}</tr>`;
}

export async function GET() {
  await requireAdmin('user.read');
  const rows = [
    MILEAGE_TEMPLATE_COLUMNS,
    [123, 'member01', 'member01@example.com', 1000, '부여', '행사 마일리지 지급'],
    [124, 'member02', 'member02@example.com', '', '초기화', '관리자 마일리지 초기화'],
  ];
  const html = [
    '<html>',
    '<head><meta charset="utf-8" /></head>',
    '<body>',
    `<table style="${tableStyle}">`,
    rows.map((row, index) => tableRow(row, index === 0)).join(''),
    '</table>',
    '</body>',
    '</html>',
  ].join('');

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': 'attachment; filename="gng-mileage-upload-template.xls"',
      'Cache-Control': 'no-store',
    },
  });
}
