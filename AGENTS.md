# GNG Shopping Mall — Next.js Migration

## 0. 고객용 UI 언어

- 한국 사용자를 위한 쇼핑몰이므로 고객에게 보이는 제목, 버튼, 안내문, 에러 문구, `aria-label`, metadata title/description은 기본적으로 한국어로 작성한다.
- 외부 브랜드명, 상품명, 코드 식별자, API 호환 응답 코드처럼 계약이나 고유명사인 값만 영어를 허용한다.
- `src/app/(shop)`, `src/app/page.tsx`, `src/components`에 영어 쇼핑몰 문구를 추가했다면 `pnpm check:korean-ui`가 실패하지 않는지 확인한다.

> 본 문서는 모든 코딩 에이전트(Claude Code, Cursor, Copilot CLI 등)가 작업 전 **반드시 먼저 읽어야 하는** 메인 지침이다.

---

## 1. 프로젝트 목적 (절대 잊지 말 것)

기존 PHP 쇼핑몰(`legacy/www/`)이 **만 명 이상 동시 사용자 트래픽을 감당하지 못해** Next.js + PostgreSQL 로 전면 재구축한다.

따라서 이 프로젝트의 1순위 목표는:

1. **트래픽 폭증을 견디는 아키텍처** (= 캐시/ISR/Edge/CDN 적극 활용)
2. **모바일 우선 UX** (주 사용자는 모바일)
3. **기존 외부 API 호환성 유지** (외부 시스템이 이미 호출 중)

순서를 절대 바꾸지 말 것. "예쁘게"보다 "안 터지게"가 먼저.

---

## 2. 절대 규칙 (Hard Rules)

### 2.1 트래픽/성능
- 상품 목록·상세·메인은 **ISR(Incremental Static Regeneration)** 또는 **RSC + Cache** 필수.
- `fetch` 호출에는 항상 `next: { revalidate: N, tags: [...] }` 명시.
- DB 직접 호출하는 페이지는 무조건 `unstable_cache` 또는 `cache()` 래핑.
- N+1 쿼리 금지. Prisma `include` / `select` 명시적으로.
- 인기 데이터(상품, 카테고리, 배너)는 **Redis 캐시 → DB** 순으로 조회.
- 무거운 작업(메일, SMS, 외부 API 호출)은 `after()` 또는 큐(Upstash QStash)로 비동기화.

### 2.2 모바일 최적화
- **모바일 퍼스트** 디자인. Tailwind 기본 클래스는 모바일, `md:`/`lg:`는 데스크톱.
- 뷰포트 기준: 360px, 390px, 414px 우선 검증.
- 이미지: `next/image` + `sizes` 속성 필수, AVIF/WebP, lazy loading 기본.
- 폰트: `next/font` + subset, 한글 폰트는 `display: swap` + 서브셋팅.
- LCP < 2.5s, INP < 200ms, CLS < 0.1 (모바일 4G 기준).
- 터치 타겟 최소 44×44px.
- 무한스크롤은 `IntersectionObserver` + react-query `useInfiniteQuery`.
- 기존 `/m/` 별도 페이지 구조 흉내내지 말 것. **단일 반응형 코드베이스**.

### 2.3 보안/안정성
- 비밀번호: **argon2id** (cost ≥ 3, mem ≥ 64MB). 레거시 해시는 `legacy_password` 컬럼에 보관 후 첫 로그인 검증 시 재해시.
- 모든 API 입력: **zod** 스키마 검증 후 처리. 검증 실패는 400.
- SQL은 **Prisma**만 사용. raw SQL은 인덱스 힌트 등 명시 사유 + 코멘트 필수.
- 시크릿/키 하드코딩 금지. `.env.local` + Vercel 환경변수.
- 레거시 PHP의 `@extract($_GET); @extract($_POST);` 같은 패턴 절대 재현 금지.
- CSRF: Server Action 또는 `next-auth` CSRF 토큰 사용.
- 금액은 **Prisma `Decimal`** + 표시는 `Intl.NumberFormat`. `number` 산술 금지.
- 한국 개인정보보호법: 휴면(1년) 자동 처리, 탈퇴 시 즉시 익명화.

### 2.4 API 호환성
- 외부에서 호출 중인 기존 API는 **동일한 URL/메서드/응답 형식** 으로 재구현.
- 대상 (확인된 것): `/api/gnp-api.php`, `/api/point_sync.php`, `/api/version.php`.
- Next.js Route Handler에서 **`.php` 경로도 유지** (`app/api/gnp-api.php/route.ts`).
- 또는 `next.config.mjs` `rewrites` 로 `.php` → 신규 경로 매핑.
- 응답 인코딩 전환(euc-kr → UTF-8) 시 외부 시스템 영향 검토 후 진행. 필요시 두 인코딩 동시 지원 기간을 둠.

### 2.5 코드 품질
- TypeScript `strict: true`. `any` 사용 금지(불가피하면 `unknown` + 타입가드).
- ESLint + Prettier + import 정렬 강제.
- 파일당 한 가지 책임. Server Component와 Client Component 명확히 분리.
- `'use client'` 는 정말 필요한 컴포넌트에만.
- `console.log` 금지 → `lib/logger` 사용.
- 새 npm 패키지 추가는 `docs/04-conventions.md` 의 화이트리스트 갱신 후.

---

## 3. 기술 스택 (변경 시 사전 합의)

