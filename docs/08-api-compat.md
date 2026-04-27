# 08. Legacy API Compatibility

> 외부에서 호출 중인 기존 PHP API는 URL/메서드/응답이 동일해야 한다.
> 클라이언트(파트너사, 모바일 앱, 외부 시스템)가 코드 수정 없이 동작해야 함이 원칙.

## 호환 대상 (확인된 것)

| 기존 URL | 기능 | 신규 라우트 | 인증 | 응답 |
|---|---|---|---|---|
| `/api/gnp-api.php` | GNP 외부 연동 | `app/api/(legacy)/gnp-api.php/route.ts` | 토큰(헤더 또는 쿼리) | 원본 JSON 동일 |
| `/api/point_sync.php` | 포인트 동기화 | `app/api/(legacy)/point_sync.php/route.ts` | 토큰 | 원본 JSON 동일 |
| `/api/version.php` | phpinfo 노출(레거시) | `/api/legacy/version` rewrite | 없음 | **410 Gone JSON으로 보안상 폐기** |
| `/kakao_ajax.php` | 카카오 콜백 | `app/api/(legacy)/kakao_ajax.php/route.ts` | OAuth | 원본 동일 |
| `/payaction.php` | PG 결제 콜백 | `app/api/(legacy)/payaction.php/route.ts` | PG 서명 | PG 규격 |
| `/sns_send.php`, `/sns_tb.php` | SNS push | `app/api/(legacy)/sns_*.php/route.ts` | 토큰 | 동일 |

추가 API가 발견되면 본 표에 즉시 등재.

## `/api/version.php` 보안 폐기 결정

2026-04-26 재검토 결과, 로컬 `legacy/www/api/version.php`는 `<?php phpinfo(); ?>` 한 줄이며 운영 `/api/version.php`도 phpinfo HTML을 반환하는 것으로 확인했다. phpinfo는 PHP 버전, 확장 모듈, 서버 경로, 환경 설정 등 공격 표면을 넓히는 정보를 노출하므로 호환 유지 대상에서 제외한다.

현재 Next `/api/legacy/version`은 레거시와도 불일치했다. 레거시는 HTML `phpinfo()` 전체 페이지를 반환하지만, 기존 Next 구현은 `{"result":"OK","version":"...","ts":...}` JSON을 반환했다. 즉, 이미 원본 응답 호환은 성립하지 않았고 외부 호출자가 JSON 계약에 의존한다는 근거도 없다.

결정: `/api/version.php` 경로 rewrite는 당분간 유지하되 phpinfo 재현은 금지한다. 외부 호출자가 없다는 전제에서 410 Gone JSON으로 전환한다.

전환 응답:

```json
{
  "result": "GONE",
  "code": "PHPINFO_DISABLED",
  "message": "phpinfo endpoint was removed for security."
}
```

마이그레이션 계획:

1. 배포 즉시 `/api/version.php`와 `/api/legacy/version` 모두 410 Gone + `Cache-Control: no-store`로 응답한다.
2. Vercel/서버 접근 로그에서 2~4주 동안 호출자, User-Agent, IP, 실패율을 확인한다.
3. 실제 외부 호출자가 발견되면 phpinfo가 아닌 최소 JSON health 응답(`{"result":"OK","status":"healthy"}`)으로 별도 합의 후 전환한다.
4. 호출자가 없으면 rewrite를 제거하고 `docs/03-legacy-map.md`의 drop 상태를 유지한다.

## 디렉토리 패턴

```
src/app/api/(legacy)/
└── gnp-api.php/
    └── route.ts
```

> Next.js는 폴더명에 `.` 허용. URL 경로에 `.php` 가 그대로 노출됨.

또는 `next.config.mjs` `rewrites`:
```js
async rewrites() {
  return [
    { source: '/api/gnp-api.php', destination: '/api/legacy/gnp-api' },
    { source: '/api/point_sync.php', destination: '/api/legacy/point-sync' },
    { source: '/api/version.php', destination: '/api/legacy/version' },
  ];
}
```
> 둘 중 일관된 한 가지를 선택해서 통일. **권장: rewrite 방식** (라우트 폴더명이 깔끔).

## 응답 호환 체크리스트

- [ ] HTTP 메서드 동일 (GET/POST)
- [ ] 쿼리/바디 파라미터 이름·타입 동일
- [ ] **응답 JSON 키 이름·대소문자·순서 보존**
- [ ] 응답 인코딩: 레거시가 `euc-kr` 이라면 일정 기간 **두 인코딩 모두 지원**
  - 헤더 `Accept-Charset` 또는 별도 쿼리 `?enc=euc-kr` 로 분기
  - 새 클라이언트는 UTF-8, 기존 외부 시스템은 euc-kr 유지
- [ ] 에러 메시지 문구/코드 보존 (외부에서 문자열 매칭하는 경우 있음)
- [ ] 응답 시간 비슷하거나 더 빠를 것

## 인증

- 토큰: `LEGACY_API_TOKEN` 환경변수에 저장된 시크릿과 비교.
- 추후 KMS/시크릿 매니저로 이전.
- IP 화이트리스트가 있다면 middleware에서 검사.

## Rate Limit

- 토큰별 키: `legacy:{tokenHash}` 100 req/min.
- 위반 시 429 + JSON 형식은 기존과 동일하게 (e.g. `{"result":"FAIL","msg":"too many requests"}`).

## 마이그레이션 절차

1. 기존 `legacy/www/api/*.php` 파일 정독, 입출력/에러 케이스 도큐먼트화.
2. zod 스키마로 입력 정의.
3. 신규 비즈니스 로직 호출 (Prisma 기반).
4. 응답 직렬화 시 **레거시 포맷 어댑터** (`legacyFormat()` 유틸) 통과.
5. Postman/`hurl` 컬렉션으로 회귀 테스트 (구 vs 신 응답 diff).
6. 컷오버 전 1주 dual-running (Vercel preview에서 검증).

## 최종 인코딩 정리

- 신규 시스템 내부는 UTF-8 통일.
- 외부 호환 응답은 어댑터 레이어에서 인코딩 변환:
```ts
import iconv from 'iconv-lite';
return new Response(iconv.encode(JSON.stringify(body), 'euc-kr'), {
  headers: { 'Content-Type': 'application/json; charset=euc-kr' },
});
```
- 모든 신규 클라이언트가 UTF-8로 전환되었음이 확인되면 호환 모드 제거.
