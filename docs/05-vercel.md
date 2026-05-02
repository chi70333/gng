# 05. Vercel Deployment Notes

## 호스팅: Vercel (확정)

이유: Next.js 1급 지원, 자동 글로벌 CDN, ISR/이미지 최적화, 환경변수/프리뷰 배포.

## 서버리스 환경 제약 (반드시 숙지)

| 제약 | 규칙 |
|---|---|
| **로컬 파일시스템 쓰기 금지** | 업로드는 R2/S3 presigned URL. `/tmp` 만 가능, 휘발성. |
| **메모리 캐시 신뢰 금지** | 인스턴스가 매번 다를 수 있음. 캐시는 Redis로. |
| **함수 실행시간 제한** | Hobby 10s, Pro 60s, Enterprise 900s. 긴 작업은 QStash로 비동기. |
| **콜드스타트** | DB 핸들 재사용 위해 Prisma는 `globalThis` 싱글턴 패턴 필수. |
| **DB 커넥션** | 함수 인스턴스마다 커넥션 → 폭증 위험. **Neon 풀링 URL** 또는 **Prisma Accelerate** 사용. |
| **Edge runtime** | Node API 일부 미지원 (fs, net 등). middleware/검색 같은 가벼운 라우트만. |
| **`next/image`** | 외부 도메인은 `images.remotePatterns` 등록. |

## 환경변수 분리

| 키 | 위치 | 메모 |
|---|---|---|
| `DATABASE_URL` | Vercel env (prod/preview/dev 분리) | Neon 풀링 URL |
| `DIRECT_URL` | Vercel env | 마이그레이션용(Neon non-pooled) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Vercel env | |
| `AUTH_SECRET` | Vercel env (production만) | `openssl rand -base64 32` |
| `KAKAO_*`, `NAVER_*` | Vercel env | OAuth |
| `MEILI_HOST`, `MEILI_KEY` | Vercel env | |
| `R2_*` | Vercel env | |
| `SENTRY_DSN` | Vercel env | |
| `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY` | Vercel env | |
| `LEGACY_API_TOKEN` | Vercel env | 외부 API 호환용 |
| `CRON_SECRET` | Vercel env | Vercel Cron Route Handler 인증용 |

`.env.example` 에 키 이름만 기재(값은 비움).

## 빌드/배포 설정

### `next.config.mjs` 핵심
- `images.remotePatterns`: R2, 기존 이미지 도메인.
- `experimental.serverActions.bodySizeLimit`: 폼 업로드 한계.
- `redirects`: 레거시 SEO URL → 신규.
- `rewrites`: `/api/*.php` 호환.
- `headers`: 보안 헤더 (`X-Frame-Options`, `Strict-Transport-Security`, `Permissions-Policy` 등).

### `vercel.json`
- `regions`: 한국 사용자 → `icn1`(서울) 우선.
- `functions[**].maxDuration`: 결제 콜백은 30s, 그 외 10s.

### Cron (Vercel Cron)
- 휴면회원 처리, 인기상품 갱신, 사이트맵 빌드 등.
- 길어지는 작업은 cron이 QStash로 enqueue만.
- `/api/cron/prune-api-logs`: 매일 03:00 KST 실행. `ApiCommunicationLog`의 3일 지난 로그 삭제.
- 모든 Cron Route Handler는 `Authorization: Bearer ${CRON_SECRET}` 검증 필수.

## ISR / 캐시 사용 패턴

```ts
// page.tsx
export const revalidate = 60; // 60s ISR

// fetch
const res = await fetch(url, { next: { revalidate: 60, tags: ['products'] } });

// 무효화
import { revalidateTag } from 'next/cache';
revalidateTag('product-123');
```

## 모니터링

- Vercel Analytics + Speed Insights (모바일 Web Vitals 추적).
- Sentry: 서버/클라 에러, 성능 트랜잭션.
- Upstash 대시보드: Redis hit rate, QPS.
- Neon 콘솔: 슬로우 쿼리, 커넥션.
