import { NextRequest } from 'next/server';
import { redirectLegacyGoodsDetail } from '@/server/routes/legacy-goods-detail';

export const runtime = 'nodejs';
export const revalidate = 60;

export function GET(req: NextRequest) {
  return redirectLegacyGoodsDetail(req);
}
