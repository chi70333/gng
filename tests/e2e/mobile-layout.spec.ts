import { expect, test } from '@playwright/test';

const routes = [
  '/',
  '/category/test-category',
  '/goods/legacy-parity-test-product',
  '/cart',
  '/order',
  '/login',
  '/join',
  '/mypage',
];

type LayoutIssue = {
  route: string;
  message: string;
};

test.describe('모바일 실기기 수준 레이아웃', () => {
  for (const route of routes) {
    test(`${route} 모바일 레이아웃 기본 검증`, async ({ page }, testInfo) => {
      const issues: LayoutIssue[] = [];
      await page.goto(route, { waitUntil: 'networkidle' });

      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('body')).not.toHaveText(/�/);

      const viewport = page.viewportSize();
      expect([360, 390, 414]).toContain(viewport?.width);

      const interactiveIssues = await page.evaluate(() => {
        const selectors = 'a[href], button, input, select, textarea, [role="button"]';
        return Array.from(document.querySelectorAll<HTMLElement>(selectors))
          .filter((element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
          })
          .map((element) => {
            const target = element.closest('label') ?? element;
            const rect = target.getBoundingClientRect();
            const label =
              element.getAttribute('aria-label') ||
              element.textContent?.trim() ||
              element.getAttribute('name') ||
              element.tagName.toLowerCase();
            return rect.width < 44 || rect.height < 44
              ? `${label}: ${Math.round(rect.width)}x${Math.round(rect.height)}`
              : null;
          })
          .filter((issue): issue is string => Boolean(issue));
      });
      for (const issue of interactiveIssues) {
        issues.push({ route, message: `터치 타겟 44px 미만: ${issue}` });
      }

      const imageIssues = await page.evaluate(() => {
        return Array.from(document.images)
          .filter((image) => image.currentSrc && image.naturalWidth > 0)
          .filter((image) => {
            const rect = image.getBoundingClientRect();
            const isLikelyContentImage = rect.width >= 120 || rect.height >= 120;
            return isLikelyContentImage && !image.getAttribute('sizes');
          })
          .map((image) => image.getAttribute('alt') || image.currentSrc);
      });
      for (const issue of imageIssues) {
        issues.push({ route, message: `next/image sizes 누락 후보: ${issue}` });
      }

      const largestImage = await page.evaluate(() => {
        const images = Array.from(document.images)
          .filter((image) => image.currentSrc && image.naturalWidth > 0)
          .map((image) => {
            const rect = image.getBoundingClientRect();
            return {
              alt: image.getAttribute('alt') || image.currentSrc,
              area: Math.round(rect.width * rect.height),
              loading: image.getAttribute('loading'),
              priority: image.getAttribute('fetchpriority'),
            };
          })
          .sort((a, b) => b.area - a.area);
        return images[0] ?? null;
      });
      if (largestImage && largestImage.area > 40_000 && largestImage.loading === 'lazy') {
        issues.push({
          route,
          message: `LCP 후보 이미지가 lazy 로딩입니다: ${largestImage.alt}`,
        });
      }

      const overlapIssues = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,p,a,button,label,span'))
          .filter((element) => {
            const text = element.textContent?.trim();
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return (
              !!text &&
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              rect.width > 8 &&
              rect.height > 8 &&
              !element.closest('footer') &&
              rect.bottom >= 0 &&
              rect.top <= window.innerHeight
            );
          })
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              text: element.textContent?.trim().slice(0, 40) ?? '',
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              area: rect.width * rect.height,
            };
          });

        const overlaps: string[] = [];
        for (let i = 0; i < elements.length; i += 1) {
          for (let j = i + 1; j < elements.length; j += 1) {
            const a = elements[i];
            const b = elements[j];
            if (!a || !b) continue;
            const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
            const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            const overlap = x * y;
            if (overlap > 0 && overlap / Math.min(a.area, b.area) > 0.6) {
              if (!a.text.includes(b.text) && !b.text.includes(a.text)) {
                overlaps.push(`${a.text} / ${b.text}`);
              }
            }
          }
        }
        return overlaps.slice(0, 5);
      });
      for (const issue of overlapIssues) {
        issues.push({ route, message: `텍스트 겹침 후보: ${issue}` });
      }

      if (issues.length > 0) {
        await page.screenshot({
          path: testInfo.outputPath(`mobile-layout-${route.replace(/[^a-z0-9]/gi, '-')}.png`),
          fullPage: true,
        });
      }

      expect(issues).toEqual([]);
    });
  }
});
