# GNG — Next.js Rebuild

기존 PHP 쇼핑몰(`legacy/www/`)을 Next.js 14 + PostgreSQL(Neon) + Vercel 환경으로 재구축하는 프로젝트입니다.

> 모든 작업은 [AGENTS.md](AGENTS.md) 의 규칙을 따라야 합니다.
> 설계·우선순위·캐시 전략·모바일 기준은 `docs/` 참조.

## 왜 재구축하는가
- 기존 시스템이 **동시접속 1만+ 트래픽을 감당하지 못함** (본 프로젝트 존재 이유).
- 주 사용자가 **모바일**. 반응형 단일 코드베이스로 통합.
- 외부 시스템이 호출 중인 기존 API는 **호환 유지**.

## 기술 스택
Next.js 14 (App Router) · TypeScript · Prisma · PostgreSQL (Neon) · Upstash Redis ·
NextAuth.js · Tailwind CSS · zod · TanStack Query · Meilisearch · Cloudflare R2 · Vercel

## 시작하기

```bash
# 1) 레거시 코드 참조용 복사 (읽기 전용)
#    C:\Users\LENOVO\Desktop\Dev\07. GNG\_\www  ->  ./legacy/www
#    (.gitignore 되어 있으므로 커밋되지 않음)

# 2) 의존성 설치
pnpm install

# 3) 환경변수
copy .env.example .env.local
# Neon / Upstash / NextAuth 키 채우기

# 4) DB 준비
pnpm db:generate
pnpm db:migrate

# 5) 개발 서버
pnpm dev
```

## 디렉토리
```
AGENTS.md           ← 에이전트 지침 (항상 먼저 읽기)
docs/               ← 설계 문서 00~08
prisma/             ← 스키마/마이그레이션
src/
  app/              ← 라우트 (App Router)
  server/           ← 서버 전용 (db/redis/services/repositories)
  lib/              ← 유틸 (logger, rate-limit, errors, format, cn)
  components/       ← UI
  schemas/          ← zod
legacy/             ← 기존 PHP (READ-ONLY)
```

## 주요 스크립트
- `pnpm dev` 개발 서버
- `pnpm build` 프로덕션 빌드 (prisma generate 포함)
- `pnpm typecheck` / `pnpm lint` / `pnpm test`
- `pnpm db:migrate` / `pnpm db:studio`

## 배포
Vercel(Region: `icn1`). 프리뷰 배포에서 Lighthouse 모바일 + k6 부하 테스트 후 프로덕션 승격.

## 다음 작업 순서
[docs/03-legacy-map.md](docs/03-legacy-map.md) 의 P0 부터 순서대로:
1. 인프라/Auth 골격 완성 → 2. 상품 목록/상세/검색(ISR) → 3. 장바구니/주문/결제 → 4. 게시판/마이페이지 → 5. 관리자 → 6. 레거시 API 호환 마무리.
