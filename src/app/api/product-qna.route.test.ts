import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from '@/server/auth';
import { createProductQna } from '@/server/services/product-qna.service';
import * as route from './product-qna/route';

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/server/services/product-qna.service', () => ({
  createProductQna: vi.fn(),
}));

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/product-qna', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function json(res: Response): Promise<unknown> {
  return res.json();
}

type TestSession = { user?: { email?: string | null }; expires: string } | null;
const authMock = vi.mocked(auth as unknown as () => Promise<TestSession>);

describe('product Q&A route', () => {
  beforeEach(() => {
    authMock.mockReset();
    vi.mocked(createProductQna).mockReset();
  });

  it('allows guest product inquiries like the legacy goods_ask_ok.php flow', async () => {
    authMock.mockResolvedValue(null);
    vi.mocked(createProductQna).mockResolvedValue({ id: '123' });

    const res = await route.POST(
      request({
        productId: '2',
        title: '배송 문의',
        content: '배송 일정이 궁금합니다.',
        isPrivate: false,
      }),
    );

    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await json(res)).toEqual({ ok: true, data: { id: '123' } });
    expect(createProductQna).toHaveBeenCalledWith(null, {
      productId: '2',
      title: '배송 문의',
      content: '배송 일정이 궁금합니다.',
      isPrivate: false,
    });
  });

  it('attaches the logged-in user email when available', async () => {
    authMock.mockResolvedValue({
      user: { email: 'member@example.com' },
      expires: '2099-01-01T00:00:00.000Z',
    });
    vi.mocked(createProductQna).mockResolvedValue({ id: '124' });

    const res = await route.POST(
      request({
        productId: '2',
        title: '비공개 문의',
        content: '비공개 문의 내용입니다.',
        isPrivate: true,
      }),
    );

    expect(res.status).toBe(201);
    expect(createProductQna).toHaveBeenCalledWith('member@example.com', {
      productId: '2',
      title: '비공개 문의',
      content: '비공개 문의 내용입니다.',
      isPrivate: true,
    });
  });

  it('returns a Korean validation message for invalid payloads', async () => {
    authMock.mockResolvedValue(null);

    const res = await route.POST(request({ productId: 'nope', title: '', content: '' }));

    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION', message: '문의 내용을 확인해 주세요.' },
    });
    expect(createProductQna).not.toHaveBeenCalled();
  });
});
