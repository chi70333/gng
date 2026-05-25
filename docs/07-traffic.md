# 07. Traffic & Scalability Playbook

> 본 프로젝트의 존재 이유 = 트래픽. 모든 코드 결정은 "이게 1만 동시 접속에서 버틸까?" 를 통과해야 한다.

## 부하 시나리오 (목표)

- 일반 시간: 평균 500 RPS
- 이벤트 피크: **5,000 ~ 10,000 RPS**
- 응답 p95: 메인/목록/상세 < 500ms, 동적 페이지 < 1.5s
- 에러율 < 1%

## 부하 분산 핵심 6가지

### 1. CDN/ISR로 DB 격리
- 메인/목록/상세는 ISR로 정적화 → CDN이 99% 흡수.
- `revalidate` 시간은 컨텐츠 변경 빈도에 맞춰: 메인 60s, 카테고리 120s, 상세 60s.
- 관리자 변경 시 `revalidateTag` 즉시 무효화.

### 2. Redis 캐시 레이어
- 카테고리 트리, 인기상품, 배너, 사용자 등급, 환율/쿠폰 마스터 등은 Redis 우선.
- key 명명: `<domain>:<id>` (예: `product:123`, `category:tree`, `banner:main`).
- TTL은 짧게(1~10분) + 변경 시 명시 invalidate.
- "캐시 스탬피드" 방지: SWR 패턴 또는 lock key.

### 3. DB 보호
- Prisma는 `globalThis` 싱글턴.
- **Neon 풀링 엔드포인트** 사용 (PgBouncer 내장).
- 모든 쿼리에 `select`/`include` 명시 → 컬럼 폭주 방지.
- 슬로우 쿼리(>200ms) 알람 → 인덱스 추가.
- 읽기 전용 통계/관리자 조회는 read replica로 분리(추후).

### 4. Rate Limiting
- `@upstash/ratelimit` 으로 IP+endpoint 단위.
- 기본 정책:
  - `/api/auth/*` : 5 req / 1min
  - `/api/search/*` : 60 req / 1min
  - `/api/cart/*` : 30 req / 1min
  - `/api/(legacy)/*` : 토큰 기반, 토큰당 100 req / 1min
- 초과 시 429 + `Retry-After`.

### 5. 비동기화
- 메일/SMS/카카오 푸시/외부 API 호출/이미지 후처리: **Upstash QStash** 큐로.
- 결제 콜백 같이 즉시 응답이 필요한 것만 동기.

### 6. 정적 자산 분리
- 이미지/JS/CSS는 모두 CDN.
- 업로드 이미지는 R2 + Vercel Image Optimizer 통과.
- 외부 스크립트(Analytics, 카카오, 결제)는 `next/script lazyOnload`.

## 핫스팟 별 전략

| 페이지 | 예상 부하 | 전략 |
|---|---|---|
| 메인 `/` | 최다 | ISR 60s, RSC, 배너 Redis |
| 카테고리 목록 | 많음 | ISR 10m, 페이지네이션은 url query |
| 상품 상세 | 많음 | ISR 10m + tag invalidate, 옵션은 Edge API |
| 검색 | 많음 | Edge runtime + Meilisearch + 30s cache |
| 장바구니 | 중간 | Redis only, no DB |
| 주문/결제 | 적지만 critical | 동시성 락(stock), 트랜잭션 |
| 회원가입/로그인 | 중간 | rate-limit 강함 |
| 외부 API 호환 | 가변 | 토큰별 rate-limit, 입력 검증 강화 |

## 재고 동시성 (이벤트 시 핵심)

- SKU 재고 차감은 **Postgres `SELECT ... FOR UPDATE` 트랜잭션** 또는 Redis Lua atomic.
- 주문 생성 ~ 결제 완료까지 **임시 락**(예: 5분 TTL)로 재고 예약.
- 결제 실패/타임아웃 시 자동 해제(QStash 지연 작업).

## 부하 테스트

- 도구: **k6** (CI에서 주 1회 야간 실행).
- 시나리오: 메인→목록→상세→장바구니→주문 사용자 여정.
- 임계치 미달 시 빌드 fail.

## 장애 대응

- 모든 외부 호출에 timeout(기본 3s) + circuit breaker.
- DB 불가 시 Redis 캐시로 read-only 모드 응답 가능하도록 페이지 설계.
- Sentry 알람 → Slack.
- Vercel Rollback은 1-click. 위험 변경은 항상 프리뷰에서 부하테스트 후 머지.
