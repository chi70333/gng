# 10. Migration TODO

Last checked: 2026-04-27

## Current Status

- Done: Next.js App Router skeleton, Prisma schema, Redis/Prisma/logger/cache helpers.
- Done: P0 shop browsing routes: `/`, `/category/[slug]`, `/goods/[id]`, `/best`, `/new`.
- Done: Product APIs: `/api/goods/[id]/options`, `/api/goods/filter`.
- Done: Legacy rewrite for `/api/version.php` to `/api/legacy/version`.
- Done: P0 search routes: `/search`, `/api/search`, `/api/search/suggest` using Meilisearch REST.
- Done: P1 auth foundation: Auth.js credentials route, `/join`, `/login`, argon2id password hashing, legacy md5/sha1 rehash path.
- Done: P1 legacy join agreement flow: `/join/terms`, required terms/privacy consent cookie, server-side zod validation.
- Done: P1 social auth provider wiring: Kakao/Naver enabled when env vars are present.
- Done: [GNG] Production Kakao OAuth env verified on Vercel: `KAKAO_CLIENT_ID`, `AUTH_URL`, `NEXT_PUBLIC_SITE_URL`, and `AUTH_SECRET` are set to the production domain, and `/api/auth/providers` exposes `kakao`.
- Done: P1 account recovery request page: `/account/recover` with neutral response.
- Done: P1 cart foundation: `/cart`, `/api/cart`, Redis per-user/per-guest cart with 30d TTL.
- Done: P1 order foundation: `/order`, `/order/complete`, `/api/order`, pending order creation from cart, atomic stock reservation guard.
- Done: P1 order validation: `/api/order/validate` checks cart availability against live SKU stock.
- Done: P1 payment callback foundation: `/api/payment/callback`, payment record creation, order status update, duplicate PG transaction guard, failed/cancelled stock release.
- Done: P2 mypage foundation: `/mypage` shows account summary, point balance snapshot, recent orders, coupons, and points without shared caching.
- Done: P2 product Q&A write path: `/api/product-qna` and product detail form.
- Done: P2 public board foundation: `/notice`, `/faq` with ISR 5m board list caching.
- Done: P3 admin foundation: `/admin`, `/admin/products`, `/admin/orders`, `/admin/users` no-cache operational lists.
- Done: P3 legacy API foundation: `/api/gnp-api.php`, `/api/point_sync.php` rewrites backed by Next route handlers.
- Done: P3 SEO/legal basics: `robots.ts`, `sitemap.ts`, `/rss.xml`, `/company`, `/legal/privacy`, `/legal/terms`, `/guide/return`.
- Done: DB-backed policy foundation: `SitePolicy` stores terms, privacy, collection consent, company info, and legacy placeholders.
- Done: Neon test DB migration and seed: policy, boards, posts, category, product/SKUs, and test member.
- Done: [GNG] Legacy 운영 상품 크롤링/Prisma 이관 파이프라인: `pnpm legacy:migrate-products` crawls `goods_list.php?Index=...&sty_num=1`, hydrates `goods_detail2.php`, documents field mapping, upserts Product/Category/Image/SKU relations, and verifies DB counts against crawled or expected samples.
- Passing: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

## Immediate TODO

- Continue legacy parity audit from `docs/legacy-parity-audit.md`, next starting with product list/detail/cart.
- Run `pnpm legacy:migrate-products` against the approved 운영 sample category list with `LEGACY_EXPECTED_PRODUCT_COUNT` and `LEGACY_EXPECTED_CATEGORY_COUNT`, then archive the count report.
- Import real legacy fixtures if a MySQL dump becomes available.
- Move imported legacy image URLs to R2/S3 and remove `LEGACY_IMAGE_HOSTNAME` after cutover.
- Verify Meilisearch indexing against imported product/category data.
- Verify mobile layout at 360px, 390px, and 414px after starting the dev server.
- Update `docs/03-legacy-map.md` statuses after confirming the file encoding.

## P1 TODO

- Verify Naver callback URLs and provider scopes in production.
- Connect account recovery to email/SMS provider through QStash.
- Replace stock hold/release with provider-specific payment rules and expiry cleanup.
- Verify PG-specific callback payloads and signature validation.

## P2 TODO

- Expand mypage with full order detail, addresses, compare, reviews, and Q&A.
- Implement event, comments, and 1:1 inquiry flows.

## P3 TODO

- Verify `/api/gnp-api.php` and `/api/point_sync.php` against the external caller's exact fixtures.
- Expand admin routes with edit/create forms for product, order, member, banner, and board management.
- Expand sitemap with DB-backed category/product URLs after migration.
