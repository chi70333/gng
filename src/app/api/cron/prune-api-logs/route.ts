import { NextRequest, NextResponse } from 'next/server';
import { pruneOldApiCommunicationLogs } from '@/server/services/api-communication-log.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function noStoreJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return noStoreJson(
      {
        success: false,
        message: 'CRON_SECRET 환경변수가 설정되지 않았습니다.',
      },
      500,
    );
  }

  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return noStoreJson(
      {
        success: false,
        message: '인증되지 않은 크론 요청입니다.',
      },
      401,
    );
  }

  const result = await pruneOldApiCommunicationLogs();

  return noStoreJson({
    success: true,
    retentionDays: result.retentionDays,
    cutoff: result.cutoff.toISOString(),
    deletedCount: result.deletedCount,
  });
}
