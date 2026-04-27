import iconv from 'iconv-lite';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as gnpRoute from './legacy/gnp-api/route';
import * as pointSyncRoute from './legacy/point-sync/route';
import * as versionRoute from './legacy/version/route';
import {
  listLegacyMembers,
  registerLegacyMember,
  syncLegacyPoint,
} from '@/server/services/legacy-api.service';

vi.mock('@/server/services/legacy-api.service', () => ({
  listLegacyMembers: vi.fn(),
  registerLegacyMember: vi.fn(),
  syncLegacyPoint: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

const token = 'test-token-from-env';

function request(
  path: string,
  init: {
    method?: string;
    headers?: HeadersInit;
    body?: unknown;
  } = {},
): NextRequest {
  const headers = new Headers(init.headers);
  const body = init.body === undefined ? undefined : JSON.stringify(init.body);

  if (body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return new NextRequest(`http://localhost${path}`, {
    method: init.method ?? 'GET',
    headers,
    body,
  });
}

async function json(res: Response): Promise<unknown> {
  return res.json();
}

describe('legacy API route compatibility', () => {
  beforeEach(() => {
    process.env.LEGACY_API_TOKEN = token;
    vi.mocked(listLegacyMembers).mockReset();
    vi.mocked(registerLegacyMember).mockReset();
    vi.mocked(syncLegacyPoint).mockReset();
  });

  it('keeps gnp-api list_members response shape, status, CORS, and auth handling', async () => {
    vi.mocked(listLegacyMembers).mockResolvedValue({
      success: true,
      total: 1,
      page: 1,
      limit: 50,
      members: [
        {
          userid: 'hong01',
          name: '홍길동',
          email: 'hong@example.com',
          hp: '01012345678',
          mileage: 1200,
          regdate: '2026-04-26T00:00:00.000Z',
        },
      ],
    });

    const res = await gnpRoute.GET(
      request('/api/legacy/gnp-api?action=list_members', {
        headers: { 'x-api-key': token },
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS');
    expect(res.headers.get('access-control-allow-headers')).toBe(
      'Content-Type, X-API-Key, Authorization',
    );
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await json(res)).toEqual({
      success: true,
      total: 1,
      page: 1,
      limit: 50,
      members: [
        {
          userid: 'hong01',
          name: '홍길동',
          email: 'hong@example.com',
          hp: '01012345678',
          mileage: 1200,
          regdate: '2026-04-26T00:00:00.000Z',
        },
      ],
    });
    expect(listLegacyMembers).toHaveBeenCalledWith({ page: 1, limit: 50, search: '' });

    const unauthorized = await gnpRoute.GET(request('/api/legacy/gnp-api?action=list_members'));
    expect(unauthorized.status).toBe(401);
    expect(await json(unauthorized)).toEqual({
      success: false,
      message: 'Unauthorized Access: Key Mismatch',
    });
  });

  it('normalizes list_members pagination and search parameters for both endpoints', async () => {
    vi.mocked(listLegacyMembers).mockResolvedValue({
      success: true,
      total: 0,
      page: 1,
      limit: 200,
      members: [],
    });

    const gnp = await gnpRoute.GET(
      request('/api/legacy/gnp-api?action=list_members&page=0&limit=999&search=%20hong%20', {
        headers: { 'x-api-key': token },
      }),
    );
    expect(gnp.status).toBe(200);
    expect(listLegacyMembers).toHaveBeenLastCalledWith({
      page: 1,
      limit: 200,
      search: 'hong',
    });

    const pointSync = await pointSyncRoute.GET(
      request('/api/legacy/point-sync?action=list_members&page=abc&limit=-3', {
        headers: { 'x-api-key': token },
      }),
    );
    expect(pointSync.status).toBe(200);
    expect(listLegacyMembers).toHaveBeenLastCalledWith({
      page: 1,
      limit: 1,
      search: '',
    });
  });

  it('preserves endpoint-specific no-action and missing-field messages', async () => {
    const gnpGet = await gnpRoute.GET(
      request('/api/legacy/gnp-api?action=unknown', {
        headers: { 'x-api-key': token },
      }),
    );
    expect(await json(gnpGet)).toEqual({ success: false, message: 'No Action' });

    const pointSyncGet = await pointSyncRoute.GET(
      request('/api/legacy/point-sync?action=unknown', {
        headers: { 'x-api-key': token },
      }),
    );
    expect(await json(pointSyncGet)).toEqual({
      success: false,
      message: 'No valid action or data provided.',
    });

    const gnpMissing = await gnpRoute.POST(
      request('/api/legacy/gnp-api?action=register_member', {
        method: 'POST',
        headers: { 'x-api-key': token },
        body: { userid: 'missing-password' },
      }),
    );
    expect(await json(gnpMissing)).toEqual({ success: false, message: 'Missing fields' });

    const pointMissing = await pointSyncRoute.POST(
      request('/api/legacy/point-sync?action=register_member', {
        method: 'POST',
        headers: { 'x-api-key': token },
        body: { userid: 'missing-password' },
      }),
    );
    expect(await json(pointMissing)).toEqual({
      success: false,
      message: 'Missing required fields (userid, password)',
    });
  });

  it('uses JSON body action for gnp-api but keeps point_sync query-action behavior', async () => {
    vi.mocked(registerLegacyMember).mockResolvedValue({
      success: true,
      message: 'Member registered successfully',
    });

    const payload = {
      action: 'register_member',
      userid: 'body-action-user',
      password: 'Password123!',
      name: 'Body Action',
    };

    const gnp = await gnpRoute.POST(
      request('/api/legacy/gnp-api', {
        method: 'POST',
        headers: { 'x-api-key': token },
        body: payload,
      }),
    );
    expect(await json(gnp)).toEqual({ success: true });
    expect(registerLegacyMember).toHaveBeenLastCalledWith(
      expect.objectContaining({ userid: 'body-action-user' }),
    );

    vi.mocked(registerLegacyMember).mockClear();
    const pointSync = await pointSyncRoute.POST(
      request('/api/legacy/point-sync', {
        method: 'POST',
        headers: { 'x-api-key': token },
        body: payload,
      }),
    );
    expect(await json(pointSync)).toEqual({
      success: false,
      message: 'No valid action or data provided.',
    });
    expect(registerLegacyMember).not.toHaveBeenCalled();
  });

  it('handles malformed JSON like an empty legacy request', async () => {
    const req = new NextRequest('http://localhost/api/legacy/gnp-api?action=register_member', {
      method: 'POST',
      headers: {
        'x-api-key': token,
        'content-type': 'application/json',
      },
      body: '{',
    });

    const res = await gnpRoute.POST(req);
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ success: false, message: 'Missing fields' });
  });

  it('keeps register_member messages for gnp-api and point_sync', async () => {
    vi.mocked(registerLegacyMember).mockResolvedValueOnce({ success: true });
    vi.mocked(registerLegacyMember).mockResolvedValueOnce({
      success: true,
      message: 'Member registered successfully',
    });

    const payload = {
      userid: 'kim01',
      password: 'Password123!',
      name: '김민수',
      email: 'kim@example.com',
      hp: '01011112222',
    };

    const gnp = await gnpRoute.POST(
      request('/api/legacy/gnp-api?action=register_member', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: payload,
      }),
    );
    expect(gnp.status).toBe(200);
    expect(await json(gnp)).toEqual({ success: true });

    const pointSync = await pointSyncRoute.POST(
      request('/api/legacy/point-sync?action=register_member', {
        method: 'POST',
        headers: { 'x-api-key': token },
        body: payload,
      }),
    );
    expect(pointSync.status).toBe(200);
    expect(await json(pointSync)).toEqual({
      success: true,
      message: 'Member registered successfully',
    });
    expect(registerLegacyMember).toHaveBeenLastCalledWith(payload);
  });

  it('keeps point sync success and user-not-found messages', async () => {
    vi.mocked(syncLegacyPoint).mockResolvedValueOnce({
      success: true,
      message: 'Point Synchronized Successfully',
    });
    vi.mocked(syncLegacyPoint).mockResolvedValueOnce({
      success: false,
      message: 'User not found',
    });

    const payload = {
      userid: 'hong01',
      amount: 500,
      new_balance: 1700,
      reason: '외부 포인트 연동',
    };

    const gnp = await gnpRoute.POST(
      request('/api/legacy/gnp-api', {
        method: 'POST',
        headers: { 'x-api-key': token },
        body: payload,
      }),
    );
    expect(await json(gnp)).toEqual({ success: true, message: 'Success' });

    const pointSync = await pointSyncRoute.POST(
      request('/api/legacy/point-sync', {
        method: 'POST',
        headers: { 'x-api-key': token },
        body: payload,
      }),
    );
    expect(await json(pointSync)).toEqual({ success: false, message: 'User not found' });
    expect(syncLegacyPoint).toHaveBeenLastCalledWith(payload);
  });

  it('accepts query token auth and returns the shared OPTIONS preflight response', async () => {
    vi.mocked(listLegacyMembers).mockResolvedValue({
      success: true,
      total: 0,
      page: 1,
      limit: 50,
      members: [],
    });

    const authorized = await pointSyncRoute.GET(
      request(`/api/legacy/point-sync?action=list_members&token=${token}`),
    );
    expect(authorized.status).not.toBe(401);

    const preflight = pointSyncRoute.OPTIONS();
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*');
    expect(preflight.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS');
  });

  it('preserves UTF-8 names while documenting the legacy EUC-KR fixture boundary', async () => {
    const utf8Name = '홍길동';
    const legacyEucKrFixture = iconv.encode(utf8Name, 'euc-kr');

    expect(iconv.decode(legacyEucKrFixture, 'euc-kr')).toBe(utf8Name);
    expect(iconv.decode(Buffer.from(JSON.stringify({ name: utf8Name })), 'utf-8')).toContain(
      utf8Name,
    );

    vi.mocked(registerLegacyMember).mockResolvedValue({
      success: true,
      message: 'Member registered successfully',
    });

    await pointSyncRoute.POST(
      request('/api/legacy/point-sync?action=register_member', {
        method: 'POST',
        headers: { 'x-api-key': token },
        body: {
          userid: 'euckr01',
          password: 'Password123!',
          name: utf8Name,
        },
      }),
    );

    expect(registerLegacyMember).toHaveBeenCalledWith(
      expect.objectContaining({ name: utf8Name }),
    );
  });

  it('retires the phpinfo version endpoint with an explicit 410 response', async () => {
    const res = versionRoute.GET();

    expect(res.status).toBe(410);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await json(res)).toEqual({
      result: 'GONE',
      code: 'PHPINFO_DISABLED',
      message: 'phpinfo endpoint was removed for security.',
    });
  });
});