| 영역 | 선택 | 이유 |
|---|---|---|
| Framework | Next.js 14 App Router + TypeScript | RSC, ISR, Edge |
| Hosting | **Vercel** | 자동 CDN, ISR, 이미지 최적화 |
| DB | **PostgreSQL 16** (Neon 또는 Supabase) | JSONB, 동시성, 검색 |
| ORM | **Prisma** | DX, 타입 안전 |
| Cache/Session | **Upstash Redis** (서버리스) | 세션, 장바구니, 캐시, rate-limit |
| Auth | **NextAuth.js (Auth.js v5)** | credential + 카카오/네이버 |
| 검색 | **Meilisearch**(자체) 또는 **Algolia**(SaaS) | 한글 검색, LIKE 금지 |
| Storage | **Cloudflare R2** 또는 **AWS S3** | 이미지/파일 |
| Image CDN | Vercel `next/image` + R2 | 자동 변환 |
| Validation | **zod** | 런타임 + 타입 |
| State | **TanStack Query** + Zustand | 서버상태/클라상태 분리 |
| UI | **Tailwind CSS** + **shadcn/ui** | 모바일 친화 |
| Test | **Vitest** + Playwright | 단위/E2E |
| 큐/스케줄 | **Upstash QStash** | Vercel 친화 |
| 모니터링 | **Sentry** + Vercel Analytics + **Vercel Speed Insights** | |

---

## 4. 디렉토리 구조

```
gng/
├── AGENTS.md                  ← 이 파일
├── README.md
├── docs/                      ← 설계 문서 (에이전트가 항상 참조)
│   ├── 00-overview.md
│   ├── 01-architecture.md
│   ├── 02-db-schema.md
│   ├── 03-legacy-map.md       ← PHP → 신규 라우트 매핑표
│   ├── 04-conventions.md
│   ├── 05-vercel.md
│   ├── 06-mobile.md
│   ├── 07-traffic.md
│   └── 08-api-compat.md
├── legacy/                    ← (사용자가 직접 복사) 기존 PHP, READ-ONLY
│   └── www/...
├── prisma/
│   └── schema.prisma
├── public/
├── src/
│   ├── app/
│   │   ├── (shop)/            ← 사용자 페이지
│   │   ├── (admin)/           ← 관리자
│   │   ├── api/               ← 신규 API
│   │   │   └── (legacy)/      ← .php 호환 엔드포인트
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── server/
│   │   ├── db.ts              ← Prisma 싱글턴
│   │   ├── redis.ts           ← Upstash 싱글턴
│   │   ├── auth.ts            ← Auth.js 설정
│   │   ├── services/          ← 비즈니스 로직 (재사용)
│   │   └── repositories/      ← DB 접근
│   ├── lib/
│   │   ├── logger.ts
│   │   ├── format.ts
│   │   ├── cache.ts           ← unstable_cache 래퍼
│   │   └── rate-limit.ts
│   ├── components/
│   │   ├── ui/                ← shadcn
│   │   └── shop/
│   ├── schemas/               ← zod
│   ├── hooks/
│   └── styles/
├── tests/
├── .env.example
├── next.config.mjs
├── tsconfig.json
├── vercel.json
└── package.json
```

---

## 5. 작업 절차 (모든 작업 공통)

1. **`docs/03-legacy-map.md` 에서 대상 PHP 파일 확인**
2. `legacy/www/<파일>.php` 를 직접 읽고 로직 분석 → TS 코드 상단 주석에 요약
3. 신규 코드 작성 (위 스택 준수)
4. **검증**:
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm test` (해당 기능)
5. **모바일 검증** (필수): 360×640 뷰포트에서 동작/레이아웃 확인
6. **캐시 전략 명시**: 페이지/API마다 ISR 주기 또는 Redis TTL 코멘트로 표기
7. `docs/03-legacy-map.md` 의 해당 행 상태를 `✅ done` 으로 갱신
8. 변경 요약 출력 (PR 설명 형식)

---

## 6. 금지 사항

- ❌ 새 npm 패키지 무단 추가
- ❌ `console.log`, `any`, raw SQL (사유 없는 경우)
- ❌ 한 파일에 Server/Client 로직 혼재
- ❌ 임시 테스트 파일 (`test.ts`, `foo.ts`, `tmp/`) 커밋
- ❌ 모바일 테스트 없이 PR 종결
- ❌ 캐시 전략 없이 DB 직접 호출하는 페이지 추가
- ❌ 기존 `/m/` 폴더처럼 모바일 전용 라우트 만들기
- ❌ legacy/ 디렉토리 수정

---

## 7. 우선순위 로드맵 (개발 순서)

| 단계 | 범위 | 캐시 전략 |
|---|---|---|
| P0 | 인프라(Prisma/Redis/Auth/Logger), 메인, 상품 목록/상세 | ISR 60s, Redis 5m |
| P0 | 검색 (Meilisearch 연동) | Edge cache 30s |
| P1 | 회원가입/로그인/세션 | - |
| P1 | 장바구니 (Redis 기반) | Redis 30d |
| P1 | 주문/결제 (PG 연동) | no-cache |
| P2 | 마이페이지/쿠폰/적립금 | per-user, no-cache |
| P2 | 게시판/문의 | ISR 5m |
| P3 | 관리자 페이지 | no-cache |
| P3 | 레거시 API 호환 엔드포인트 | per-endpoint |

---

## 8. 자주 인용할 문서

- 아키텍처/캐시 전략 → `docs/01-architecture.md`, `docs/07-traffic.md`
- DB 스키마/마이그레이션 → `docs/02-db-schema.md`
- 어떤 PHP를 어디로? → `docs/03-legacy-map.md`
- 모바일 가이드 → `docs/06-mobile.md`
- Vercel 제약 → `docs/05-vercel.md`
- 기존 API 호환 → `docs/08-api-compat.md`
- 코딩 컨벤션 → `docs/04-conventions.md`
