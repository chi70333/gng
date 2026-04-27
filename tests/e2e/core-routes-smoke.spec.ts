import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

type SmokeRoute = {
  label: string;
  path: string;
};

const smokeRoutes: SmokeRoute[] = [
  { label: '쇼핑몰 메인', path: '/' },
  { label: '베스트 상품', path: '/best' },
  { label: '신상품', path: '/new' },
  { label: '상품 카테고리', path: '/category/test-category' },
  { label: '상품 상세', path: '/goods/legacy-parity-test-product' },
  { label: '상품 검색', path: '/search?q=test' },
  { label: '회원 로그인', path: '/login' },
  { label: '회원 약관', path: '/join/terms' },
  { label: '회원 가입', path: '/join' },
  { label: '장바구니', path: '/cart' },
  { label: '주문서', path: '/order' },
  { label: '주문 완료', path: '/order/complete?orderNo=SMOKE-TEST' },
  { label: '마이페이지', path: '/mypage' },
  { label: '마일리지', path: '/mypage/points' },
  { label: '쿠폰', path: '/mypage/coupons' },
  { label: '관리자 로그인', path: '/admin/login' },
  { label: '관리자 대시보드', path: '/admin' },
  { label: '관리자 상품', path: '/admin/products' },
  { label: '관리자 주문', path: '/admin/orders' },
  { label: '관리자 회원', path: '/admin/users' },
  { label: '관리자 쿠폰', path: '/admin/coupons' },
  { label: '관리자 카테고리', path: '/admin/categories' },
  { label: '관리자 게시판', path: '/admin/boards' },
  { label: '관리자 설정', path: '/admin/settings' },
  { label: '게시글 잘못된 ID', path: '/board/notice/not-a-number' },
  { label: '문의 잘못된 ID', path: '/help/inquiries/not-a-number' },
];

const runtimeErrorPatterns = [
  /hydration failed/i,
  /there was an error while hydrating/i,
  /text content does not match server-rendered html/i,
  /minified react error/i,
  /uncaught/i,
  /unhandled runtime error/i,
  /application error/i,
  /server error/i,
];

function isRuntimeConsoleError(message: ConsoleMessage): boolean {
  if (message.type() !== 'error') return false;
  const text = message.text();
  return runtimeErrorPatterns.some((pattern) => pattern.test(text));
}

async function findNextDevErrorOverlay(page: Page): Promise<string | null> {
  const overlay = page.locator('[data-nextjs-dialog], nextjs-portal').first();
  if ((await overlay.count()) === 0) return null;
  if (!(await overlay.isVisible().catch(() => false))) return null;
  return (
    (await overlay.textContent().catch(() => null))?.trim() ??
    'Next.js 개발 오류 오버레이가 표시되었습니다.'
  );
}

test.describe('핵심 URL smoke test', () => {
  for (const route of smokeRoutes) {
    test(`${route.label} (${route.path})`, async ({ page }) => {
      const failures: string[] = [];

      page.on('pageerror', (error) => {
        failures.push(`브라우저 런타임 오류: ${error.message}`);
      });

      page.on('console', (message) => {
        if (isRuntimeConsoleError(message)) {
          failures.push(`콘솔 런타임 오류: ${message.text()}`);
        }
      });

      page.on('response', (response) => {
        if (response.status() >= 500) {
          failures.push(`500 응답: ${response.status()} ${response.url()}`);
        }
      });

      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response, `${route.path} 문서 응답이 없습니다.`).not.toBeNull();
      expect(response?.status(), `${route.path} 문서가 500 계열 응답을 반환했습니다.`).toBeLessThan(
        500,
      );

      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(500);

      const overlayText = await findNextDevErrorOverlay(page);
      if (overlayText) {
        failures.push(`Next.js 오류 오버레이: ${overlayText}`);
      }

      expect(failures).toEqual([]);
    });
  }
});
