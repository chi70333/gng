# 01. Architecture

## 전체 구성

```
[모바일/PC 사용자]
        │
        ▼
┌──────────────────────────┐
│ Vercel Edge Network (CDN) │  ← 정적자산, ISR HTML, 이미지 최적화
└──────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│ Next.js 14 (App Router) on Vercel    │
│  - RSC / ISR / Server Action          │
│  - Route Handlers (REST/legacy 호환)   │
│  - Middleware (auth, rate-limit, A/B) │
└──────────────────────────────────────┘
   │            │             │
   ▼            ▼             ▼
┌────────┐ ┌─────────┐ ┌──────────────┐
│ Neon   │ │ Upstash │ │ Meilisearch  │
│ (PG16) │ │ (Redis) │ │ (검색/자동완성)│
└────────┘ └─────────┘ └──────────────┘
   │
   ▼
┌─────────────────┐
│ R2 / S3 (이미지) │
└─────────────────┘

비동기 처리: Upstash QStash (메일/SMS/외부 API push)
```

## 캐시 계층 (성능의 핵심)

| 레이어 | 도구 | 용도 | TTL 가이드 |
|---|---|---|---|
| L0 — Browser | Cache-Control | 정적 자산 | 1y immutable |
| L1 — Vercel CDN | ISR/Edge cache | 페이지 HTML | 30s ~ 5m |
| L2 — App memory | `cache()` (RSC) | 단일 요청 내 dedup | 요청 단위 |
| L3 — Redis | Upstash | 카테고리/인기상품/세션 | 1m ~ 1h |
| L4 — DB | PostgreSQL | 원본 | - |

**원칙**: 한 요청이 L4(DB)까지 도달하는 비율을 5% 이하로 만든다.

## 데이터 흐름 예시 (상품 상세)

1. CDN 캐시 hit → 즉시 응답 (수만 RPS도 부담 없음)
2. miss → Vercel 함수 실행 → Redis `product:{id}` 조회
3. Redis miss → Prisma → Postgres → Redis 저장
4. ISR로 HTML 생성 → CDN 저장 → 60s 동안 재사용
5. 관리자가 상품 수정 → `revalidateTag('product-{id}')` 즉시 무효화

## 라우팅 전략

- `/` 메인 → ISR 60s
- `/goods/[slug]` 상품 상세 → ISR 60s + on-demand revalidate
- `/category/[slug]` → ISR 120s
- `/search?q=` → Edge runtime + 30s cache
- `/cart`, `/order/*`, `/mypage/*` → 동적 SSR (no-cache)
- `/api/*` → Route Handler (각 엔드포인트별 cache 정책)
- `/api/(legacy)/*.php` → 기존 호환 (별도 문서 08 참조)

## 런타임 선택

| 라우트 | 런타임 | 이유 |
|---|---|---|
| 상품/메인 | Node.js (기본) | Prisma 사용 |
| 검색 | Edge | 빠른 글로벌 응답 |
| middleware | Edge | 모든 요청 거침, 가벼워야 함 |
| 결제 콜백 | Node.js | PG SDK 호환성 |
| 이미지 변환 | Vercel built-in | next/image |
