# 04. Code Conventions

## 고객용 UI 언어
- `src/app/(shop)`, `src/app/page.tsx`, `src/components`에 노출되는 제목, 버튼, 안내문, 에러 문구, `aria-label`, metadata title/description은 기본 한국어로 작성한다.
- 외부 브랜드명, 상품명, 코드 식별자, API 호환 응답 코드처럼 고유명사나 시스템 계약에 해당하는 값만 영어를 허용한다.
- 대표적인 영어 쇼핑몰 문구 재유입은 `pnpm check:korean-ui`와 `pnpm lint`에서 차단한다. 새 예외가 필요하면 먼저 이 문서에 사유를 남긴다.

## TypeScript
- `strict: true`, `noUncheckedIndexedAccess: true`.
- `any` 금지. 외부 응답 등 부득이한 경우 `unknown` + zod 파싱.
- 모든 함수 export 시 시그니처 명시.
- `interface` 보다 `type` 선호 (확장은 union으로).

## 파일 명명
- 컴포넌트: `PascalCase.tsx`
- 훅: `useXxx.ts`
- 유틸: `kebab-case.ts`
- 라우트 파일: Next.js 규약(`page.tsx`, `route.ts`, `layout.tsx`).
- zod 스키마: `src/schemas/<domain>.ts` 에 모음, export `xxxSchema`, `XxxInput` 타입 같이.

## 컴포넌트
- 기본은 Server Component. `'use client'` 는 상호작용/브라우저 API 필요 시만.
- props는 명시적 type, 옵셔널은 의미있는 default.
- 스타일은 Tailwind 우선. 복잡 시 `clsx`/`tailwind-merge` 사용.
- shadcn/ui 컴포넌트는 그대로 두지 말고 `components/ui/`로 가져와 커스터마이즈.

## 서버 코드
- DB 접근은 `server/repositories/` 만. 서비스에서 repository 호출.
- 트랜잭션은 `prisma.$transaction(async (tx) => ...)`.
- 외부 API 호출은 `lib/http.ts` (timeout 5s 기본, retry 정책 명시).
- 절대 페이지 컴포넌트에서 직접 Prisma 호출 금지 → service 경유.

## API 응답 규약
```ts
// 성공
{ ok: true, data: T }
// 실패
{ ok: false, error: { code: string, message: string, fields?: Record<string,string[]> } }
```
- 상태 코드: 200/201/400/401/403/404/409/422/429/500.
- 레거시 호환 엔드포인트는 예외(원본 형식 유지).

## 에러 처리
- 도메인 에러는 `src/lib/errors.ts` 의 클래스 사용 (`ValidationError`, `NotFoundError`, `ConflictError`, `AuthError`).
- 라우트 핸들러 최상단에서 `try/catch` 후 `toApiError()` 변환.
- 사용자에게 내부 메시지 노출 금지.

## 로깅
- `lib/logger.ts` (pino) 만 사용.
- PII 출력 금지 (이메일, 전화 마스킹).
- `console.*` 사용 시 ESLint 에러.

## 테스트
- 비즈니스 서비스 단위테스트는 Vitest.
- repository는 testcontainers Postgres or Prisma mock.
- 결제/주문 등 핵심 플로우는 Playwright E2E.

## 커밋/PR
- Conventional Commits (`feat:`, `fix:`, `chore:` ...).
- PR 본문에 변경 페이지/캐시 전략/모바일 검증 스크린샷 첨부.

## 패키지 화이트리스트 (이 외에는 사전 합의)

### 런타임
- next, react, react-dom
- typescript, zod
- @prisma/client, prisma
- next-auth (Auth.js v5), @auth/prisma-adapter
- @upstash/redis, @upstash/ratelimit, @upstash/qstash
- argon2 (또는 @node-rs/argon2)
- pino
- date-fns
- clsx, tailwind-merge
- @tanstack/react-query, zustand
- meilisearch
- iron-session (선택)
- @sentry/nextjs
- @vercel/analytics, @vercel/speed-insights

### UI
- tailwindcss, postcss, autoprefixer
- @radix-ui/* (shadcn 의존)
- lucide-react
- sonner (토스트)
- @tiptap/react, @tiptap/pm, @tiptap/starter-kit, @tiptap/extension-image, @tiptap/extension-link, @tiptap/extension-underline (관리자 상품 상세 설명 에디터)

### Dev
- vitest, @vitest/ui
- @testing-library/react, @testing-library/jest-dom
- @playwright/test
- eslint, eslint-config-next, @typescript-eslint/*
- prettier, prettier-plugin-tailwindcss
- @types/node, @types/react

추가하려면 `docs/04-conventions.md` 의 본 목록에 PR로 함께 반영.
