import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { pruneOldApiCommunicationLogs } from '@/server/services/api-communication-log.service';

vi.mock('@/server/services/api-communication-log.service', () => ({
  pruneOldApiCommunicationLogs: vi.fn(),
}));

function request(authorization?: string): NextRequest {
  const headers = new Headers();
  if (authorization) headers.set('authorization', authorization);

  return new NextRequest('http://localhost/api/cron/prune-api-logs', {
    headers,
  });
}

describe('prune API logs cron route', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-test-secret';
    vi.mocked(pruneOldApiCommunicationLogs).mockReset();
  });

  it('rejects requests when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET;

    const res = await GET(request('Bearer cron-test-secret'));

    expect(res.status).toBe(500);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      success: false,
      message: 'CRON_SECRET 환경변수가 설정되지 않았습니다.',
    });
    expect(pruneOldApiCommunicationLogs).not.toHaveBeenCalled();
  });

  it('rejects unauthorized cron requests', async () => {
    const res = await GET(request('Bearer wrong-secret'));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      success: false,
      message: '인증되지 않은 크론 요청입니다.',
    });
    expect(pruneOldApiCommunicationLogs).not.toHaveBeenCalled();
  });

  it('prunes old API logs for authorized cron requests', async () => {
    vi.mocked(pruneOldApiCommunicationLogs).mockResolvedValue({
      cutoff: new Date('2026-04-29T18:00:00.000Z'),
      deletedCount: 5,
      retentionDays: 3,
    });

    const res = await GET(request('Bearer cron-test-secret'));

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      success: true,
      retentionDays: 3,
      cutoff: '2026-04-29T18:00:00.000Z',
      deletedCount: 5,
    });
    expect(pruneOldApiCommunicationLogs).toHaveBeenCalledTimes(1);
  });
});
