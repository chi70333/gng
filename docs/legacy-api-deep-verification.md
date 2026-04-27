# [GNG] 레거시 회원가입·포인트 API 심층 검증

## 기본 게이트

항상 먼저 실행한다.

```bash
pnpm typecheck
pnpm lint
pnpm test
```

기본 `pnpm test`는 외부 API나 DB에 쓰기 작업을 하지 않는다. 레거시 API Route Handler 계약 테스트만 기본으로 실행된다.

## DB 통합 테스트

테스트 DB에서만 실행한다. 운영 DB 금지.

```powershell
$env:GNG_DB_INTEGRATION_TEST_ENABLED="1"
$env:GNG_TEST_USER_PREFIX="gng_ext"
pnpm test:legacy:integration
```

검증 항목:

- `registerLegacyMember`가 `User.loginId`, fallback email, 휴대전화 정규화, argon2id hash를 저장한다.
- 중복 회원가입은 `User already exists`를 반환한다.
- `syncLegacyPoint`가 `UserPointHistory`에 `delta`, `balance`, `reason`을 기록한다.
- `new_balance` 강제 잔액이 최신 `list_members.members[].mileage`에 반영된다.
- 없는 회원 포인트 동기화는 `User not found`로 실패한다.

## 외부 스테이징 연동 테스트

스테이징 배포 URL에서만 실행한다. 운영 URL은 기본 차단된다.

```powershell
$env:GNG_EXT_TEST_ENABLED="1"
$env:GNG_EXT_TEST_BASE_URL="https://gng-staging.vercel.app"
$env:GNG_EXT_TEST_TOKEN="<staging legacy token>"
$env:GNG_TEST_USER_PREFIX="gng_ext"
pnpm test:legacy:external
```

검증 항목:

- `/api/gnp-api.php`, `/api/point_sync.php`, `/api/version.php` rewrite 경로가 동작한다.
- `X-API-Key`, `Authorization: Bearer`, query `token` 인증 경로를 확인한다.
- CORS preflight, `Cache-Control: no-store`, 인증 실패 JSON, UTF-8 이름/사유 payload를 확인한다.
- `gnp-api`와 `point_sync`의 서로 다른 성공/실패 메시지를 고정한다.

운영 smoke test가 꼭 필요하면 별도 승인 후에만 아래 값을 사용한다.

```powershell
$env:GNG_EXT_TEST_ALLOW_PRODUCTION="1"
```

## 모바일 E2E

DB 쓰기와 인증 세션이 필요하므로 명시 플래그로만 실행한다.

```powershell
$env:GNG_E2E_AUTH_TEST_ENABLED="1"
pnpm e2e -- tests/e2e/legacy-join-points.spec.ts
```

검증 항목:

- `/join`은 약관 cookie가 없으면 `/join/terms`로 이동한다.
- `/join/terms -> /join -> /login?registered=1` 가입 흐름이 모바일 뷰포트에서 완료된다.
- 로그인 후 `/mypage/points`에서 최신 포인트 잔액과 적립/사용 사유가 보인다.

