// Cache: no-store. Admin product CSV templates are permission-gated operational files.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin/auth';

export const dynamic = 'force-dynamic';

const PRODUCT_IMPORT_TEMPLATE_COLUMNS = [
  '상품코드(보조)',
  '노출여부(1=노출,0=미노출)',
  '예비1',
  '상품코드',
  '상품명',
  '판매가',
  '예비2',
  '예비3',
  '적립률',
  '예비4',
  '제조사',
  '예비5',
  '원산지',
  '재고상태(1=수량관리,2=품절,공백=무제한)',
  '재고수량',
  '예비6',
  '예비7',
  '예비8',
  '예비9',
  '예비10',
  '예비11',
  '예비12',
  '예비13',
  '예비14',
  '상품이미지1',
  '상품이미지2',
  '상품이미지3',
  '상품이미지4',
  '상품이미지5',
  '상품이미지6',
  '상품이미지7',
  '상품이미지8',
  '상세설명',
  '예비15',
  '예비16',
  '예비17',
  '카테고리코드',
  '상세이미지1',
  '상세이미지2',
  '상세이미지3',
  '상세이미지4',
  '마진율',
  '매입가',
  '검색키워드',
  '보관위치',
  '품질',
  '모델명',
];

const PRODUCT_IMPORT_TEMPLATE_SAMPLE = [
  'GNG-001',
  '1',
  '',
  'GNG-001',
  '샘플 상품',
  '12000',
  '',
  '',
  '1',
  '',
  'GNG',
  '',
  '대한민국',
  '1',
  '100',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  'https://example.com/product-1.jpg',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '<p>상품 상세 설명을 입력하세요.</p>',
  '',
  '',
  '',
  '1001',
  '',
  '',
  '',
  '',
  '20',
  '8000',
  '샘플,추천',
  'A-01',
  '상',
  'MODEL-001',
];

function csvCell(value: string): string {
  return `"${value.replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`;
}

function csvRow(values: string[]): string {
  return values.map(csvCell).join(',');
}

export async function GET() {
  await requireAdmin('product.write');
  const csv = `\uFEFF${[
    csvRow(PRODUCT_IMPORT_TEMPLATE_COLUMNS),
    csvRow(PRODUCT_IMPORT_TEMPLATE_SAMPLE),
    '',
  ].join('\r\n')}`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="gng-product-upload-template.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
