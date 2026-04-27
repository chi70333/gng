import { describe, expect, it } from 'vitest';

const enabled = process.env.GNG_EXT_TEST_ENABLED === '1';
const describeExternal = enabled ? describe : describe.skip;

const baseUrl = process.env.GNG_EXT_TEST_BASE_URL?.replace(/\/$/, '') ?? '';
const token = process.env.GNG_EXT_TEST_TOKEN ?? process.env.LEGACY_API_TOKEN ?? '';
const userPrefix = process.env.GNG_TEST_USER_PREFIX ?? 'gng_ext';
const runId = `${userPrefix}_${Date.now()}`;

function requireExternalEnv() {
  if (!baseUrl) throw new Error('GNG_EXT_TEST_BASE_URL is required.');
  if (!token) throw new Error('GNG_EXT_TEST_TOKEN or LEGACY_API_TOKEN is required.');
  if (
    /gng-gngshop\.vercel\.app/i.test(baseUrl) &&
    process.env.GNG_EXT_TEST_ALLOW_PRODUCTION !== '1'
  ) {
    throw new Error(
      'External legacy API tests must target staging. Set GNG_EXT_TEST_ALLOW_PRODUCTION=1 only for an intentional production smoke test.',
    );
  }
}

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

describeExternal('external legacy API staging contract', () => {
  it('verifies CORS, auth failures, rewrite paths, UTF-8 payloads, and point sync', async () => {
    requireExternalEnv();

    const preflight = await fetch(`${baseUrl}/api/gnp-api.php`, { method: 'OPTIONS' });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*');
    expect(preflight.headers.get('cache-control')).toBe('no-store');

    const unauthorized = await fetch(`${baseUrl}/api/point_sync.php?action=list_members`);
    expect(unauthorized.status).toBe(401);
    expect(await readJson(unauthorized)).toEqual({
      success: false,
      message: 'Unauthorized Access: Key Mismatch',
    });

    const userid = `${runId}_api`;
    const registerPayload = {
      userid,
      password: 'Password123!',
      name: '외부 연동 테스트',
      email: `${userid}@example.test`,
      hp: '010-9999-0001',
    };

    const gnpRegister = await fetch(`${baseUrl}/api/gnp-api.php?action=register_member`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': token,
      },
      body: JSON.stringify(registerPayload),
    });
    expect(gnpRegister.status).toBe(200);
    expect(gnpRegister.headers.get('cache-control')).toBe('no-store');
    expect(await readJson(gnpRegister)).toEqual({ success: true });

    const duplicate = await fetch(`${baseUrl}/api/point_sync.php?action=register_member`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(registerPayload),
    });
    expect(duplicate.status).toBe(200);
    expect(await readJson(duplicate)).toEqual({
      success: false,
      message: 'User already exists',
    });

    const pointSync = await fetch(`${baseUrl}/api/point_sync.php`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userid,
        amount: 500,
        new_balance: 500,
        reason: '외부 포인트 연동',
      }),
    });
    expect(pointSync.status).toBe(200);
    expect(await readJson(pointSync)).toEqual({
      success: true,
      message: 'Point Synchronized Successfully',
    });

    const members = await fetch(
      `${baseUrl}/api/gnp-api.php?action=list_members&search=${encodeURIComponent(
        userid,
      )}&token=${encodeURIComponent(token)}`,
    );
    expect(members.status).toBe(200);
    expect(await readJson(members)).toEqual({
      success: true,
      total: 1,
      page: 1,
      limit: 50,
      members: [
        expect.objectContaining({
          userid,
          name: '외부 연동 테스트',
          email: `${userid}@example.test`,
          hp: '01099990001',
          mileage: 500,
        }),
      ],
    });

    const version = await fetch(`${baseUrl}/api/version.php`);
    expect(version.status).toBe(410);
    expect(await readJson(version)).toEqual({
      result: 'GONE',
      code: 'PHPINFO_DISABLED',
      message: 'phpinfo endpoint was removed for security.',
    });
  });
});
